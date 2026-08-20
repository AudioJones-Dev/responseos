import { PrismaClient } from "@prisma/client";
import { resetResponseOsDemoSandbox } from "../prisma/demo-sandbox";
import { assertDemoResetAllowed } from "../lib/demo/resetPolicy";

async function main() {
  assertDemoResetAllowed(process.env);
  const prisma = new PrismaClient();
  try {
    await resetResponseOsDemoSandbox(prisma);
  } finally {
    await prisma.$disconnect();
  }
  console.log("ResponseOS fictional demo sandbox reset completed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Demo reset failed.");
  process.exitCode = 1;
});
