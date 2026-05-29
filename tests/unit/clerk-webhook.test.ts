import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { verifyClerkWebhook } from "@/lib/auth/clerk-webhook";

const SECRET = `whsec_${Buffer.from("a-very-secret-signing-key").toString("base64")}`;
const NOW = 1_700_000_000_000; // fixed clock
const TS = String(Math.floor(NOW / 1000));
const ID = "msg_2abc";
const PAYLOAD = JSON.stringify({ type: "user.created", data: { id: "user_1" } });

function sign(secret: string, id: string, ts: string, payload: string): string {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${payload}`).digest("base64");
  return `v1,${sig}`;
}

describe("verifyClerkWebhook", () => {
  test("accepts a correctly signed payload within the time window", () => {
    const result = verifyClerkWebhook({
      secret: SECRET,
      payload: PAYLOAD,
      headers: { svixId: ID, svixTimestamp: TS, svixSignature: sign(SECRET, ID, TS, PAYLOAD) },
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  test("accepts when one of several signature entries matches", () => {
    const header = `v1,bogussignature ${sign(SECRET, ID, TS, PAYLOAD)}`;
    const result = verifyClerkWebhook({
      secret: SECRET,
      payload: PAYLOAD,
      headers: { svixId: ID, svixTimestamp: TS, svixSignature: header },
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  test("rejects a tampered payload", () => {
    const result = verifyClerkWebhook({
      secret: SECRET,
      payload: `${PAYLOAD}tampered`,
      headers: { svixId: ID, svixTimestamp: TS, svixSignature: sign(SECRET, ID, TS, PAYLOAD) },
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "signature_mismatch" });
  });

  test("rejects a signature made with the wrong secret", () => {
    const wrong = `whsec_${Buffer.from("not-the-real-key").toString("base64")}`;
    const result = verifyClerkWebhook({
      secret: SECRET,
      payload: PAYLOAD,
      headers: { svixId: ID, svixTimestamp: TS, svixSignature: sign(wrong, ID, TS, PAYLOAD) },
      now: NOW,
    });
    expect(result.ok).toBe(false);
  });

  test("rejects missing svix headers", () => {
    const result = verifyClerkWebhook({
      secret: SECRET,
      payload: PAYLOAD,
      headers: { svixId: null, svixTimestamp: TS, svixSignature: sign(SECRET, ID, TS, PAYLOAD) },
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "missing_headers" });
  });

  test("rejects a timestamp outside the 5-minute replay window", () => {
    const result = verifyClerkWebhook({
      secret: SECRET,
      payload: PAYLOAD,
      headers: { svixId: ID, svixTimestamp: TS, svixSignature: sign(SECRET, ID, TS, PAYLOAD) },
      now: NOW + 6 * 60 * 1000,
    });
    expect(result).toEqual({ ok: false, reason: "timestamp_out_of_tolerance" });
  });
});
