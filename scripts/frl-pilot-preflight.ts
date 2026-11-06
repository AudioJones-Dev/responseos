import { loadPilotConfig, pilotOpen } from "../lib/communications/pilot/config";

const c = loadPilotConfig();
const checks = {
  validProtectedConfiguration: !!c,
  applicationDurationPolicyAcknowledged: c?.durationPolicy.mode === "application_watchdog",
  watchdogPrerequisiteRecorded: c?.exercise === "keypad" ? c.commissioning.watchdogInventoryVerified : c?.durationPolicy.independentWatchdogVerified === true,
  manualStopPrerequisiteRecorded: c?.exercise === "keypad" ? c.commissioning.manualProviderStopAvailable : c?.durationPolicy.manualStopVerified === true,
  authorizedWindowOpen: !!c && pilotOpen(c, Date.now()),
  signedIngestEnabled: process.env.RESPONSEOS_LIVE_TELNYX_INGEST_ENABLED === "true" && !!process.env.TELNYX_PUBLIC_KEY,
  workerEnabled: process.env.RESPONSEOS_FRL_PILOT_WORKER_ENABLED === "true",
  dedicatedCredentialPresent: !!process.env.RESPONSEOS_FRL_PILOT_TELNYX_API_KEY,
  databaseConfigured: !!process.env.DATABASE_URL,
  authenticationRequired: process.env.RESPONSEOS_REQUIRE_AUTH === "true" && !!process.env.CLERK_SECRET_KEY,
};
console.log(JSON.stringify({ exercise: c?.exercise ?? null, checks, configurationReady: Object.values(checks).every(Boolean), liveReadinessVerified: false }, null, 2));
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
