import { watchdogGrokSweep } from "../lib/grok/service";
import { db } from "../lib/db/client";

async function main() {
  if (process.env.RESPONSEOS_GROK_WATCHDOG_ENABLED !== "true") throw Error("grok_watchdog_disabled");
  let failures = 0;
  do {
    try {
      const result = await watchdogGrokSweep();
      if (result.failed) throw Error("grok_watchdog_session_failure");
      failures = 0;
    } catch {
      failures += 1;
      console.error("Grok watchdog sweep incomplete; independent operator intervention required. Consumed commands will not be retried.");
      if (!process.argv.includes("--loop")) throw Error("grok_watchdog_sweep_failed");
    }
    if (!process.argv.includes("--loop")) break;
    await new Promise(resolve => setTimeout(resolve, Math.min(30000, 1000 * 2 ** Math.min(failures, 5))));
  } while (true);
}
void main().catch(() => { console.error("Grok watchdog stopped; independent operator intervention required."); process.exitCode = 1; }).finally(async () => { await db?.$disconnect(); });
