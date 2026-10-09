import { expect, test } from "vitest";
import { authenticateHostedIntake } from "@/lib/routing/hostedAuth";
import { routeInquiry } from "@/lib/routing/frlManifest";
import { inquirySchema, pathways } from "@/lib/routing/frlPlan";
import { HubspotRoutingAdapter } from "@/lib/routing/hubspotAdapter";
import { authority, credentialEnv, inquiry, signedRequest } from "../routingFixtures";
import { inspectUncertainHubspotDelivery } from "@/lib/routing/reconciliation";
import { providerConfigurationHash } from "@/lib/routing/frlManifest";
import { createHash } from "node:crypto";
import type { Delivery } from "@/lib/routing/ledger";

test("hosted authority is server-resolved with no secret returned, including production Node runtime", async () => {
  const result = await authenticateHostedIntake(signedRequest(), {...credentialEnv, NODE_ENV: "production"});
  expect(result.authority).toEqual(authority);
  expect(result.authority).not.toHaveProperty("secret");
});
test.each([301, -301])("rejects stale or future signature age %s", async age => {
  await expect(authenticateHostedIntake(signedRequest(undefined, age), credentialEnv)).rejects.toMatchObject({status: 401});
});
test("rejects wrong audience, identity tampering, malformed signature and invalid key", async () => {
  await expect(authenticateHostedIntake(signedRequest(undefined, 0, "wrong"), credentialEnv)).rejects.toMatchObject({status: 401});
  for (const [name, value] of [["idempotency-key", "00000000-0000-4000-8000-000000000002"], ["x-responseos-signature", "v1=bad"], ["x-responseos-key-id", "unknown"]]) {
    const request = signedRequest(); request.headers.set(name, value);
    await expect(authenticateHostedIntake(request, credentialEnv)).rejects.toMatchObject({status: 401});
  }
});
test("bounds actual bytes regardless of content-length", async () => {
  const request = signedRequest(" ".repeat(16385)); request.headers.set("content-length", "1");
  await expect(authenticateHostedIntake(request, credentialEnv)).rejects.toMatchObject({status: 413});
});
test("default-denies disabled, missing and duplicate credential configurations", async () => {
  await expect(authenticateHostedIntake(signedRequest(), {})).rejects.toMatchObject({status: 503});
  await expect(authenticateHostedIntake(signedRequest(), {RESPONSEOS_HOSTED_INTAKE_ENABLED: "true"})).rejects.toMatchObject({status: 503});
  const keys = JSON.parse(credentialEnv.RESPONSEOS_HOSTED_INTAKE_KEYS);
  await expect(authenticateHostedIntake(signedRequest(), {...credentialEnv, RESPONSEOS_HOSTED_INTAKE_KEYS: JSON.stringify([...keys, ...keys])})).rejects.toMatchObject({status: 503});
});
test.each(pathways)("approved %s destination and property contract", pathway => {
  const plan = routeInquiry(inquiry(pathway));
  expect(plan.primaryOwnerId).toBe("97785262"); expect(plan.backupOwnerId).toBe("169043038");
  expect(plan.objectType).toBe(pathway === "repair" ? "tickets" : "deals");
  expect(plan.properties.pipeline ?? plan.properties.hs_pipeline).toBe(pathway === "repair" ? "0" : pathway === "equipment_acquisition" ? "2609285880" : "default");
  expect(plan.properties).not.toHaveProperty("amount"); expect(plan.properties.frl_source_page).not.toContain("secret");
  if (pathway === "equipment_acquisition") expect(plan.properties.frl_financial_direction).toBe("frl_pays_seller");
});
test("environment separation and pending qualification do not invent a sales Deal", () => {
  expect(routeInquiry(inquiry(), "test").key).not.toBe(routeInquiry(inquiry(), "preview").key);
  const plan = routeInquiry({...inquiry(), qualification: "pending", disposition: "manual_review"});
  expect(plan.objectType).toBeNull();
});
test("ambiguous contact identities block without mutation", async () => {
  const port = new HubspotRoutingAdapter(async (_method, _path, body) => {
    const filter = body as {filterGroups: {filters: {propertyName: string}[]}[]};
    return {status: 200, body: {total: 1, results: [{id: filter.filterGroups[0].filters[0].propertyName === "email" ? "1" : "2", properties: {email: "synthetic@example.invalid"}}]}};
  });
  await expect(port.findContact({...inquiry(), contact: {...inquiry().contact, phone: "+12025550101"}})).rejects.toMatchObject({code: "contact_identity_collision"});
});
test.each([500, 502, 409])("ambiguous create HTTP %s is uncertain", async status => {
  const port = new HubspotRoutingAdapter(async () => ({status, body: {}}));
  await expect(port.createContact(inquiry())).rejects.toMatchObject({disposition: "uncertain"});
});
test("lost create acknowledgement and missing post-create readback are uncertain", async () => {
  const broken = new HubspotRoutingAdapter(async () => {throw new Error("network");});
  await expect(broken.createContact(inquiry())).rejects.toMatchObject({disposition: "uncertain"});
  const readback = new HubspotRoutingAdapter(async method => method === "POST" ? {status: 201, body: {id: "123"}} : {status: 429, body: {}});
  await expect(readback.createInquiry(routeInquiry(inquiry()))).rejects.toMatchObject({disposition: "uncertain"});
});
test("definitive 429 nonacceptance can back off safely", async () => {
  const port = new HubspotRoutingAdapter(async () => ({status: 429, body: {}}));
  await expect(port.createContact(inquiry())).rejects.toMatchObject({code: "hubspot_http_429", disposition: "retry"});
});
test.each([true, false])("read-only uncertain proof with record present %s never creates or authorizes resend", async present => {
  const canonical = {schemaVersion: 1 as const, inquiry: inquirySchema.parse(inquiry())};
  const delivery = {mode: "hubspot", status: "uncertain", environment: "test", account_id: authority.accountId, request_json: canonical,
    payload_hash: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"), checkpoint_json: {manifestHash: providerConfigurationHash, planFingerprint: routeInquiry(canonical.inquiry).fingerprint}} as Delivery;
  const plan = routeInquiry(canonical.inquiry);
  const port = new HubspotRoutingAdapter(async (method, path) => {
    expect(method === "GET" || method === "POST" && path.endsWith("/search")).toBe(true);
    if (path.endsWith("/contacts/search")) return {status: 200, body: {total: 1, results: [{id: "123", properties: {email: canonical.inquiry.contact.email}}]}};
    if (path.endsWith("/deals/search")) return {status: 200, body: {total: present ? 1 : 0, results: present ? [{id: "456", properties: plan.properties}] : []}};
    return {status: 200, body: {results: [{toObjectId: "123"}]}};
  });
  expect((await inspectUncertainHubspotDelivery(delivery, port)).status).toBe(present ? "ready_for_human_review" : "inconclusive");
});
