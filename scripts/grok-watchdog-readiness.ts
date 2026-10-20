import { watchdogReady } from "../lib/grok/watchdogReadiness";

async function main() {
  const ready = await watchdogReady();
  console.info(JSON.stringify({ watchdogReady: ready, disconnectionEvidence: false }));
  process.exitCode = ready ? 0 : 1;
}
void main();
