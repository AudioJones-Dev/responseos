interface DemoResetEnvironment {
  RESPONSEOS_DEMO_RESET?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}

export function assertDemoResetAllowed(env: DemoResetEnvironment): void {
  if (env.RESPONSEOS_DEMO_RESET !== "true") {
    throw new Error(
      "RESPONSEOS_DEMO_RESET=true is required to reset the demo sandbox.",
    );
  }
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("The demo sandbox reset is disabled in production.");
  }
}
