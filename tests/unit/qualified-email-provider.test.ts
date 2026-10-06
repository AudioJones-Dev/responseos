import { afterEach, expect, test, vi } from "vitest";
import { ResendQualifiedEmailProvider } from "@/lib/providers/resend/resend";
import { getQualifiedEmailProvider } from "@/lib/providers/resend";
import { RESPONSEOS_NOTIFICATION_SENDER } from "@/lib/providers/resend/types";

const id = "00000000-0000-4000-8000-000000000001";
const input = { recipient: "owner@example.com", subject: "Qualified caller", text: "Synthetic call context", idempotencyKey: "frl-qualified-synthetic" };
const receipt = (overrides = {}) => ({ id, to: [input.recipient], from: RESPONSEOS_NOTIFICATION_SENDER, subject: input.subject, text: input.text, last_event: "delivered", ...overrides });
afterEach(() => vi.unstubAllEnvs());

test("flags, key and exact sender are all required; a missing value resolves mock", () => {
  vi.stubEnv("RESPONSEOS_LIVE_RESEND_ENABLED", "false");
  vi.stubEnv("RESEND_API_KEY", "synthetic-key");
  vi.stubEnv("EMAIL_FROM", RESPONSEOS_NOTIFICATION_SENDER);
  expect(getQualifiedEmailProvider().providerId).toBe("mock");
  vi.stubEnv("RESPONSEOS_LIVE_RESEND_ENABLED", "true");
  vi.stubEnv("RESEND_API_KEY", "");
  expect(getQualifiedEmailProvider().providerId).toBe("mock");
  vi.stubEnv("RESEND_API_KEY", "synthetic-key");
  vi.stubEnv("EMAIL_FROM", "unapproved@example.com");
  expect(getQualifiedEmailProvider().providerId).toBe("mock");
  vi.stubEnv("EMAIL_FROM", RESPONSEOS_NOTIFICATION_SENDER);
  expect(getQualifiedEmailProvider().providerId).toBe("resend");
});

test("send fixes sender and endpoint, includes stable idempotency, and only proves acceptance", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id }));
  const provider = new ResendQualifiedEmailProvider("synthetic-key", request);
  expect(await provider.send(input)).toEqual({ messageId: id, event: "accepted" });
  const [url, init] = request.mock.calls[0];
  expect(url).toBe("https://api.resend.com/emails");
  expect(init?.redirect).toBe("error");
  expect(init?.signal).toBeInstanceOf(AbortSignal);
  expect(init?.headers).toMatchObject({ "Idempotency-Key": input.idempotencyKey });
  expect(JSON.parse(init!.body as string)).toEqual({ from: RESPONSEOS_NOTIFICATION_SENDER, to: [input.recipient], subject: input.subject, text: input.text });
});

test("delivery readback validates exact provider message and payload", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(receipt()));
  const provider = new ResendQualifiedEmailProvider("synthetic-key", request);
  expect(await provider.inspect(id, input)).toEqual({ messageId: id, event: "delivered" });
  expect(request.mock.calls[0][0]).toBe(`https://api.resend.com/emails/${id}`);
});

test.each([
  { to: ["different@example.com"] }, { from: "different@example.com" }, { text: "Wrong call" },
  { subject: "Wrong subject" }, { cc: ["other@example.com"] }, { bcc: ["other@example.com"] },
  { id: "00000000-0000-4000-8000-000000000002" },
])("mismatched readback cannot certify delivery: %j", async (overrides) => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(receipt(overrides)));
  await expect(new ResendQualifiedEmailProvider("synthetic-key", request).inspect(id, input)).rejects.toMatchObject({ code: "resend_readback_mismatch", retryable: false });
});

test.each([
  [409, "invalid_idempotent_request", false], [409, "concurrent_idempotent_requests", true],
  [429, "rate_limit_exceeded", true], [503, "unavailable", true], [403, "forbidden", false],
] as const)("HTTP %s %s is redacted and classified", async (status, name, retryable) => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ name, message: "PII or secret must never escape" }, { status }));
  await expect(new ResendQualifiedEmailProvider("synthetic-key", request).send(input)).rejects.toMatchObject({ retryable });
  await expect(new ResendQualifiedEmailProvider("synthetic-key", request).send(input)).rejects.not.toThrow("PII or secret");
});

test("timeouts and malformed successes are uncertain, not delivered", async () => {
  const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("sensitive detail"));
  await expect(new ResendQualifiedEmailProvider("synthetic-key", request).send(input)).rejects.toMatchObject({ code: "resend_transport_unknown", retryable: true });
  request.mockResolvedValue(Response.json({ accepted: true }));
  await expect(new ResendQualifiedEmailProvider("synthetic-key", request).send(input)).rejects.toMatchObject({ code: "resend_response_unknown", retryable: true });
});

test("invalid destinations, headers and message IDs stop before HTTP", async () => {
  const request = vi.fn<typeof fetch>();
  const provider = new ResendQualifiedEmailProvider("synthetic-key", request);
  await expect(provider.send({ ...input, recipient: "invalid" })).rejects.toThrow("email_request_invalid");
  await expect(provider.send({ ...input, subject: "line\r\ninjection" })).rejects.toThrow("email_request_invalid");
  await expect(provider.inspect("../other", input)).rejects.toThrow("email_message_id_invalid");
  expect(request).not.toHaveBeenCalled();
});
