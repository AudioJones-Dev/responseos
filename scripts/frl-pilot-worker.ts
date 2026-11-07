import { setTimeout } from "node:timers/promises";
import { runPilotCleanupOnce, runPilotWorkerOnce } from "../lib/communications/pilot/runtime";

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });
async function loop(iteration: () => Promise<boolean>) {
  do {
    try { await iteration(); }
    catch { console.error("frl_pilot_worker_iteration_failed"); process.exitCode = 1; }
    if (process.argv.includes("--once")) break;
    await setTimeout(1000);
  } while (!stopping);
}
void Promise.all([loop(runPilotWorkerOnce), loop(runPilotCleanupOnce)]);
