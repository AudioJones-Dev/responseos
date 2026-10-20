import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute } from "node:path";

export const WATCHDOG_FRESHNESS_MS = 3000;

export function watchdogBinding(requireFile = true) {
  const file = process.env.RESPONSEOS_GROK_WATCHDOG_READINESS_FILE;
  const applicationSha = process.env.RESPONSEOS_APPLICATION_SHA;
  const controlSha = process.env.RESPONSEOS_CONTROL_SHA;
  const instanceId = process.env.RESPONSEOS_GROK_WATCHDOG_INSTANCE;
  if (process.env.RESPONSEOS_GROK_WATCHDOG_MODE !== "active" ||
      process.env.RESPONSEOS_GROK_WATCHDOG_ENABLED !== "true" ||
      (requireFile && (!file || !isAbsolute(file))) || !/^[0-9a-f]{40}$/.test(applicationSha ?? "") ||
      !/^[0-9a-f]{40}$/.test(controlSha ?? "") || !/^[A-Za-z0-9_-]{16,128}$/.test(instanceId ?? "")) {
    throw Error("grok_watchdog_not_ready");
  }
  return { file: file!, applicationSha: applicationSha!, controlSha: controlSha!, instanceId: instanceId! };
}

export function localWatchdogReady(now = Date.now()) {
  try {
    const expected = watchdogBinding(), bytes = readFileSync(expected.file, "utf8");
    if (bytes.length > 1024) return false;
    const proof = JSON.parse(bytes);
    return proof.version === 1 && proof.mode === "active" && proof.loop === true &&
      proof.applicationSha === expected.applicationSha && proof.controlSha === expected.controlSha &&
      proof.instanceId === expected.instanceId && Number.isSafeInteger(proof.completedAt) &&
      Number.isFinite(now) && now >= proof.completedAt && now - proof.completedAt < WATCHDOG_FRESHNESS_MS;
  } catch { return false; }
}

export function createWatchdogReadinessWriter() {
  const expected = watchdogBinding();
  function clear() { rmSync(expected.file, { force: true }); }
  clear();
  return {
    clear,
    completed(healthy: boolean) {
      if (!healthy) { clear(); return; }
      const temporary = `${expected.file}.${randomUUID()}.tmp`;
      try {
        writeFileSync(temporary, JSON.stringify({
          version: 1, mode: "active", loop: true,
          applicationSha: expected.applicationSha, controlSha: expected.controlSha,
          instanceId: expected.instanceId, completedAt: Date.now(),
        }), { flag: "wx", mode: 0o600 });
        renameSync(temporary, expected.file);
      } finally { rmSync(temporary, { force: true }); }
    },
  };
}

export async function watchdogReady(now = Date.now()) {
  const transport = process.env.RESPONSEOS_GROK_WATCHDOG_READINESS_TRANSPORT ?? "local-file";
  if (transport === "local-file") return localWatchdogReady(now);
  if (transport !== "signed-https") return false;
  const { remoteWatchdogReady } = await import("./watchdogRemoteReadiness");
  return remoteWatchdogReady();
}
