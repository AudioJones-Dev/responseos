async function main() {
  const mode = process.env.RESPONSEOS_GROK_WATCHDOG_MODE ?? "inactive";
  if (mode === "inactive") {
    console.info("Grok watchdog inactive; no monitoring or disconnection evidence.");
    return;
  }
  if (mode !== "active") throw Error("grok_watchdog_unknown_mode");
  if (process.env.RESPONSEOS_GROK_WATCHDOG_ENABLED !== "true") throw Error("grok_watchdog_disabled");
  const { db } = await import("../lib/db/client");
  try {
    const { watchdogGrokSweep } = await import("../lib/grok/service");
    const { runGrokWatchdog } = await import("../lib/grok/watchdogLoop");
    const healthy = await runGrokWatchdog({
      loop: process.argv.includes("--loop"), sweep: watchdogGrokSweep,
      pause: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
      alert: (scope, event, occurrences) => console.error(event === "recovered"
        ? `Grok watchdog ${scope} reporting recovered after ${occurrences} observations; this is not disconnection evidence.`
        : `Grok watchdog ${scope === "session" ? "session failed; healthy sessions retain cadence" : "sweep incomplete"}; ${event}, ${occurrences} observations; independent operator intervention required. Consumed commands will not be retried.`),
    });
    if (!healthy) throw Error("grok_watchdog_sweep_failed");
  } finally {
    await db?.$disconnect();
  }
}
void main().catch(() => { console.error("Grok watchdog stopped; independent operator intervention required."); process.exitCode = 1; });
export {};
