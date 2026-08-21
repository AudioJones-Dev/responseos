import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  activateProspectBootstrap,
  acknowledgeImportedBootstrapPromotion,
  approveQuarantinedNumberReuse,
  assignTelephonyNumber,
  cleanupExpiredProspectBootstraps,
  completeProspectBootstrap,
  createAndApproveMemorySnapshot,
  createManualKnowledgeFact,
  createProspectBootstrap,
  getProspectBootstrapDetail,
  ingestProspectBootstrap,
  importBootstrapPromotion,
  exportBootstrapPromotion,
  expireDueProspectBootstraps,
  purgeExpiredProspectContent,
  registerTelephonyNumber,
  releaseQuarantinedAssignments,
  resolveActiveProspectAgentContext,
  resolveTelnyxEventAssignment,
  reviewKnowledgeFact,
} from "@/lib/prospectBootstrap/service";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";
import { PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM } from "@/lib/prospectBootstrap/template";
import { canonicalProviderAttestationPayload } from "@/lib/prospectBootstrap/attestation";

const startedAt = new Date("2026-08-20T16:00:00.000Z");
const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
const providerAttestationKeys = generateKeyPairSync("ed25519");
const providerAttestationPublicKey = providerAttestationKeys.publicKey.export({ type: "spki", format: "pem" }).toString();

function providerAttestation(params: { providerNumberId: string; e164: string; assistantId: string }) {
  const payload = {
    provider: "telnyx" as const,
    providerNumberId: params.providerNumberId,
    e164: params.e164,
    assistantId: params.assistantId,
    templateVersion: "home-services-receptionist.v1",
    templateChecksum: PROSPECT_RECEPTIONIST_TEMPLATE_CHECKSUM,
    initializationWebhookConfigured: true,
    recordingEnabled: false,
    providerMemoryEnabled: false,
    allowedTools: ["hangup"],
    attestedAt: startedAt.toISOString(),
    expiresAt: new Date(startedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
  return {
    payload,
    signature: sign(null, Buffer.from(canonicalProviderAttestationPayload(payload)), providerAttestationKeys.privateKey).toString("base64"),
  };
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.data;
}

function websiteFetch(businessName: string, phone: string): typeof fetch {
  return async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow:", { status: 200, headers: { "content-type": "text/plain" } });
    }
    return new Response(`${businessName}. Call ${phone} for roof repair.`, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  };
}

async function prepareActiveProspect(params: {
  businessName: string;
  website: string;
  phone: string;
  providerNumberId: string;
  assistantId: string;
}) {
  const created = unwrap(await createProspectBootstrap({ businessName: params.businessName, canonicalWebsite: params.website }));
  unwrap(await ingestProspectBootstrap({
    bootstrapId: created.bootstrap.id,
    fetchFn: websiteFetch(params.businessName, params.phone),
    lookupFn: publicLookup,
    now: startedAt,
  }));
  const detail = unwrap(await getProspectBootstrapDetail(created.bootstrap.id));
  for (const fact of detail.facts) {
    if (fact.status === "source_observed") {
      unwrap(await reviewKnowledgeFact({ factId: fact.id, status: "operator_approved_for_demo" }));
    }
  }
  unwrap(await createAndApproveMemorySnapshot({ bootstrapId: created.bootstrap.id, reviewAcknowledged: true }));
  const number = unwrap(await registerTelephonyNumber({
    providerNumberId: params.providerNumberId,
    e164: params.phone,
    providerAttestation: providerAttestation({
      providerNumberId: params.providerNumberId,
      e164: params.phone,
      assistantId: params.assistantId,
    }),
  }, startedAt));
  const assigned = unwrap(await assignTelephonyNumber({
    bootstrapId: created.bootstrap.id,
    telephonyNumberId: number.id,
  }, startedAt));
  expect(assigned.bootstrap).toMatchObject({ status: "ready", expires_at: expect.any(Date) });
  const unacknowledgedActivation = await activateProspectBootstrap({
    bootstrapId: created.bootstrap.id,
    activationAcknowledged: false,
  }, startedAt);
  expect(unacknowledgedActivation.ok).toBe(false);
  if (!unacknowledgedActivation.ok) expect(unacknowledgedActivation.error.code).toBe("activation_acknowledgment_required");
  unwrap(await activateProspectBootstrap({ bootstrapId: created.bootstrap.id, activationAcknowledged: true }, startedAt));
  return { ...created, number };
}

describe("personalized prospect bootstrap persistence and isolation", () => {
  beforeEach(async () => {
    await resetAndSeedTestDb();
    setDevSession("aj_admin");
    process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED = "true";
    process.env.RESPONSEOS_PROVIDER_ATTESTATION_PUBLIC_KEY = providerAttestationPublicKey;
  });
  afterAll(async () => {
    delete process.env.RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED;
    delete process.env.RESPONSEOS_PROMOTION_IMPORT_ENABLED;
    delete process.env.RESPONSEOS_PROVIDER_ATTESTATION_PUBLIC_KEY;
    await disconnectTestDb();
  });

  test("requires explicit review acknowledgment and keeps manual corrections source-bound", async () => {
    const alpha = unwrap(await createProspectBootstrap({
      businessName: "Review Alpha",
      canonicalWebsite: "https://review-alpha.example/",
    }));
    unwrap(await ingestProspectBootstrap({
      bootstrapId: alpha.bootstrap.id,
      fetchFn: websiteFetch("Review Alpha", "+13055550121"),
      lookupFn: publicLookup,
      now: startedAt,
    }));
    const beta = unwrap(await createProspectBootstrap({
      businessName: "Review Beta",
      canonicalWebsite: "https://review-beta.example/",
    }));
    unwrap(await ingestProspectBootstrap({
      bootstrapId: beta.bootstrap.id,
      fetchFn: websiteFetch("Review Beta", "+13055550122"),
      lookupFn: publicLookup,
      now: startedAt,
    }));
    const alphaDetail = unwrap(await getProspectBootstrapDetail(alpha.bootstrap.id));
    const betaDetail = unwrap(await getProspectBootstrapDetail(beta.bootstrap.id));
    const source = alphaDetail.sources[0];
    const crossTenant = await createManualKnowledgeFact({
      bootstrapId: beta.bootstrap.id,
      sourceId: source.id,
      factKey: "service.statement",
      value: "Roof repair",
      evidenceExcerpt: "roof repair",
    });
    expect(crossTenant.ok).toBe(false);
    if (!crossTenant.ok) expect(crossTenant.error.code).toBe("source_unavailable");
    const manual = unwrap(await createManualKnowledgeFact({
      bootstrapId: alpha.bootstrap.id,
      sourceId: source.id,
      factKey: "service.statement",
      value: "Roof repair",
      evidenceExcerpt: "roof repair",
    }));
    expect(manual).toMatchObject({ status: "source_observed", source_id: source.id });
    expect(manual.source_evidence_json).toEqual([expect.objectContaining({
      sourceId: source.id,
      sourceUrl: source.normalized_url,
      contentHash: source.content_hash,
      evidenceExcerptHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })]);
    unwrap(await reviewKnowledgeFact({ factId: manual.id, status: "operator_approved_for_demo" }));
    const unacknowledged = await createAndApproveMemorySnapshot({
      bootstrapId: alpha.bootstrap.id,
      reviewAcknowledged: false,
    });
    expect(unacknowledged.ok).toBe(false);
    if (!unacknowledged.ok) expect(unacknowledged.error.code).toBe("review_acknowledgment_required");
    const approved = unwrap(await createAndApproveMemorySnapshot({
      bootstrapId: alpha.bootstrap.id,
      reviewAcknowledged: true,
    }));
    expect(approved.snapshot.memory_json).toMatchObject({
      services: [expect.objectContaining({
        reviewedBy: expect.any(String),
        reviewedAt: expect.any(String),
        confidence: null,
        sourceEvidence: [expect.objectContaining({ sourceId: source.id })],
      })],
    });
    const memory = approved.snapshot.memory_json as { services: Array<{ sourceEvidence: Array<Record<string, unknown>> }> };
    expect(memory.services[0].sourceEvidence[0]).not.toHaveProperty("evidenceExcerpt");
    expect(betaDetail.account?.id).not.toBe(alpha.account.id);
  });

  test("expires abandoned pre-activation bootstraps and starts the cleanup clock", async () => {
    const created = unwrap(await createProspectBootstrap({
      businessName: "Abandoned Review",
      canonicalWebsite: "https://abandoned.example/",
    }));
    const dueAt = new Date("2026-08-21T00:00:00.000Z");
    await prisma.prospectBootstrap.update({ where: { id: created.bootstrap.id }, data: {
      review_expires_at: new Date("2026-08-20T00:00:00.000Z"),
    } });
    expect(unwrap(await expireDueProspectBootstraps(dueAt))).toEqual({ expired: 1 });
    expect(await prisma.prospectBootstrap.findUnique({ where: { id: created.bootstrap.id } })).toMatchObject({
      status: "expired",
      review_expires_at: null,
      expires_at: dueAt,
    });
  });

  test("keeps two simultaneous prospect contexts isolated by assigned destination", async () => {
    const alpha = await prepareActiveProspect({
      businessName: "Alpha Roofing",
      website: "https://alpha.example/",
      phone: "+13055550101",
      providerNumberId: "telnyx-alpha",
      assistantId: "assistant-shared",
    });
    const beta = await prepareActiveProspect({
      businessName: "Beta Plumbing",
      website: "https://beta.example/",
      phone: "+13055550102",
      providerNumberId: "telnyx-beta",
      assistantId: "assistant-shared",
    });

    const alphaContext = await resolveActiveProspectAgentContext(alpha.number.e164, new Date("2026-08-21T16:00:00.000Z"));
    const betaContext = await resolveActiveProspectAgentContext(beta.number.e164, new Date("2026-08-21T16:00:00.000Z"));
    expect(alphaContext).toMatchObject({ accountId: alpha.account.id, bootstrapId: alpha.bootstrap.id });
    expect(betaContext).toMatchObject({ accountId: beta.account.id, bootstrapId: beta.bootstrap.id });
    expect(alphaContext?.context.business_name).toBe("Alpha Roofing");
    expect(betaContext?.context.business_name).toBe("Beta Plumbing");
    expect(alphaContext?.context.approved_business_context).not.toContain("Beta Plumbing");
    expect(betaContext?.context.approved_business_context).not.toContain("Alpha Roofing");

    await expect(prisma.telephonyNumberAssignment.create({ data: {
      account_id: beta.account.id,
      bootstrap_id: beta.bootstrap.id,
      telephony_number_id: alpha.number.id,
      provider_assistant_id: "assistant-shared",
      status: "active",
      number_exclusivity_key: alpha.number.id,
      bootstrap_exclusivity_key: "duplicate-bootstrap-key",
    } })).rejects.toThrow();
  });

  test("resolves late events against assignment history and rejects the unassigned gap", async () => {
    const accountA = await prisma.account.create({ data: { name: "History A", slug: "history-a", industry: "home-services", timezone: "UTC", status: "lead", account_type: "sandbox" } });
    const accountB = await prisma.account.create({ data: { name: "History B", slug: "history-b", industry: "home-services", timezone: "UTC", status: "lead", account_type: "sandbox" } });
    const bootstrapA = await prisma.prospectBootstrap.create({ data: { account_id: accountA.id, canonical_website: "https://history-a.example/" } });
    const bootstrapB = await prisma.prospectBootstrap.create({ data: { account_id: accountB.id, canonical_website: "https://history-b.example/" } });
    const number = await prisma.telephonyNumber.create({ data: { provider: "telnyx", provider_number_id: "history-number", e164: "+13055550103", status: "assigned" } });
    await prisma.telephonyNumberAssignment.create({ data: {
      account_id: accountA.id,
      bootstrap_id: bootstrapA.id,
      telephony_number_id: number.id,
      provider_assistant_id: "assistant-shared",
      status: "released",
      assigned_at: new Date("2026-08-01T00:00:00.000Z"),
      activated_at: new Date("2026-08-01T00:00:00.000Z"),
      unassigned_at: new Date("2026-08-05T00:00:00.000Z"),
    } });
    await prisma.telephonyNumberAssignment.create({ data: {
      account_id: accountB.id,
      bootstrap_id: bootstrapB.id,
      telephony_number_id: number.id,
      provider_assistant_id: "assistant-shared",
      status: "active",
      assigned_at: new Date("2026-08-15T00:00:00.000Z"),
      activated_at: new Date("2026-08-20T00:00:00.000Z"),
      number_exclusivity_key: number.id,
      bootstrap_exclusivity_key: bootstrapB.id,
    } });

    const receivedAt = new Date("2026-08-21T00:00:00.000Z");
    expect(await resolveTelnyxEventAssignment({ target: number.e164, occurredAt: new Date("2026-08-03T00:00:00.000Z"), receivedAt }))
      .toMatchObject({ accountId: accountA.id, bootstrapId: bootstrapA.id });
    expect(await resolveTelnyxEventAssignment({ target: number.e164, occurredAt: new Date("2026-08-10T00:00:00.000Z"), receivedAt }))
      .toBeNull();
    expect(await resolveTelnyxEventAssignment({ target: number.e164, occurredAt: new Date("2026-08-17T00:00:00.000Z"), receivedAt }))
      .toBeNull();
    expect(await resolveTelnyxEventAssignment({ target: number.e164, occurredAt: new Date("2026-08-21T00:00:00.000Z"), receivedAt }))
      .toMatchObject({ accountId: accountB.id, bootstrapId: bootstrapB.id });
    await resolveTelnyxEventAssignment({ target: number.e164, occurredAt: new Date("2026-08-20T12:00:00.000Z"), receivedAt });
    expect(await prisma.telephonyNumberAssignment.findFirst({ where: { bootstrap_id: bootstrapB.id } }))
      .toMatchObject({ last_inbound_at: new Date("2026-08-21T00:00:00.000Z") });
    expect(await resolveTelnyxEventAssignment({
      target: number.e164,
      occurredAt: new Date("2026-08-03T00:00:00.000Z"),
      receivedAt: new Date("2026-09-10T00:00:00.000Z"),
    })).toBeNull();
    await prisma.prospectBootstrap.update({ where: { id: bootstrapB.id }, data: { status: "cleaned" } });
    expect(await resolveTelnyxEventAssignment({ target: number.e164, occurredAt: new Date("2026-08-21T00:00:00.000Z"), receivedAt }))
      .toBeNull();
  });

  test("purges retained content and raw payloads without releasing provider resources", async () => {
    const prepared = await prepareActiveProspect({
      businessName: "Cleanup Roofing",
      website: "https://cleanup.example/",
      phone: "+13055550104",
      providerNumberId: "telnyx-cleanup",
      assistantId: "assistant-shared",
    });
    const expiredAt = new Date("2026-07-01T00:00:00.000Z");
    await prisma.prospectBootstrap.update({ where: { id: prepared.bootstrap.id }, data: { status: "expired", expires_at: expiredAt } });
    await prisma.webhookEvent.create({ data: {
      account_id: prepared.account.id,
      provider: "telnyx",
      provider_event_id: "cleanup-event",
      dedupe_hash: "cleanup-event-hash",
      event_type: "call.conversation.ended",
      raw_body: "caller content",
      signature_valid: true,
      received_at: expiredAt,
    } });

    expect(unwrap(await cleanupExpiredProspectBootstraps(new Date("2026-08-20T00:00:00.000Z")))).toEqual({ cleaned: 1 });
    expect(await prisma.knowledgeFact.count({ where: { account_id: prepared.account.id } })).toBe(0);
    expect(await prisma.businessMemorySnapshot.count({ where: { account_id: prepared.account.id } })).toBe(0);
    expect(await prisma.knowledgeSource.findFirst({ where: { account_id: prepared.account.id } })).toMatchObject({ status: "purged", extracted_text: null });
    expect(await prisma.webhookEvent.findUnique({ where: { provider_provider_event_id: { provider: "telnyx", provider_event_id: "cleanup-event" } } }))
      .toMatchObject({ raw_body: "<PURGED_PROSPECT_DEMO_PAYLOAD>", signature_header: null });
    expect(await prisma.telephonyNumber.findUnique({ where: { id: prepared.number.id } })).not.toBeNull();
  });

  test("enforces the independent 30-day source and caller-content boundary", async () => {
    const prepared = await prepareActiveProspect({
      businessName: "Retention Roofing",
      website: "https://retention.example/",
      phone: "+13055550107",
      providerNumberId: "telnyx-retention",
      assistantId: "assistant-shared",
    });
    const contact = await prisma.contact.create({ data: {
      account_id: prepared.account.id,
      first_name: "Private",
      phone: "+13055550999",
      source: "call",
    } });
    const call = await prisma.call.create({ data: {
      account_id: prepared.account.id,
      contact_id: contact.id,
      provider: "telnyx",
      provider_call_id: "retention-call",
      direction: "inbound",
      status: "completed",
      from_number: "+13055550999",
      to_number: prepared.number.e164,
      transcript: "Private inline transcript",
      summary: "Private call summary",
      started_at: startedAt,
    } });
    await prisma.callTranscript.create({ data: {
      account_id: prepared.account.id,
      call_id: call.id,
      inline_text: "Private canonical transcript",
      retention_lane: "redacted_only",
      expires_at: new Date("2026-09-19T16:00:00.000Z"),
    } });
    await prisma.callSegment.create({ data: {
      account_id: prepared.account.id,
      call_id: call.id,
      sequence: 1,
      speaker: "caller",
      text: "Private segment",
      started_at: startedAt,
      ended_at: new Date(startedAt.getTime() + 1_000),
    } });
    await prisma.webhookEvent.create({ data: {
      account_id: prepared.account.id,
      provider: "telnyx",
      provider_event_id: "retention-webhook",
      dedupe_hash: "retention-webhook-hash",
      event_type: "call.conversation.ended",
      raw_body: "private provider payload",
      signature_valid: true,
      payload_expires_at: new Date("2026-09-19T16:00:00.000Z"),
    } });

    expect(unwrap(await purgeExpiredProspectContent(new Date("2026-09-20T16:00:00.000Z"))))
      .toMatchObject({ accountsPurged: 1 });
    expect(await prisma.contact.count({ where: { account_id: prepared.account.id } })).toBe(0);
    expect(await prisma.callSegment.count({ where: { account_id: prepared.account.id } })).toBe(0);
    expect(await prisma.call.findUnique({ where: { id: call.id } })).toMatchObject({
      from_number: "<PURGED>",
      contact_id: null,
      transcript: null,
      summary: null,
    });
    expect(await prisma.callTranscript.findUnique({ where: { call_id: call.id } })).toMatchObject({
      inline_text: null,
      retention_lane: "metadata_only",
    });
    expect(await prisma.knowledgeSource.findFirst({ where: { account_id: prepared.account.id } })).toMatchObject({ extracted_text: null, status: "purged" });
    expect(await prisma.knowledgeFact.count({ where: { account_id: prepared.account.id } })).toBe(0);
    expect(await prisma.businessMemorySnapshot.count({ where: { account_id: prepared.account.id } })).toBe(0);
    expect(await prisma.prospectBootstrap.findUnique({ where: { id: prepared.bootstrap.id } })).toMatchObject({ current_memory_snapshot_id: null, content_purged_at: expect.any(Date) });
    expect(await prisma.webhookEvent.findUnique({ where: { dedupe_hash: "retention-webhook-hash" } })).toMatchObject({
      raw_body: "<PURGED_PROSPECT_DEMO_PAYLOAD>",
      signature_header: null,
      payload_purged_at: expect.any(Date),
    });
    expect(await prisma.telephonyNumber.findUnique({ where: { id: prepared.number.id } })).toMatchObject({ status: "assigned" });
  });

  test("imports an allowlisted package into a new disabled customer tenant idempotently", async () => {
    const prepared = await prepareActiveProspect({
      businessName: "Promoted Roofing",
      website: "https://promoted.example/",
      phone: "+13055550105",
      providerNumberId: "telnyx-promoted",
      assistantId: "assistant-shared",
    });
    await prisma.call.create({ data: {
      account_id: prepared.account.id,
      provider: "telnyx",
      provider_call_id: "demo-call-not-promoted",
      direction: "inbound",
      from_number: "+13055550999",
      to_number: prepared.number.e164,
      status: "completed",
      started_at: startedAt,
    } });
    unwrap(await completeProspectBootstrap(prepared.bootstrap.id, new Date("2026-08-21T00:00:00.000Z")));
    expect(await prisma.telephonyNumberAssignment.findFirst({ where: { bootstrap_id: prepared.bootstrap.id } }))
      .toMatchObject({ status: "quarantined", unassigned_at: new Date("2026-08-21T00:00:00.000Z") });
    expect(await prisma.telephonyNumber.findUnique({ where: { id: prepared.number.id } })).toMatchObject({ status: "quarantined" });
    const exported = unwrap(await exportBootstrapPromotion({ bootstrapId: prepared.bootstrap.id }));
    process.env.RESPONSEOS_PROMOTION_IMPORT_ENABLED = "true";
    const firstResult = await importBootstrapPromotion({
      manifest: exported.manifest,
      manifestHash: exported.promotion.manifest_hash,
    });
    if (!firstResult.ok) throw new Error(firstResult.error.message);
    const first = firstResult.data;
    expect(first.replay).toBe(false);
    if (first.replay) throw new Error("expected a new import");
    expect(first.account.id).not.toBe(prepared.account.id);
    expect(first.account).toMatchObject({ account_type: "customer", status: "lead", clerk_org_id: null });
    expect(first.profile).toMatchObject({ enabled: false, type: "demo_mode" });
    expect(await prisma.call.count({ where: { account_id: first.account.id } })).toBe(0);
    expect(await prisma.webhookEvent.count({ where: { account_id: first.account.id } })).toBe(0);
    expect(await prisma.telephonyNumberAssignment.count({ where: { account_id: first.account.id } })).toBe(0);
    expect(first.snapshot.memory_json).toMatchObject({ accountId: first.account.id, bootstrapId: null });
    expect(first.snapshot.content_hash).not.toBe(exported.manifest.sourceSnapshotHash);

    const replayResult = await importBootstrapPromotion({
      manifest: exported.manifest,
      manifestHash: exported.promotion.manifest_hash,
    });
    if (!replayResult.ok) throw new Error(replayResult.error.message);
    const replay = replayResult.data;
    expect(replay).toMatchObject({ replay: true, account: { id: first.account.id }, snapshot: { id: first.snapshot.id } });

    const acknowledged = unwrap(await acknowledgeImportedBootstrapPromotion({
      correlationId: exported.promotion.correlation_id,
      manifestHash: exported.promotion.manifest_hash,
      importedAccountRef: first.account.id,
    }, new Date("2026-08-21T01:00:00.000Z")));
    expect(acknowledged).toMatchObject({ replay: false, promotion: { status: "imported", imported_account_ref: first.account.id }, bootstrap: { status: "converted" } });
    expect(await prisma.prospectBootstrap.findUnique({ where: { id: prepared.bootstrap.id } })).toMatchObject({
      status: "converted",
      converted_at: new Date("2026-08-21T01:00:00.000Z"),
      active_account_key: null,
    });
    expect(unwrap(await acknowledgeImportedBootstrapPromotion({
      correlationId: exported.promotion.correlation_id,
      manifestHash: exported.promotion.manifest_hash,
      importedAccountRef: first.account.id,
    }, new Date("2026-08-21T02:00:00.000Z")))).toMatchObject({ replay: true });
  });

  test("never reuses a quarantined number without explicit operator approval", async () => {
    const prepared = await prepareActiveProspect({
      businessName: "Quarantine Roofing",
      website: "https://quarantine.example/",
      phone: "+13055550106",
      providerNumberId: "telnyx-quarantine",
      assistantId: "assistant-shared",
    });
    const assignment = await prisma.telephonyNumberAssignment.findFirstOrThrow({ where: { bootstrap_id: prepared.bootstrap.id } });
    const eligibleAt = new Date("2026-08-01T00:00:00.000Z");
    await prisma.telephonyNumberAssignment.update({ where: { id: assignment.id }, data: {
      status: "quarantined",
      unassigned_at: new Date("2026-07-01T00:00:00.000Z"),
      quarantine_until: eligibleAt,
      bootstrap_exclusivity_key: null,
    } });
    await prisma.telephonyNumber.update({ where: { id: prepared.number.id }, data: { status: "quarantined" } });

    expect(await resolveTelnyxEventAssignment({
      target: prepared.number.e164,
      occurredAt: new Date("2026-07-10T00:00:00.000Z"),
      receivedAt: new Date("2026-07-11T00:00:00.000Z"),
    })).toBeNull();
    await resolveTelnyxEventAssignment({
      target: prepared.number.e164,
      occurredAt: new Date("2026-07-05T00:00:00.000Z"),
      receivedAt: new Date("2026-07-11T00:00:00.000Z"),
    });
    expect(await prisma.telephonyNumberAssignment.findUnique({ where: { id: assignment.id } }))
      .toMatchObject({ last_inbound_at: new Date("2026-07-10T00:00:00.000Z") });

    expect(unwrap(await releaseQuarantinedAssignments(new Date("2026-08-20T00:00:00.000Z"))))
      .toEqual({ eligible: 1, extended: 0 });
    expect(await prisma.telephonyNumber.findUnique({ where: { id: prepared.number.id } })).toMatchObject({ status: "quarantined" });

    await prisma.webhookEvent.create({ data: {
      account_id: prepared.account.id,
      provider: "telnyx",
      provider_event_id: "unresolved-quarantine-event",
      dedupe_hash: "unresolved-quarantine-event-hash",
      event_type: "call.started",
      raw_body: "{}",
      signature_valid: true,
      process_status: "error",
    } });
    const blocked = await approveQuarantinedNumberReuse(assignment.id, new Date("2026-08-20T00:00:00.000Z"));
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe("number_activity_unresolved");
    await prisma.webhookEvent.updateMany({ where: { account_id: prepared.account.id }, data: { process_status: "rejected" } });

    unwrap(await approveQuarantinedNumberReuse(assignment.id, new Date("2026-08-20T00:00:00.000Z")));
    expect(await prisma.telephonyNumber.findUnique({ where: { id: prepared.number.id } })).toMatchObject({ status: "available" });
    expect(await prisma.telephonyNumberAssignment.findUnique({ where: { id: assignment.id } })).toMatchObject({ status: "released", number_exclusivity_key: null });
  });
});
