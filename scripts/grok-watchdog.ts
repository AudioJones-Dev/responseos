import { watchdogGrokSweep } from "../lib/grok/service";
import { db } from "../lib/db/client";

async function main() {
  if (process.env.RESPONSEOS_GROK_WATCHDOG_ENABLED !== "true") throw Error("grok_watchdog_disabled");
  do {
    await watchdogGrokSweep();
    if (!process.argv.includes("--loop")) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (true);
}
void main().catch(() => { console.error("Grok watchdog stopped; independent operator intervention required."); process.exitCode = 1; }).finally(async () => { await db?.$disconnect(); });
