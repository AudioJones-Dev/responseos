import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { endCallAttemptStatus } from "@/lib/callReview/endCallStatus";
import { ConsentControls } from "@/app/(admin)/admin/demo-operations/ConsentControls";
import { EndCallControls } from "@/app/(admin)/admin/demo-operations/EndCallControls";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const command = { id: "row", account_id: "account", capture_session_id: "capture", assignment_id: "assignment", provider_resource: "call", command_id: "uuid", generation: 1, status: "uncertain", provider_response_status: null };
const request = { action: "call_end_requested", actor_type: "user", actor_user_id: "operator", metadata_json: { commandId: "uuid", generation: 1 } };
const witness = { action: "call_end_authorized", actor_type: "user", actor_user_id: "operator", metadata_json: { authority: "one_shot_after_commit", commandId: "uuid", commandRowId: "row", accountId: "account", captureId: "capture", assignmentId: "assignment", callControlId: "call", generation: 1 } };
const target = { captureId: "capture", expectedAccountId: "account", expectedProviderCallId: "call", generation: 1 };

test.each(["operator", "system", "unknown"] as const)("%s reservation wording never asserts permanently unsent", origin => {
  const audits = origin === "unknown" ? [] : origin === "operator" ? [request] : [{ ...request, actor_type: "system", actor_user_id: null }];
  const status = endCallAttemptStatus(command, audits);
  expect(status.origin).toBe(origin); expect(status.authorizationRecorded).toBe(false);
  expect(status.message).toContain("No retry");
  expect(status.message).toContain(origin === "operator" ? "does not prove it was unsent" : "may already have sent");
  const html = renderToStaticMarkup(createElement(EndCallControls, { target, confirmed: false, eligibility: { allowed: false, reason: "hangup_already_claimed" }, attempts: [status] }));
  expect(html).toContain(origin === "operator" ? "Operator attempt reserved" : origin === "system" ? "Automatic/system" : "origin unknown");
  expect(html).toMatch(/disabled="">End call/);
});

test("matching operator witness records authorization but never proves delivery", () => {
  const status = endCallAttemptStatus(command, [request,witness]);
  expect(status.authorizationRecorded).toBe(true); expect(status.message).toContain("delivery is not proved");
  const accepted = endCallAttemptStatus({ ...command, status: "succeeded", provider_response_status: 200 }, [request,witness]);
  expect(accepted.message).toContain("HTTP 200"); expect(accepted.message).toContain("not confirmed disconnection");
});

test.each(["commandId", "accountId", "captureId", "callControlId", "generation"])("mismatched witness %s cannot upgrade authorization display", field => {
  expect(endCallAttemptStatus(command, [request,{ ...witness, metadata_json: { ...witness.metadata_json, [field]: "wrong" } }]).authorizationRecorded).toBe(false);
});

test("missing or conflicting origin remains unknown even with a witness", () => {
  expect(endCallAttemptStatus(command, [witness]).origin).toBe("unknown");
  expect(endCallAttemptStatus(command, [request,{ ...request, actor_type: "system", actor_user_id: null },witness]).origin).toBe("unknown");
});

test("database continuation is labelled separately from effect-capable withdrawal retry", () => {
  const html = renderToStaticMarkup(createElement(ConsentControls, { id: "capture", callReference: "call", terminal: true, databaseRecoveryTarget: { ...target, receiptId: "receipt" } }));
  expect(html).toContain("Continue database processing (no provider action)");
  expect(html).toContain("Retry withdrawal (may send AI stop)");
  expect(html).toContain("event key comes from the saved receipt");
  expect(html).toContain("classified using the current call state");
  expect(html).toContain("Another withdrawal request may independently send AI stop");
  expect(html).toMatch(/disabled="">Record grant/); expect(html).toMatch(/disabled="">Record refuse/);
});

test("without an existing receipt the console offers no database continuation", () => {
  expect(renderToStaticMarkup(createElement(ConsentControls, { id: "capture", callReference: "call", terminal: true }))).not.toContain("Continue database processing (no provider action)");
});