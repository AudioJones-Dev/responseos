import { PrismaClient } from "@prisma/client";

import { assertDemoResetAllowed } from "../lib/demo/resetPolicy";
import { RESPONSEOS_DEMO_ACCOUNT_ID } from "../lib/demo/constants";
import { resetResponseOsDemoSandbox } from "../prisma/demo-sandbox";

async function main(): Promise<void> {
  assertDemoResetAllowed(process.env);
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to reset the demo sandbox.");
  }

  const prisma = new PrismaClient();
  try {
    await resetResponseOsDemoSandbox(prisma);
    console.log(`Reset sandbox tenant ${RESPONSEOS_DEMO_ACCOUNT_ID}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
