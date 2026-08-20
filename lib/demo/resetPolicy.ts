interface DemoResetEnvironment {
  RESPONSEOS_DEMO_RESET?: string;
  RESPONSEOS_DEPLOYMENT_LANE?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}

export function assertDemoResetAllowed(env: DemoResetEnvironment): void {
  if (env.RESPONSEOS_DEMO_RESET !== "true") {
    throw new Error("RESPONSEOS_DEMO_RESET=true is required to reset the demo sandbox.");
  }
  if (env.RESPONSEOS_DEPLOYMENT_LANE !== "mock-staging") {
    throw new Error("Demo reset is allowed only in the mock-staging deployment lane.");
  }
  if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
    throw new Error("The demo sandbox reset is disabled in production.");
  }
}
