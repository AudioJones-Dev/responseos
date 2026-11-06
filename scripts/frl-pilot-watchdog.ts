import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { PilotWatchdog, telnyxWatchdogTransport } from "../lib/communications/pilot/watchdog";

const configuration = z.object({
  applicationId: z.string().regex(/^\d+$/), deploymentId: z.string().min(1),
  closesAt: z.iso.datetime(), riskApprovalRef: z.string().min(1), dedicatedApplicationVerified: z.literal(true),
}).strict();

async function main() {
  let stopping = false;
  process.on("SIGTERM", () => { stopping = true; }); process.on("SIGINT", () => { stopping = true; });
  if (process.env.RESPONSEOS_FRL_WATCHDOG_ENABLED !== "true") {
    console.log("pilot_watchdog_disabled");
    while (!stopping && !process.argv.includes("--once")) await setTimeout(1000);
    return;
  }
  if (process.env.VERCEL_ENV === "production" || process.env.RESPONSEOS_REQUIRE_AUTH !== "true") throw new Error("watchdog_environment_denied");
  const c = configuration.parse(JSON.parse(process.env.RESPONSEOS_FRL_WATCHDOG_CONFIG ?? "null"));
  const key = process.env.RESPONSEOS_FRL_PILOT_TELNYX_API_KEY;
  if (!key || c.deploymentId !== process.env.RESPONSEOS_FRL_PILOT_DEPLOYMENT_ID) throw new Error("watchdog_binding_missing");
  const watchdog = new PilotWatchdog(telnyxWatchdogTransport(key, c.applicationId), process.env.RESPONSEOS_FRL_WATCHDOG_APPLY === "true", Date.parse(c.closesAt));
  do {
    try { console.log(JSON.stringify({ event: "pilot_watchdog_scan", ...await watchdog.scan(Date.now()) })); }
    catch { console.error("pilot_watchdog_scan_failed"); if (process.argv.includes("--once")) process.exitCode = 1; }
    if (process.argv.includes("--once")) break;
    await setTimeout(1000);
  } while (!stopping);
}
void main().catch(() => { console.error("pilot_watchdog_configuration_failed"); process.exitCode = 1; });
