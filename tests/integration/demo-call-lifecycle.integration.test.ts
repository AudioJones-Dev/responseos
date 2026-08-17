import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { DemoCallLifecycle } from "@/lib/data";
import { resetResponseOsDemoSandbox } from "@/prisma/demo-sandbox";
import {
  disconnectTestDb,
  prisma,
  resetAndSeedTestDb,
  setDevSession,
} from "./setup";

beforeEach(async () => {
  await resetAndSeedTestDb();
  setDevSession("aj_admin");
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("persisted sandbox demo lifecycle", () => {
  test("returns the complete simulated call lifecycle for the sandbox tenant", async () => {
    const result = await DemoCallLifecycle.getDemoCallLifecycle({
      accountId: "org_responseos_demo",
      callId: "call_responseos_demo",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.account).toMatchObject({
      id: "org_responseos_demo",
      account_type: "sandbox",
    });
    expect(result.data.call).toMatchObject({
      id: "call_responseos_demo",
      account_id: "org_responseos_demo",
    });
    expect(result.data.segments.length).toBeGreaterThan(1);
    expect(result.data.transcript?.retention_lane).toBe("redacted_only");
    expect(result.data.lead?.qualification?.qualification_status).toBe(
      "qualified",
    );
    expect(result.data.appointment?.status).toBe("confirmed");
    expect(result.data.workflow?.status).toBe("completed");
    expect(result.data.audit.map((entry) => entry.action)).toContain(
      "demo.lifecycle.persisted",
    );
    expect(result.data.outcome).toMatchObject({
      kind: "illustrative",
      verified: false,
    });
  });

  test("denies a tenant user access to the public sandbox account", async () => {
    setDevSession("client_admin@org_mock_1");

    const result = await DemoCallLifecycle.getDemoCallLifecycle({
      accountId: "org_responseos_demo",
      callId: "call_responseos_demo",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "tenant_scope_denied" },
    });
  });

  test("serves only the fixed public sandbox when hosted auth is required", async () => {
    delete process.env.RESPONSEOS_DEV_SESSION;
    process.env.RESPONSEOS_REQUIRE_AUTH = "true";
    try {
      const publicResult =
        await DemoCallLifecycle.getPublicDemoCallLifecycle();
      const sessionScopedResult =
        await DemoCallLifecycle.getDemoCallLifecycle({
          accountId: "org_responseos_demo",
          callId: "call_responseos_demo",
        });

      expect(publicResult.ok).toBe(true);
      expect(
        publicResult.ok && publicResult.data.account.id,
      ).toBe("org_responseos_demo");
      expect(sessionScopedResult).toMatchObject({
        ok: false,
        error: { code: "no_session" },
      });
    } finally {
      delete process.env.RESPONSEOS_REQUIRE_AUTH;
      setDevSession("aj_admin");
    }
  });

  test("reset restores deterministic sandbox state without touching another tenant", async () => {
    const customerBefore = await prisma.account.findUniqueOrThrow({
      where: { id: "org_mock_1" },
      select: { id: true, name: true, account_type: true },
    });
    await prisma.call.update({
      where: { id: "call_responseos_demo" },
      data: { summary: "mutated during reset test" },
    });

    await resetResponseOsDemoSandbox(prisma);
    const first = await DemoCallLifecycle.getPublicDemoCallLifecycle();
    await resetResponseOsDemoSandbox(prisma);
    const second = await DemoCallLifecycle.getPublicDemoCallLifecycle();

    expect(first).toEqual(second);
    expect(first.ok && first.data.call.summary).toBe(
      "Simulated caller requested an urgent water-heater assessment and accepted a service appointment.",
    );
    await expect(
      prisma.account.findUniqueOrThrow({
        where: { id: "org_mock_1" },
        select: { id: true, name: true, account_type: true },
      }),
    ).resolves.toEqual(customerBefore);
  });
});
