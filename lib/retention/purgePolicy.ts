export type RetentionPurgeMode = "preview" | "apply";

interface RetentionPurgeEnvironment {
  DATABASE_URL?: string;
  RESPONSEOS_RETENTION_PURGE_ENABLED?: string;
  RESPONSEOS_INBOUND_ACCOUNT_ID?: string;
  RESPONSEOS_DEMO_ACCOUNT_ID?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}

export interface RetentionPurgeScope {
  inboundAccountId?: string;
  demoAccountId?: string;
}

export function parseRetentionPurgeArgs(argv: readonly string[]): RetentionPurgeMode {
  const unknown = argv.find((arg) => arg !== "--apply");
  if (unknown) throw new Error(`Unknown argument "${unknown}". The only flag is --apply.`);
  return argv.includes("--apply") ? "apply" : "preview";
}

export function assertRetentionPurgeAllowed(
  mode: RetentionPurgeMode,
  env: RetentionPurgeEnvironment,
): RetentionPurgeScope {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run the retention purge.");
  }
  if (mode === "apply") {
    if (env.RESPONSEOS_RETENTION_PURGE_ENABLED !== "true") {
      throw new Error(
        "RESPONSEOS_RETENTION_PURGE_ENABLED=true is required to apply the retention purge.",
      );
    }
    if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
      throw new Error("Applying the retention purge is disabled in production.");
    }
  }
  return {
    inboundAccountId: env.RESPONSEOS_INBOUND_ACCOUNT_ID || undefined,
    demoAccountId: env.RESPONSEOS_DEMO_ACCOUNT_ID || undefined,
  };
}
