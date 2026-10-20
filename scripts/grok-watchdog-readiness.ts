import { watchdogReady } from "../lib/grok/watchdogReadiness";

const ready = watchdogReady();
console.info(JSON.stringify({ watchdogReady: ready, disconnectionEvidence: false }));
process.exitCode = ready ? 0 : 1;
