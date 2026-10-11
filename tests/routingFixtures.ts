import { createHmac } from "node:crypto";
import type { Inquiry } from "@/lib/routing/frlPlan";
import { hostedIntakePath, hostedSigningText, type HostedAuthority } from "@/lib/routing/hostedAuth";
export const authority: HostedAuthority = {keyId: "fixture", accountId: "org_mock_1", environment: "test", audience: "frl-test", retentionDays: 30};
export const secret = "synthetic-hosted-routing-test-key-only";
export const submissionId = "00000000-0000-4000-8000-000000000001";
export function inquiry(pathway: Inquiry["pathway"] = "residential", id = submissionId): Inquiry {
  return { accountId: authority.accountId, inquiryId: id, sourceEventId: `fixture-${id}`, sourceChannel: "form", pathway, occurredAt: "2026-10-09T04:00:00.000Z", nextActionAt: "2026-10-10T04:00:00.000Z", contact: {email: "synthetic@example.invalid", firstName: "Synthetic", preferredMethod: "email"}, qualification: "qualified", qualificationReason: "Synthetic decision", disposition: "continue", decisionReference: "synthetic-decision", service: "stair_lift", jobType: pathway === "repair" ? "repair" : pathway === "equipment_acquisition" ? "acquisition" : "sales_installation", city: "TEST", urgency: "routine", contactPermission: true, paymentArrangement: "self_pay", vetaccessRequest: false, summary: "Synthetic only", nextAction: "Synthetic review", source: {page: "/services/stairlifts?secret=redact", landingPage: "/", utmSource: "test"}, ...(pathway === "equipment_acquisition" ? {acquisition: {finalDecision: "accept_candidate", operatorReference: "fixture-operator", sellerAuthorityConfirmed: true, equipmentCategory: "stair_lift"}} : {}) };
}
export function payload(pathway: Inquiry["pathway"] = "residential", id = submissionId) {
  const source = inquiry(pathway, id);
  const body = Object.fromEntries(Object.entries(source).filter(([key]) => key !== "accountId"));
  return {schemaVersion: 1, inquiry: body};
}
export function signedRequest(body = JSON.stringify(payload()), age = 0, audience = authority.audience, id = submissionId) {
  const timestamp = String(Math.floor(Date.now() / 1000) - age);
  const signature = createHmac("sha256", secret).update(hostedSigningText(timestamp, id, audience, Buffer.from(body))).digest("hex");
  return new Request(`https://responseos.example${hostedIntakePath}`, {method: "POST", headers: {"Content-Type": "application/json", "X-ResponseOS-Key-Id": authority.keyId, "X-ResponseOS-Timestamp": timestamp, "Idempotency-Key": id, "X-ResponseOS-Signature": `v1=${signature}`}, body});
}
export const credentialEnv = {RESPONSEOS_HOSTED_INTAKE_ENABLED: "true", RESPONSEOS_HOSTED_INTAKE_KEYS: JSON.stringify([{...authority, secret}])};
