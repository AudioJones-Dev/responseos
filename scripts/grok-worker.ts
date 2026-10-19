import { runGrokWorker } from "../lib/grok/service";

async function main() {
  if (process.env.RESPONSEOS_GROK_WORKER_ENABLED !== "true" || !process.argv[2]) throw Error("grok_worker_disabled");
  await runGrokWorker(process.argv[2]);
}
void main().catch(() => { console.error("Grok worker stopped; no provider values disclosed."); process.exitCode = 1; });
