import { generateKeyPairSync, sign } from "node:crypto";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { canonicalProviderAttestationPayload } from "@/lib/prospectBootstrap/attestation";
import {
  SUPERVISED_RECEPTIONIST_TEMPLATE_CHECKSUM,
  SUPERVISED_RECEPTIONIST_TEMPLATE_VERSION,
} from "@/lib/agentExecution/supervisedTemplate";
import { configureSupervisedTenant } from "@/lib/agentExecution/supervisedTenant";
import { resolveSupervisedTenantForNumber } from "@/lib/agentExecution/supervisedRuntime";
import { resolveTelnyxEventAssignment } from "@/lib/prospectBootstrap/service";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

const GATE = "v0.3-live-communications";
const NUMBER = "+15555550188";
const PROVIDER_NUMBER_ID = "number-supervised-1";
const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const now = new Date("2026-09-11T12:00:00.000Z");

const CONSENT_RECORDING_OFF = {
  aiDisclosure: "This call is handled by an automated assistant.",
  transcription: { enabled: true },
  recording: { enabled: false },
  refusal: {
    acknowledgement: "Understood.",
    stopRecordingWhenSupported: true,
    offer: "transfer_or_callback",
    minimizeCollection: true,
  },
};

const CONFIGURATION = [
  { key: "business.knowledge", value: { facts: [{ topic: "services", statement: "Example demonstration service", sourceRef: "test-approval" }], fictionalScenarios: [] } },
  { key: "notification.completed_interaction.recipient", value: { channel: "email", recipient: "owner@example.test", event: "completed_interaction", enabled: true, temporary: true } },
  { key: "operating_hours.weekly", value: { type: "always_open" } },
  { key: "operating_hours.holidays", value: { type: "always_open" } },
  {
    key: "service_area.coverage",
    value: {
      regions: ["Example Region"],
      precision: "broad_region",
      countyInferenceAllowed: false,
      locationConfirmationRequired: true,
      collectFromCaller: ["city", "postal_code"],
    },
  },
  { key: "contact.escalation.primary", value: { name: "Example Owner", phone: "+15555550123" } },
  { key: "policy.consent", value: CONSENT_RECORDING_OFF },
];

function attestation(overrides: Record<string, unknown> = {}) {
  const payload = {
    provider: "telnyx",
    providerNumberId: PROVIDER_NUMBER_ID,
    e164: NUMBER,
    assistantId: "assistant-supervised-1",
    templateVersion: SUPERVISED_RECEPTIONIST_TEMPLATE_VERSION,
    templateChecksum: SUPERVISED_RECEPTIONIST_TEMPLATE_CHECKSUM,
    initializationWebhookConfigured: true,
    recordingEnabled: false,
    providerMemoryEnabled: false,
    allowedTools: ["hangup", "transfer"],
    transferDestinationE164: "+15555550123",
    insightGroupConfigured: true,
    messageHistoryUpdatesEnabled: true,
    numberRecordingEnabled: false,
    consentCaptureVerified: true,
    captureIntervalVerified: true,
    consentEvidenceRef: "test-evidence",
    attestedAt: new Date(now.getTime() - 60_000).toISOString(),
    expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
    ...overrides,
  };
  return {
    payload,
    signature: sign(null, Buffer.from(canonicalProviderAttestationPayload(payload)), keys.privateKey).toString("base64"),
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    accountSlug: "example-supervised",
    businessName: "Example Business",
    timezone: "America/New_York",
    agentName: "Sam",
    executionMode: "SUPERVISED_PILOT" as const,
    approvalRecordRef: "approval-record:integration",
    configuration: CONFIGURATION,
    ...overrides,
  };
}

describe("supervised tenant configuration", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    setDevSession("operator");
    process.env.RESPONSEOS_AUTHORIZED_EXECUTION_GATES = GATE;
    process.env.RESPONSEOS_PROVIDER_ATTESTATION_PUBLIC_KEY = publicKey;
    process.env.RESPONSEOS_DEMO_PHONE_E164 = "+17867560897";
  });
  afterAll(disconnectTestDb);

  test("a dry run reports readiness and writes nothing", async () => {
    const result = await configureSupervisedTenant(input({ dryRun: true }), now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({ dryRun: true, gateAuthorized: true, activated: false });
    expect(result.data.configuration.ready).toBe(true);
    expect(result.data.configuration.hash).toBeNull();
    expect(await prisma.account.findUnique({ where: { slug: "example-supervised" } })).toBeNull();
  });

  test("refuses a tenant user and an unrecognised configuration key", async () => {
    setDevSession("client_admin@org_mock_1");
    expect(await configureSupervisedTenant(input(), now)).toMatchObject({ ok: false, error: { code: "role_denied" } });

    setDevSession("operator");
    const rejected = await configureSupervisedTenant(
      input({ configuration: [...CONFIGURATION, { key: "contact.escalation.primary", value: { name: "TBD", phone: "+15555550123" } }] }),
      now,
    );
    expect(rejected).toMatchObject({ ok: false, error: { code: "validation_failed" } });
    expect(JSON.stringify(rejected)).not.toContain("+15555550123");
  });

  test("creates the account, a disabled profile, and one approved snapshot that is reused unchanged", async () => {
    const first = await configureSupervisedTenant(input(), now);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.configuration).toMatchObject({ version: 1, unchanged: false, ready: true });

    const account = await prisma.account.findUnique({ where: { slug: "example-supervised" } });
    expect(account?.status).toBe("active");
    const profile = await prisma.agentProfile.findFirst({ where: { account_id: account!.id } });
    expect(profile).toMatchObject({ type: "supervised_receptionist", enabled: false, name: "Sam" });

    const second = await configureSupervisedTenant(input(), new Date(now.getTime() + 60_000));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.configuration).toMatchObject({ version: 1, unchanged: true });
    expect(await prisma.businessMemorySnapshot.count({ where: { account_id: account!.id } })).toBe(1);
  });

  test("revokes the previous snapshot when the configuration changes", async () => {
    await configureSupervisedTenant(input(), now);
    const changed = await configureSupervisedTenant(
      input({
        configuration: [
          ...CONFIGURATION.filter((entry) => entry.key !== "operating_hours.weekly"),
          {
            key: "operating_hours.weekly",
            value: {
              type: "schedule",
              timezone: "America/New_York",
              days: [{ day: "monday", closed: false, opensAt: "08:00", closesAt: "17:00" }],
            },
          },
        ],
      }),
      new Date(now.getTime() + 120_000),
    );
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.data.configuration.version).toBe(2);
    const snapshots = await prisma.businessMemorySnapshot.findMany({ orderBy: { version: "asc" } });
    expect(snapshots.map((snapshot) => snapshot.status)).toEqual(["revoked", "approved"]);
  });

  test("stops before any write when the number is the legacy demo number", async () => {
    process.env.RESPONSEOS_DEMO_PHONE_E164 = NUMBER;
    const result = await configureSupervisedTenant(
      input({ number: { providerNumberId: PROVIDER_NUMBER_ID, e164: NUMBER, providerAttestation: attestation() } }),
      now,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "configuration_stopped" } });
    expect(await prisma.account.findUnique({ where: { slug: "example-supervised" } })).toBeNull();
  });

  test("stops when the number already serves another tenant", async () => {
    const other = await prisma.account.create({
      data: { name: "Other", slug: "other-tenant", industry: "home-services", timezone: "America/New_York" },
    });
    const number = await prisma.telephonyNumber.create({
      data: { provider: "telnyx", provider_number_id: PROVIDER_NUMBER_ID, e164: NUMBER, status: "assigned" },
    });
    await prisma.telephonyNumberAssignment.create({
      data: {
        account_id: other.id,
        telephony_number_id: number.id,
        provider_assistant_id: "assistant-other",
        status: "active",
        activated_at: now,
      },
    });

    const result = await configureSupervisedTenant(
      input({ number: { providerNumberId: PROVIDER_NUMBER_ID, e164: NUMBER, providerAttestation: attestation() } }),
      now,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "configuration_stopped" } });
    if (!result.ok) expect(result.error.details?.stops).toContain("number_assigned_elsewhere");
  });

  test("refuses an attestation whose recording posture contradicts the tenant's", async () => {
    const result = await configureSupervisedTenant(
      input({
        number: {
          providerNumberId: PROVIDER_NUMBER_ID,
          e164: NUMBER,
          providerAttestation: attestation({ recordingEnabled: true, numberRecordingEnabled: true }),
        },
      }),
      now,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "assistant_recording_policy_mismatch" } });
  });

  test("activates, resolves the tenant for its number, and never resolves as a prospect", async () => {
    const result = await configureSupervisedTenant(
      input({
        activate: true,
        number: { providerNumberId: PROVIDER_NUMBER_ID, e164: NUMBER, providerAttestation: attestation() },
      }),
      now,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.activated).toBe(true);

    const runtime = await resolveSupervisedTenantForNumber(NUMBER, new Date(now.getTime() + 60_000));
    expect(runtime).toMatchObject({
      accountName: "Example Business",
      agentName: "Sam",
      numberE164: NUMBER,
      readiness: { ready: true, missing: [], conflicts: [] },
    });
    expect(runtime?.resolved.mode).toBe("SUPERVISED_PILOT");
    expect(runtime?.resolved.policy.crmSyncEnabled).toBe(true);
    expect(runtime?.resolved.policy.recordingEnabled).toBe(false);

    // Ownership follows the assignment interval, not the current holder: once
    // the number is released, an event from inside the interval still resolves
    // to this tenant and an event from after it resolves to nobody.
    const assignment = await prisma.telephonyNumberAssignment.findFirstOrThrow({ where: { account_id: runtime!.accountId, status: "active" } });
    await prisma.telephonyNumberAssignment.update({ where: { id: assignment.id }, data: { status: "released", unassigned_at: new Date(now.getTime() + 2 * 60 * 60_000) } });
    expect((await resolveSupervisedTenantForNumber(NUMBER, new Date(now.getTime() + 60 * 60_000)))?.accountId).toBe(runtime!.accountId);
    expect(await resolveSupervisedTenantForNumber(NUMBER, new Date(now.getTime() + 3 * 60 * 60_000))).toBeNull();
    expect(await resolveSupervisedTenantForNumber(NUMBER, new Date(now.getTime() - 60_000))).toBeNull();

    // The prospect resolver must not claim a bootstrap-less assignment.
    expect(
      await resolveTelnyxEventAssignment({
        target: NUMBER,
        occurredAt: new Date(now.getTime() + 60_000),
        receivedAt: new Date(now.getTime() + 60_000),
      }),
    ).toBeNull();
  });

  test("degrades to the demo policy when the lane authorizes no gate", async () => {
    await configureSupervisedTenant(
      input({
        activate: true,
        number: { providerNumberId: PROVIDER_NUMBER_ID, e164: NUMBER, providerAttestation: attestation() },
      }),
      now,
    );
    delete process.env.RESPONSEOS_AUTHORIZED_EXECUTION_GATES;

    const runtime = await resolveSupervisedTenantForNumber(NUMBER, new Date(now.getTime() + 60_000));
    expect(runtime?.resolved.mode).toBe("PROSPECT_DEMO");
    expect(runtime?.resolved.degraded).toBe("gate_not_authorized");
    expect(runtime?.resolved.policy.crmSyncEnabled).toBe(false);
  });

  test("active tenant edits require explicit reactivation and a fresh complete preflight", async () => {
    const activated = await configureSupervisedTenant(input({ activate: true,
      number: { providerNumberId: PROVIDER_NUMBER_ID, e164: NUMBER, providerAttestation: attestation() },
    }), now);
    expect(activated.ok).toBe(true);
    if (!activated.ok) return;
    const before = await prisma.agentProfile.findUniqueOrThrow({ where: { id: activated.data.profileId! } });
    const firstActivation = await prisma.telephonyNumberAssignment.findFirstOrThrow({ where: { account_id: before.account_id, status: "active" } });
    for (const dryRun of [true, false]) {
      const update = await configureSupervisedTenant(input({ executionMode: "MANAGED_AUTONOMY", dryRun }), now);
      expect(update).toMatchObject({ ok: false, error: { code: "configuration_stopped" } });
      if (!update.ok) expect(update.error.details?.stops).toContain("active_tenant_requires_activation");
    }
    const missingNumber = await configureSupervisedTenant(input({ activate: true }), now);
    expect(missingNumber).toMatchObject({ ok: false, error: { code: "configuration_stopped" } });
    expect(await prisma.agentProfile.findUnique({ where: { id: before.id } })).toEqual(before);
    expect(await prisma.businessMemorySnapshot.count({ where: { account_id: before.account_id } })).toBe(1);
    const valid = await configureSupervisedTenant(input({ activate: true,
      number: { providerNumberId: PROVIDER_NUMBER_ID, e164: NUMBER, providerAttestation: attestation() },
    // Half an hour later: inside the attestation's one-hour validity, but far
    // enough that a reset activated_at would be observable.
    }), new Date(now.getTime() + 30 * 60_000));
    expect(valid.ok && valid.data.activated).toBe(true);
    // Reactivating a continuously active number keeps its original activation
    // time, so webhooks that occurred before the reconfiguration still resolve.
    const reactivated = await prisma.telephonyNumberAssignment.findUniqueOrThrow({ where: { id: firstActivation.id } });
    expect(reactivated.status).toBe("active");
    expect(reactivated.activated_at).toEqual(firstActivation.activated_at);
  });

  test("an identity-only reconfiguration of an inactive tenant is audited", async () => {
    const first = await configureSupervisedTenant(input({}), now);
    expect(first.ok).toBe(true);
    const renamed = await configureSupervisedTenant(input({ businessName: "Renamed Business", agentName: "Alex", industry: "mobility-equipment" }), new Date(now.getTime() + 60_000));
    expect(renamed.ok).toBe(true);
    const audits = await prisma.auditLog.findMany({ where: { action: "supervised_tenant.identity_updated" } });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.metadata_json).toMatchObject({ businessName: { from: "Example Business", to: "Renamed Business" }, agentName: { from: "Sam", to: "Alex" }, industry: { from: "home-services", to: "mobility-equipment" } });
    expect((await prisma.account.findUniqueOrThrow({ where: { slug: "example-supervised" } })).industry).toBe("mobility-equipment");
    // An unchanged resubmission writes no identity audit.
    await configureSupervisedTenant(input({ businessName: "Renamed Business", agentName: "Alex" }), new Date(now.getTime() + 120_000));
    expect(await prisma.auditLog.count({ where: { action: "supervised_tenant.identity_updated" } })).toBe(1);
  });

  test("refuses activation while the configuration is incomplete", async () => {
    const result = await configureSupervisedTenant(
      input({
        activate: true,
        configuration: CONFIGURATION.filter((entry) => entry.key !== "policy.consent"),
        number: { providerNumberId: PROVIDER_NUMBER_ID, e164: NUMBER, providerAttestation: attestation() },
      }),
      now,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "configuration_stopped" } });
    if (!result.ok) expect(result.error.details?.stops).toContain("operating_configuration_incomplete");
  });

  test("transcription-disabled configuration cannot activate the transcript review workflow", async () => {
    const result = await configureSupervisedTenant(input({ activate: true,
      configuration: CONFIGURATION.map((entry) => entry.key === "policy.consent" ? { ...entry, value: { ...CONSENT_RECORDING_OFF, transcription: { enabled: false } } } : entry),
      number: { providerNumberId: PROVIDER_NUMBER_ID, e164: NUMBER, providerAttestation: attestation() },
    }), now);
    expect(result).toMatchObject({ ok: false, error: { code: "configuration_stopped" } });
    if (!result.ok) expect(result.error.details?.stops).toContain("transcription_required_for_review");
  });

  test("activation refuses a context that exceeds the provider bound", async () => {
    const result = await configureSupervisedTenant(input({ activate: true, businessName: "B".repeat(24_000), number: { providerNumberId: PROVIDER_NUMBER_ID, e164: NUMBER, providerAttestation: attestation() } }), now);
    expect(result).toMatchObject({ ok: false, error: { details: { stops: expect.arrayContaining(["agent_context_invalid"]) } } });
    expect(await prisma.account.findUnique({ where: { slug: "example-supervised" } })).toBeNull();
  });

  test("number replacement stops before writing a second active assignment", async () => {
    const original = await configureSupervisedTenant(input({ activate: true, number: { providerNumberId: PROVIDER_NUMBER_ID, e164: NUMBER, providerAttestation: attestation() } }), now);
    expect(original.ok).toBe(true);
    const replacement = { providerNumberId: "number-replacement", e164: "+15555550189" };
    const result = await configureSupervisedTenant(input({ activate: true, number: { ...replacement, providerAttestation: attestation(replacement) } }), now);
    expect(result).toMatchObject({ ok: false, error: { details: { stops: expect.arrayContaining(["dedicated_number_change_requires_release"]) } } });
    expect(await prisma.telephonyNumberAssignment.count({ where: { status: "active", bootstrap_id: null } })).toBe(1);
  });
});
