import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, rmdirSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { prisma, disconnectTestDb, resetAndSeedTestDb } from "./setup"
import { appendFrlInquiryEvent } from "@/lib/frl/persistence"

function pgEnvironment(database?: string) {
  const url = new URL(process.env.DATABASE_URL!)
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: database ?? url.pathname.slice(1) }
}
const binary = (name: string) => process.platform === "win32" ? `${name}.exe` : name
function sqlFile(file: string) {
  execFileSync(binary("psql"), ["-X", "-v", "ON_ERROR_STOP=1", "-f", file], { env: pgEnvironment(), stdio: "pipe" })
}
async function appendExample() {
  const previous = process.env.RESPONSEOS_DEV_SESSION
  process.env.RESPONSEOS_DEV_SESSION = "client_admin@org_mock_1"
  try {
    return await appendFrlInquiryEvent({ namespace: "frl.inquiry", schemaVersion: 2, type: "inbound_received", eventId: randomUUID(), inquiryId: randomUUID(),
      expectedRevision: 0, sourceChannel: "form", sourceEventId: randomUUID(), correlationId: "restore-test", occurredAt: "2026-10-07T17:00:00Z",
      data: { pathway: "repair", contextReference: "private:restore-test" } })
  } finally {
    if (previous === undefined) delete process.env.RESPONSEOS_DEV_SESSION
    else process.env.RESPONSEOS_DEV_SESSION = previous
  }
}

describe("FRL migration rollback and recovery", () => {
  beforeEach(resetAndSeedTestDb)
  afterAll(disconnectTestDb)

  it("reverses an empty installation and reapplies the forward migration", async () => {
    sqlFile("scripts/rollback-frl-persistence-empty.sql")
    try {
      expect(await prisma.$queryRaw`SELECT to_regclass('public."FrlInquiry"')::text AS name`).toEqual([{ name: null }])
      expect(await prisma.account.count()).toBeGreaterThan(0)
    } finally {
      sqlFile("prisma/migrations/0016_frl_inquiry_persistence/migration.sql")
    }
    expect((await appendExample()).status).toBe("blocked")
  })
  it("refuses destructive rollback once an event exists", async () => {
    await appendExample()
    expect(() => sqlFile("scripts/rollback-frl-persistence-empty.sql")).toThrow()
    expect(await prisma.frlInquiryEvent.count()).toBe(1)
    expect(await prisma.frlOutboxOperation.count()).toBe(1)
  })
  it("restores a populated backup with linkage and immutability intact", async () => {
    const receipt = await appendExample()
    const backupDir = mkdtempSync(path.join(tmpdir(), "frl-restore-test-"))
    const backupFile = path.join(backupDir, "fixture.dump")
    const restoreName = `frl_restore_${randomUUID().replaceAll("-", "")}`
    let created = false
    let restored: PrismaClient | undefined
    try {
      execFileSync(binary("pg_dump"), ["-Fc", "--no-owner", "--no-acl", "-f", backupFile], { env: pgEnvironment(), stdio: "pipe" })
      execFileSync(binary("createdb"), [restoreName], { env: pgEnvironment(), stdio: "pipe" }); created = true
      execFileSync(binary("pg_restore"), ["--exit-on-error", "--no-owner", "--no-acl", "-d", restoreName, backupFile], { env: pgEnvironment(), stdio: "pipe" })
      const url = new URL(process.env.DATABASE_URL!); url.pathname = `/${restoreName}`
      restored = new PrismaClient({ datasourceUrl: url.toString() })
      expect(await restored.frlInquiryEvent.findFirstOrThrow()).toMatchObject({ event_id: receipt.eventId, revision: 1 })
      expect(await restored.frlOutboxOperation.findFirstOrThrow()).toMatchObject({ event_id: receipt.eventId, operation_id: receipt.operationId, status: "blocked" })
      await expect(restored.frlInquiryEvent.deleteMany()).rejects.toThrow()
    } finally {
      await restored?.$disconnect()
      if (created) execFileSync(binary("dropdb"), [restoreName], { env: pgEnvironment(), stdio: "pipe" })
      rmSync(backupFile, { force: true }); rmdirSync(backupDir)
    }
  })
})
