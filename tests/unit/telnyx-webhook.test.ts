import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  getTelnyxCallId,
  parseTelnyxWebhook,
  verifyTelnyxWebhook,
} from "@/lib/providers/telnyx/webhook";

describe("Telnyx webhook boundary", () => {
  const keys = generateKeyPairSync("ed25519");
  const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
  const now = new Date("2026-08-18T12:00:00.000Z");
  const timestamp = String(Math.floor(now.getTime() / 1000));
  const rawBody = JSON.stringify({
    data: {
      id: "event-1",
      event_type: "call.conversation.ended",
      payload: { call_control_id: "call-1" },
    },
  });
  const signature = sign(null, Buffer.from(`${timestamp}|${rawBody}`), keys.privateKey).toString("base64");

  test("verifies the unmodified raw body", () => {
    expect(verifyTelnyxWebhook({ rawBody, signature, timestamp, publicKey, now })).toEqual({ ok: true });
    expect(verifyTelnyxWebhook({ rawBody: `${rawBody} `, signature, timestamp, publicKey, now })).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  test("rejects missing and stale signatures", () => {
    expect(verifyTelnyxWebhook({ rawBody, signature: null, timestamp, publicKey, now })).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(
      verifyTelnyxWebhook({
        rawBody,
        signature,
        timestamp: String(Number(timestamp) - 301),
        publicKey,
        now,
      }),
    ).toEqual({ ok: false, reason: "stale" });
  });

  test("parses only a usable envelope and canonical call id", () => {
    const event = parseTelnyxWebhook(rawBody);
    expect(event?.data.id).toBe("event-1");
    expect(getTelnyxCallId(event!.data.payload)).toBe("call-1");
    expect(parseTelnyxWebhook("{}" )).toBeNull();
  });
});
