interface PurgeEnvironment {
  RESPONSEOS_PROSPECT_PURGE_ENABLED?: string;
  RESPONSEOS_INBOUND_ACCOUNT_ID?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}

export function assertProspectPurgeAllowed(env: PurgeEnvironment): string {
  if (env.RESPONSEOS_PROSPECT_PURGE_ENABLED !== "true") {
    throw new Error(
      "RESPONSEOS_PROSPECT_PURGE_ENABLED=true is required to purge prospect PII.",
    );
  }
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("Prospect PII purge is disabled in production.");
  }
  if (!env.RESPONSEOS_INBOUND_ACCOUNT_ID) {
    throw new Error("RESPONSEOS_INBOUND_ACCOUNT_ID is required.");
  }
  return env.RESPONSEOS_INBOUND_ACCOUNT_ID;
}
