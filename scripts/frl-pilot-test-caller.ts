import { db } from "../lib/db/client";
import { loadPilotConfig } from "../lib/communications/pilot/config";
import { claimTestCaller, testCaller, testCallerRequest } from "../lib/communications/pilot/test-caller";
import { telnyxWatchdogTransport } from "../lib/communications/pilot/watchdog";

async function main() {
  const c = loadPilotConfig();
  if (!c) throw new Error("configuration_missing");
  testCallerRequest(c, Date.now(), process.env);
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ event: "test_caller_plan", from: testCaller.from, to: testCaller.to, digits: "1,2,*", capture: "off", dispatched: false }));
    return;
  }
  const key = process.env.RESPONSEOS_FRL_PILOT_TELNYX_API_KEY;
  if (!key || !db) throw new Error("runtime_missing");
  for (const app of [testCaller.applicationId, c.applicationId]) {
    if ((await telnyxWatchdogTransport(key, app).list()).length) throw new Error("active_calls_present");
  }
  const body = await claimTestCaller(db, c, process.env);
  // Never retry a dial here, including on timeout or process restart.
  const response = await fetch("https://api.telnyx.com/v2/calls", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000), redirect: "error",
  });
  const result = response.ok ? await response.json() : null;
  const accepted = response.ok && typeof result?.data?.call_control_id === "string";
  await db.auditLog.create({ data: { account_id: c.accountId, actor_type: "system", category: "workflow",
    action: "frl_pilot.test_caller_result", target_type: "FrlPilotWindow", target_id: c.windowId,
    metadata_json: { accepted, httpStatus: response.status } } });
  console.log(JSON.stringify({ event: "test_caller_dispatch", accepted, httpStatus: response.status, keypadVerified: false }));
  if (!accepted) process.exitCode = 1;
}
void main().catch(() => {
  console.error("test_caller_denied_or_uncertain_no_retry"); process.exitCode = 1;
}).finally(async () => { await db?.$disconnect(); });
