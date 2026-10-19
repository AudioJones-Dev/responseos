import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import { prisma, resetAndSeedTestDb, disconnectTestDb, setDevSession } from "./setup";
import { POST } from "@/app/api/admin/call-capture/[id]/withdrawal-recovery/route";
import { POST as originalPost } from "@/app/api/admin/call-capture/[id]/consent/route";
import { continueWithdrawalDatabase } from "@/lib/callReview/withdrawalRecovery";
import { persistWithdrawalReceipt, withdrawalReceiptDb } from "@/lib/callReview/withdrawalReceipt";
import { loadCallReviewConsole } from "@/lib/callReview/service";
import { withCaptureLock } from "@/lib/callReview/consent";

const hooks = vi.hoisted(() => { vi.resetModules(); return { drain: undefined as (() => Promise<void>) | undefined, evidence: undefined as (() => Promise<void>) | undefined, send: vi.fn() }; });
vi.mock("@/lib/providers/telnyx/callControl", async original => ({ ...await original<typeof import("@/lib/providers/telnyx/callControl")>(), sendTelnyxCallCommand: hooks.send }));
vi.mock("@/lib/callReview/consent", async original => {
  const actual = await original<typeof import("@/lib/callReview/consent")>();
  return { ...actual, withCaptureLock: async (...args: Parameters<typeof actual.withCaptureLock>) => {
    const result = await actual.withCaptureLock(...args);
    if (result && typeof result === "object") {
      const key = "event" in result ? "evidence" : "withdrawal_drained_at" in result ? "drain" : null;
      if (key && hooks[key]) { const hook = hooks[key]!; hooks[key] = undefined; await hook(); }
    }
    return result;
  } };
});
const origin = new AsyncLocalStorage<string>();
const providerOrigins: Array<string | undefined> = [];
beforeEach(async () => {
  await resetAndSeedTestDb(); setDevSession("operator"); hooks.drain = undefined; hooks.evidence = undefined; providerOrigins.length = 0;
  hooks.send.mockReset().mockImplementation(async () => { providerOrigins.push(origin.getStore()); if (origin.getStore() !== "original") throw Error("continuation provider effect forbidden"); return { ok: true, status: 200, providerDate: new Date(), conversationId: null, errorCode: null }; });
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("external effect forbidden"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); expect(providerOrigins).not.toContain("continuation"); vi.unstubAllGlobals(); });
afterAll(async () => { await withdrawalReceiptDb?.$disconnect(); await disconnectTestDb(); vi.doUnmock("@/lib/callReview/consent"); vi.doUnmock("@/lib/providers/telnyx/callControl"); vi.resetModules(); });
function barrier() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
async function fixture(kind: "normal" | "missing" | "legacy" = "normal") {
  const account = await prisma.account.findFirstOrThrow();
  const source = new Date(Date.now() - 10_000), grant = new Date(source.getTime() - 10_000);
  const capture = await prisma.callCaptureSession.create({ data: { account_id: account.id, provider_call_id: randomUUID(), snapshot_id: "synthetic", snapshot_json: {}, assignment_id: "synthetic", control_state: "AI_ACTIVE", capture_started_at: grant } });
  await prisma.callConsentEvent.create({ data: { account_id: account.id, provider_call_id: capture.provider_call_id, event_key: randomUUID(), action: "grant", artifact: "transcript", disclosure_ref: "synthetic", evidence_ref: "synthetic", jurisdiction_basis: "synthetic", source_channel: "call", actor_user_id: "first-operator", occurred_at: grant } });
  const original = { disclosureRef: "original disclosure", evidenceRef: "original evidence", jurisdictionBasis: "original basis", withdrawalSourceTime: { occurredAt: source.toISOString(), attestation: "operator_witness" } };
  const eventKey = randomUUID();
  const receipt = kind === "missing" ? null : kind === "legacy" ? await prisma.callWithdrawalReceipt.create({ data: { account_id: account.id, capture_id: capture.id, provider_call_id: capture.provider_call_id, generation: 1, source_provenance: "legacy_capture_receipt" } }) : await persistWithdrawalReceipt(capture, "first-operator", { ...original, eventKey });
  const body = { receiptId: receipt?.id ?? "missing", expectedAccountId: account.id, expectedProviderCallId: capture.provider_call_id, generation: 1, original };
  const post = (value: unknown = body) => origin.run("continuation", () => POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(value) }), { params: Promise.resolve({ id: capture.id }) }));
  return { capture, receipt, original, eventKey, body, source, post };
}

test("existing receipt drives concurrent idempotent drain and exact-key evidence without provider calls", async () => {
  const f = await fixture();
  await prisma.$queryRaw`SELECT pg_sleep(0.02)`;
  const results = await Promise.all([f.post(), f.post(), f.post()]);
  for (const result of results) { expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ ok: true, data: { evidence: { state: "recorded" }, providerAction: "none", withdrawal: { receipt: "recorded", drain: "confirmed", providerCessationConfirmed: false } } }); }
  const current = await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } });
  expect(current.withdrawal_drained_at!.getTime()).toBeGreaterThan(f.receipt!.received_at.getTime());
  expect(current.withdrawal_received_at).toEqual(f.receipt!.received_at);
  expect(current.control_state).toBe("STOP_PENDING");
  expect(await prisma.callWithdrawalReceipt.findUniqueOrThrow({ where: { id: f.receipt!.id } })).toEqual(f.receipt);
  const events = await prisma.callConsentEvent.findMany({ where: { action: "withdraw" } });
  expect(events).toHaveLength(1); expect(events[0].event_key).toBe(`${f.capture.id}:${f.eventKey}`);
  expect(events[0].actor_user_id).not.toBe(f.receipt!.actor_user_id);
  await f.post(); expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).withdrawal_drained_at).toEqual(current.withdrawal_drained_at);
  expect(hooks.send).not.toHaveBeenCalled(); expect(await prisma.telnyxCallCommand.count()).toBe(0);
});

test.each(["client_admin@org_mock_1", "client_viewer@org_mock_1", "anonymous"])("denies %s before receipt writes", async role => {
  const f = await fixture();
  if (role === "anonymous") { delete process.env.RESPONSEOS_DEV_SESSION; process.env.RESPONSEOS_REQUIRE_AUTH = "true"; } else setDevSession(role);
  try { expect((await f.post()).status).toBe(403); await expect(continueWithdrawalDatabase({ captureId: f.capture.id, ...f.body })).rejects.toThrow("operator_required"); }
  finally { delete process.env.RESPONSEOS_REQUIRE_AUTH; }
  expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).withdrawal_drained_at).toBeNull();
  expect(await prisma.callConsentEvent.count({ where: { action: "withdraw" } })).toBe(0);
});

test.each(["receiptId", "expectedAccountId", "expectedProviderCallId", "generation"] as const)("rejects mismatched %s", async field => {
  const f = await fixture(); expect((await f.post({ ...f.body, [field]: field === "generation" ? 2 : "foreign" })).status).toBe(409);
  expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).withdrawal_drained_at).toBeNull(); expect(hooks.send).not.toHaveBeenCalled();
});

test("a receipt from another capture cannot be substituted", async () => {
  const a = await fixture(), b = await fixture();
  expect((await a.post({ ...a.body, receiptId: b.receipt!.id })).status).toBe(409);
  expect(await prisma.callConsentEvent.count({ where: { action: "withdraw" } })).toBe(0);
});

test.each([false,true])("missing receipt refuses recovery without creating one (legacy marker: %s)", async marker => {
  const f = await fixture("missing");
  if (marker) await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { withdrawal_received_at: new Date(), control_state: "STOP_PENDING" } });
  expect((await f.post()).status).toBe(409); expect(await prisma.callWithdrawalReceipt.count()).toBe(0); expect(hooks.send).not.toHaveBeenCalled();
});

test("legacy receipt still permits drain but cannot manufacture original evidence", async () => {
  const f = await fixture("legacy");
  expect(await (await f.post()).json()).toMatchObject({ data: { withdrawal: { drain: "confirmed" }, evidence: { state: "review_required", reason: "original_inputs_unavailable" } } });
  expect(await prisma.callWithdrawalReceipt.findUniqueOrThrow()).toEqual(f.receipt); expect(await prisma.callConsentEvent.count({ where: { action: "withdraw" } })).toBe(0);
});

test.each(["missing", "references", "source", "blank"])("%s original inputs require review while drain remains useful", async kind => {
  const f = await fixture();
  const original = kind === "missing" ? undefined : kind === "references" ? { ...f.original, evidenceRef: "changed" } : kind === "source" ? { ...f.original, withdrawalSourceTime: { ...f.original.withdrawalSourceTime, attestation: "unverified" } } : { disclosureRef: "", evidenceRef: "", jurisdictionBasis: "" };
  expect(await (await f.post({ ...f.body, original })).json()).toMatchObject({ data: { withdrawal: { drain: "confirmed" }, evidence: { state: "review_required" } } });
  expect(await prisma.callConsentEvent.count({ where: { action: "withdraw" } })).toBe(0); expect(await prisma.callWithdrawalReceipt.findUniqueOrThrow()).toEqual(f.receipt);
});

test.each(["top", "original"])("rejects user-supplied event key at %s level", async level => {
  const f = await fixture(); const body = level === "top" ? { ...f.body, eventKey: randomUUID() } : { ...f.body, original: { ...f.original, eventKey: randomUUID() } };
  expect((await f.post(body)).status).toBe(422); expect(await prisma.callConsentEvent.count({ where: { action: "withdraw" } })).toBe(0);
});

test("new evidence is classified using current call state; later retries preserve it", async () => {
  const f = await fixture();
  await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { capture_ended_at: new Date(f.source.getTime() - 1000) } });
  expect(await (await f.post()).json()).toMatchObject({ data: { evidence: { state: "review_required", reason: "after_capture_end" } } });
  const evidence = await prisma.callConsentEvent.findFirstOrThrow({ where: { action: "withdraw" } });
  await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { capture_ended_at: new Date() } });
  await f.post(); expect(await prisma.callConsentEvent.findUniqueOrThrow({ where: { id: evidence.id } })).toEqual(evidence); expect(await prisma.callWithdrawalReceipt.findUniqueOrThrow()).toEqual(f.receipt);
});

test.each(["drain", "evidence"] as const)("lost %s acknowledgement can be retried without effects or duplicate history", async boundary => {
  const f = await fixture(); hooks[boundary] = async () => { throw Error("synthetic lost commit acknowledgement"); };
  const first = await f.post(); expect(first.status).toBe(boundary === "drain" ? 200 : 503);
  expect((await f.post()).status).toBe(200);
  expect(await prisma.callConsentEvent.count({ where: { action: "withdraw" } })).toBe(1);
  expect(await prisma.callWithdrawalReceipt.findUniqueOrThrow()).toEqual(f.receipt); expect(hooks.send).not.toHaveBeenCalled();
});

test("locked preauthorized work leaves drain pending; a later continuation completes", async () => {
  const f = await fixture(), held = barrier(), release = barrier();
  const writer = withCaptureLock(f.capture.account_id, f.capture.provider_call_id, async () => { held.resolve(); await release.promise; });
  await held.promise;
  try { const response = await f.post(); expect(response.status).toBe(202); expect(await response.json()).toMatchObject({ data: { withdrawal: { receipt: "recorded", drain: "pending" }, providerAction: "none" } }); }
  finally { release.resolve(); await writer; }
  expect((await f.post()).status).toBe(200); expect(hooks.send).not.toHaveBeenCalled();
});

test("generation mutation after drain vetoes evidence without retargeting", async () => {
  const f = await fixture(); hooks.drain = async () => { await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { generation: 2 } }); };
  expect((await f.post()).status).toBe(409); expect(await prisma.callConsentEvent.count({ where: { action: "withdraw" } })).toBe(0); expect(await prisma.callWithdrawalReceipt.findUniqueOrThrow()).toEqual(f.receipt);
});

test("concurrent original withdrawal may send stop independently; continuation never does", async () => {
  const f = await fixture(), entered = barrier(), release = barrier();
  hooks.send.mockImplementationOnce(async () => { providerOrigins.push(origin.getStore()); entered.resolve(); await release.promise; return { ok: true, status: 200, providerDate: new Date(), conversationId: null, errorCode: null }; });
  const original = origin.run("original", () => originalPost(new Request("http://localhost", { method: "POST", body: JSON.stringify({ action: "withdraw", ...f.original, eventKey: f.eventKey }) }), { params: Promise.resolve({ id: f.capture.id }) }));
  await entered.promise;
  try { expect((await f.post()).status).toBe(200); expect(providerOrigins).toEqual(["original"]); }
  finally { release.resolve(); }
  expect((await original).status).toBe(200); expect(hooks.send).toHaveBeenCalledTimes(1);
  const stopped = await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } }); expect(stopped.control_state).toBe("STOPPED");
  await prisma.callCaptureSession.update({ where: { id: f.capture.id }, data: { call_disconnected_at: new Date() } });
  const terminal = await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } }); await f.post();
  expect(await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).toMatchObject({ control_state: "STOPPED", withdrawal_received_at: terminal.withdrawal_received_at, withdrawal_drained_at: terminal.withdrawal_drained_at, call_disconnected_at: terminal.call_disconnected_at });
  expect(hooks.send).toHaveBeenCalledTimes(1);
});
test.each(["operator", "system", "unknown"] as const)("console reads %s hangup origin without changing dispatch state", async kind => {
  const f = await fixture();
  const command = await prisma.telnyxCallCommand.create({ data: { account_id: f.capture.account_id, capture_session_id: f.capture.id, assignment_id: f.capture.assignment_id!, generation: 1, command_type: "hangup", command_id: randomUUID(), provider_resource: f.capture.provider_call_id, request_json: {}, status: "uncertain", reconciliation_state: "end_call_dispatch_claimed" } });
  if (kind !== "unknown") await prisma.auditLog.create({ data: { account_id: f.capture.account_id, actor_type: kind === "operator" ? "user" : "system", actor_user_id: kind === "operator" ? "operator" : null, action: "call_end_requested", category: "workflow", target_type: "CallCaptureSession", target_id: f.capture.id, metadata_json: { commandId: command.command_id, generation: 1 } } });
  const row = (await loadCallReviewConsole()).captures.find(c => c.id === f.capture.id)!;
  expect(row.commands.find(c => c.id === command.id)?.endCallStatus).toMatchObject({ origin: kind, authorizationRecorded: false });
  expect(await prisma.telnyxCallCommand.findUniqueOrThrow({ where: { id: command.id } })).toEqual(command);
  expect(hooks.send).not.toHaveBeenCalled();
});

test("evidence transaction failure leaves drain committed and can resume", async () => {
  const f = await fixture();
  await prisma.$executeRawUnsafe(`CREATE FUNCTION synthetic_recovery_evidence_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic recovery failure'; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER synthetic_recovery_evidence_failure BEFORE INSERT ON "CallConsentEvent" FOR EACH ROW EXECUTE FUNCTION synthetic_recovery_evidence_failure()`);
  try { expect((await f.post()).status).toBe(503); }
  finally { await prisma.$executeRawUnsafe('DROP TRIGGER synthetic_recovery_evidence_failure ON "CallConsentEvent"'); await prisma.$executeRawUnsafe('DROP FUNCTION synthetic_recovery_evidence_failure()'); }
  expect((await prisma.callCaptureSession.findUniqueOrThrow({ where: { id: f.capture.id } })).withdrawal_drained_at).not.toBeNull();
  expect(await prisma.callConsentEvent.count({ where: { action: "withdraw" } })).toBe(0);
  expect((await f.post()).status).toBe(200); expect(hooks.send).not.toHaveBeenCalled();
});