import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
const boundary = vi.hoisted(() => ({ after: vi.fn(), query: vi.fn() }));
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: boundary.after }));
vi.mock("@/lib/db/client", () => ({ db: new Proxy({}, { get: () => { boundary.query(); throw new Error("Unexpected database access before envelope acceptance"); } }) }));
const originalEnv = { ...process.env };
const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const routes = [
  ["calls", () => import("@/app/api/webhooks/telnyx/calls/route")],
  ["call-control", () => import("@/app/api/webhooks/telnyx/call-control/route")],
  ["assistant-initialization", () => import("@/app/api/webhooks/telnyx/assistant-initialization/route")],
] as const;
beforeEach(() => { vi.clearAllMocks(); process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED = "true"; process.env.TELNYX_PUBLIC_KEY = publicKey; });
afterEach(() => { process.env = { ...originalEnv }; });
describe.each(routes)("%s raw signature route boundary", (_name, load) => {
  test.each(["missing", "bad", "stale", "changed-raw", "missing-time"])("%s rejects before parsing/persistence/deferred work", async variant => {
    const body = "{";
    const timestamp = String(Math.floor(Date.now() / 1000) - (variant === "stale" ? 301 : 0));
    const signature = sign(null, Buffer.from(`${timestamp}|${body}`), keys.privateKey).toString("base64");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (variant !== "missing") headers["telnyx-signature-ed25519"] = variant === "bad" ? Buffer.alloc(64).toString("base64") : signature;
    if (variant !== "missing-time") headers["telnyx-timestamp"] = timestamp;
    const response = await (await load()).POST(new Request("http://localhost", { method: "POST", headers, body: variant === "changed-raw" ? body + " " : body }));
    expect(response.status).toBe(401);
    expect(boundary.query).not.toHaveBeenCalled();
    expect(boundary.after).not.toHaveBeenCalled();
  });
  test("valid signature passes signature boundary and reaches strict envelope validation", async () => {
    const body = "{}", timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(null, Buffer.from(`${timestamp}|${body}`), keys.privateKey).toString("base64");
    const response = await (await load()).POST(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", "telnyx-timestamp": timestamp, "telnyx-signature-ed25519": signature }, body }));
    expect(response.status).toBe(422);
    expect(boundary.query).not.toHaveBeenCalled();
  });
});
