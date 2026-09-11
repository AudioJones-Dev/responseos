import { afterEach, describe, expect, test, vi } from "vitest";
import { buildCompletedInteractionMessage } from "@/lib/notifications/completedInteraction";
import {
  getEmailProvider,
  isRetryableEmailErrorCode,
  MockEmailProvider,
  ResendEmailProvider,
} from "@/lib/providers/email";

const FIELDS = {
  businessName: "Example Business",
  eventTypeLabel: "Sales Enquiry",
  caller: "Dana Rivera",
  callerPhone: "+15555550123",
  relationship: "new_prospect",
  service: "Modular ramp",
  location: "Example City, FL, 00000",
  summary: "Caller asked for a ramp quote and will send photos.",
  qualification: "qualified",
  quoteRequested: true,
  photosRequested: true,
  nextAction: "Call back to confirm measurements.",
  crmStatus: "succeeded",
  callReference: "call_123",
  receivedAt: "2026-09-11T15:00:00.000Z",
};

afterEach(() => {
  delete process.env.RESPONSEOS_LIVE_EMAIL_ENABLED;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  vi.unstubAllGlobals();
});

describe("completed-interaction message", () => {
  test("names the event and the caller in the subject", () => {
    expect(buildCompletedInteractionMessage(FIELDS).subject).toBe(
      "New Sales Enquiry — Dana Rivera | Example Business",
    );
  });

  test("carries the operational fields and nothing else", () => {
    const { text } = buildCompletedInteractionMessage(FIELDS);
    for (const expected of [
      "Event type: Sales Enquiry",
      "Caller: Dana Rivera",
      "Callback number: +15555550123",
      "Relationship: new_prospect",
      "Service: Modular ramp",
      "Location: Example City, FL, 00000",
      "Qualification: qualified",
      "Quote requested: Yes",
      "Installation photos requested: Yes",
      "Next action: Call back to confirm measurements.",
      "CRM sync: succeeded",
      "ResponseOS call reference: call_123",
    ]) {
      expect(text).toContain(expected);
    }
    expect(text).toContain("transcript and any recording stay in ResponseOS");
  });
});

describe("email provider selection", () => {
  test("stays on the mock adapter unless the gate and both credentials are present", () => {
    expect(getEmailProvider()).toBeInstanceOf(MockEmailProvider);

    process.env.RESEND_API_KEY = "placeholder";
    process.env.EMAIL_FROM = "assistant@example.test";
    expect(getEmailProvider()).toBeInstanceOf(MockEmailProvider);

    process.env.RESPONSEOS_LIVE_EMAIL_ENABLED = "true";
    delete process.env.EMAIL_FROM;
    expect(getEmailProvider()).toBeInstanceOf(MockEmailProvider);

    process.env.EMAIL_FROM = "assistant@example.test";
    expect(getEmailProvider()).toBeInstanceOf(ResendEmailProvider);
  });

  test("classifies rate limits and provider faults as retryable, rejections as permanent", () => {
    for (const code of ["email_http_429_rate_limit_exceeded", "email_http_500", "email_http_503", "email_request_failed"]) {
      expect(isRetryableEmailErrorCode(code), code).toBe(true);
    }
    for (const code of ["email_http_401", "email_http_403", "email_http_422_validation_error", "live_provider_disabled"]) {
      expect(isRetryableEmailErrorCode(code), code).toBe(false);
    }
  });
});

describe("Resend adapter request", () => {
  test("sends the required headers, the idempotency key, and a text-only body", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ id: "resend-1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new ResendEmailProvider("test-key", "assistant@example.test").send({
      to: "owner@example.test",
      subject: "New Sales Enquiry — Dana Rivera | Example Business",
      text: "Caller: Dana Rivera",
      idempotencyKey: "completed_interaction:account-1:call_123",
    });

    expect(result.providerMessageId).toBe("resend-1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-key");
    expect(headers["user-agent"]).toBeTruthy();
    expect(headers["idempotency-key"]).toBe("completed_interaction:account-1:call_123");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "assistant@example.test",
      to: ["owner@example.test"],
      subject: "New Sales Enquiry — Dana Rivera | Example Business",
      text: "Caller: Dana Rivera",
    });
  });

  test("reports the status and the provider's error name without leaking the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ name: "validation_error", message: "bad from" }), { status: 422 })),
    );
    await expect(
      new ResendEmailProvider("test-key", "assistant@example.test").send({
        to: "owner@example.test",
        subject: "s",
        text: "t",
        idempotencyKey: "k",
      }),
    ).rejects.toThrow("email_http_422_validation_error");
  });

  test("reports a transport failure as retryable rather than throwing the raw error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("socket hang up"); }));
    await expect(
      new ResendEmailProvider("test-key", "assistant@example.test").send({
        to: "owner@example.test",
        subject: "s",
        text: "t",
        idempotencyKey: "k",
      }),
    ).rejects.toThrow("email_request_failed");
  });
});
