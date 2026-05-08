import { beforeAll, expect, test } from "vitest";
import {
  connectTestDb,
  runPrismaCommand,
  seedTestDb,
  snapshotDb,
} from "./setup";

beforeAll(async () => {
  await connectTestDb();
});

test("seed is byte-deterministic across consecutive fresh database resets", async () => {
  runPrismaCommand(["migrate", "reset", "--force", "--skip-seed"]);
  seedTestDb();
  const first = await snapshotDb();

  runPrismaCommand(["migrate", "reset", "--force", "--skip-seed"]);
  seedTestDb();
  const second = await snapshotDb();

  expect(second).toEqual(first);
});
