import { spawn } from "node:child_process";

if (process.platform !== "linux" || process.version !== "v24.18.0") throw Error("Requires Linux Node 24.18.0");
const mode = process.argv[2] ?? "watchdog-inactive";
if (!["watchdog-inactive", "watchdog-inactive-service", "web-offline"].includes(mode) || process.argv.length > 3) throw Error("Unsupported local package mode");
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1",
  RESPONSEOS_REQUIRE_AUTH: "true", RESPONSEOS_QUALIFICATION_ACTIVATION: "DISABLED",
  RESPONSEOS_GROK_WATCHDOG_ENABLED: "false", RESPONSEOS_GROK_WATCHDOG_MODE: "inactive",
  RESPONSEOS_LIVE_HUBSPOT_ENABLED: "false", RESPONSEOS_LIVE_EMAIL_ENABLED: "false",
  ...(mode === "watchdog-inactive-service" ? { PORT: process.env.PORT } : {}),
};
const args = mode === "web-offline"
  ? ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"]
  : mode === "watchdog-inactive-service"
    ? ["scripts/grok-inactive-service.mjs"]
    : ["--import", "tsx", "scripts/grok-watchdog.ts"];
const child = spawn(process.execPath, args, { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));
child.once("error", () => { console.error("Local package process failed."); process.exitCode = 1; });
child.once("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
