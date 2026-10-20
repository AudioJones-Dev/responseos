import { watchdogGrokSweep } from "../lib/grok/service";
import { db } from "../lib/db/client";
import { runGrokWatchdog } from "../lib/grok/watchdogLoop";

async function main() {
  if (process.env.RESPONSEOS_GROK_WATCHDOG_ENABLED !== "true") throw Error("grok_watchdog_disabled");
  const healthy = await runGrokWatchdog({
    loop: process.argv.includes("--loop"), sweep: watchdogGrokSweep,
    pause: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    alert: (scope, event, occurrences) => console.error(event === "recovered"
      ? `Grok watchdog ${scope} reporting recovered after ${occurrences} observations; this is not disconnection evidence.`
      : `Grok watchdog ${scope === "session" ? "session failed; healthy sessions retain cadence" : "sweep incomplete"}; ${event}, ${occurrences} observations; independent operator intervention required. Consumed commands will not be retried.`),
  });
  if (!healthy) throw Error("grok_watchdog_sweep_failed");
}
void main().catch(() => { console.error("Grok watchdog stopped; independent operator intervention required."); process.exitCode = 1; }).finally(async () => { await db?.$disconnect(); });
