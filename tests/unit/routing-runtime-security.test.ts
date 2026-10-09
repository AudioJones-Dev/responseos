import { expect, test } from "vitest";
import { routingRuntimeConfig } from "@/lib/routing/runtimeConfig";
import { parseCompanyBindings, resolveCompanyBinding } from "@/lib/routing/companyPolicy";
import { inquiry } from "../routingFixtures";
const env = {RESPONSEOS_ROUTING_WORKER_ENABLED: "true", RESPONSEOS_ROUTING_ACCOUNT_ID: "org_mock_1", RESPONSEOS_ROUTING_ENVIRONMENT: "test", DATABASE_URL: "postgresql://synthetic@127.0.0.1:55440/postgres"};
test("remote runtime database requires TLS and never accepts migration/intake/provider secrets", () => {
  expect(routingRuntimeConfig(env).environment).toBe("test");
  for (const url of ["postgresql://synthetic@db.example.invalid/postgres", "postgresql://synthetic@db.example.invalid/postgres?sslmode=disable", "postgresql://synthetic@db.example.invalid/postgres?sslmode=require&sslaccept=accept_invalid_certs"]) expect(() => routingRuntimeConfig({...env, DATABASE_URL: url})).toThrow();
  expect(routingRuntimeConfig({...env, DATABASE_URL: "postgresql://synthetic@db.example.invalid/postgres?sslmode=require"}).concurrency).toBe(2);
  for (const key of ["DIRECT_URL", "HUBSPOT_ACCESS_TOKEN", "HUBSPOT_PRIVATE_APP_TOKEN", "RESPONSEOS_HOSTED_INTAKE_KEYS"]) expect(() => routingRuntimeConfig({...env, [key]: "synthetic-only"})).toThrow("worker_secret_boundary_refused");
  expect(() => routingRuntimeConfig({...env, NODE_TLS_REJECT_UNAUTHORIZED: "0"})).toThrow();
});
test("runtime cannot select production/live mode or unbounded concurrency/polling", () => {
  for (const extra of [{RESPONSEOS_ROUTING_ENVIRONMENT: "production"}, {RESPONSEOS_ROUTING_DELIVERY_MODE: "hubspot"}, {RESPONSEOS_ROUTING_CONCURRENCY: "5"}, {RESPONSEOS_ROUTING_POLL_MS: "0"}]) expect(() => routingRuntimeConfig({...env, ...extra})).toThrow();
});
test("a caller verified Company flag cannot authorize a cross-tenant/environment/portal binding", () => {
  const candidate = {...inquiry(), company: {id: "123", verified: true as const}};
  const binding = {accountId: "org_mock_1", environment: "test" as const, portalId: "247150421", companyId: "123", approvalReference: "synthetic-proof"};
  expect(resolveCompanyBinding(candidate, "test", "247150421", parseCompanyBindings(JSON.stringify([binding])))).toEqual(binding);
  for (const changed of [{accountId: "org_mock_2"}, {environment: "preview"}, {portalId: "999"}]) expect(() => resolveCompanyBinding(candidate, "test", "247150421", parseCompanyBindings(JSON.stringify([{...binding, ...changed}])))).toThrow("company_binding_requires_approval");
  expect(() => resolveCompanyBinding(candidate, "test", "247150421", [])).toThrow();
  expect(() => parseCompanyBindings(JSON.stringify([binding, binding]))).toThrow("company_policy_ambiguous");
});
