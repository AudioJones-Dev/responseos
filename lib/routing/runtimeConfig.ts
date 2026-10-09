import { z } from "zod";
import { parseCompanyBindings } from "./companyPolicy";
export function routingRuntimeConfig(env: Readonly<Record<string, string | undefined>>) {
  const accountId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).parse(env.RESPONSEOS_ROUTING_ACCOUNT_ID);
  const environment = z.enum(["test", "preview"]).parse(env.RESPONSEOS_ROUTING_ENVIRONMENT);
  const concurrency = z.coerce.number().int().min(1).max(4).parse(env.RESPONSEOS_ROUTING_CONCURRENCY ?? 2);
  const pollMs = z.coerce.number().int().min(1000).max(30000).parse(env.RESPONSEOS_ROUTING_POLL_MS ?? 1000);
  const url = new URL(env.DATABASE_URL ?? "");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (env.RESPONSEOS_ROUTING_WORKER_ENABLED !== "true" || !["postgres:", "postgresql:"].includes(url.protocol) || !loopback && (!["require", "verify-full"].includes(url.searchParams.get("sslmode") ?? "") || url.searchParams.get("sslaccept") === "accept_invalid_certs") || env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("worker_configuration_invalid");
  if (env.RESPONSEOS_ROUTING_DELIVERY_MODE && env.RESPONSEOS_ROUTING_DELIVERY_MODE !== "simulated" || env.HUBSPOT_ACCESS_TOKEN || env.HUBSPOT_PRIVATE_APP_TOKEN || env.RESPONSEOS_HOSTED_INTAKE_KEYS || env.DIRECT_URL) throw new Error("worker_secret_boundary_refused");
  return {accountId, environment, concurrency, pollMs, companyBindings: parseCompanyBindings(env.RESPONSEOS_ROUTING_COMPANY_BINDINGS)};
}
