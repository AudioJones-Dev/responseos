import "@/lib/serverOnlyGuard";
import { cache } from "react";
import { getPublicDemoCallLifecycle } from "@/lib/data/demoCallLifecycle";
import * as fallback from "./scenario";

const dateTime = (value: string): string =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(value));

export const getWalkthroughScenario = cache(async () => {
  const result = await getPublicDemoCallLifecycle();
  if (!result.ok) {
    return {
      source: "static-fallback" as const,
      error: result.error.message,
      business: fallback.business,
      overview: fallback.overview,
      founderBriefing: fallback.founderBriefing,
      call: {
        ...fallback.call,
        channel: "Static fallback scenario · no live or persisted call",
        crmSyncStatus: "Not synced — static fallback",
        memoryStatus: "Static fallback only",
      },
      lead: {
        ...fallback.lead,
        crmSyncStatus: "Not synced",
        hubspotDealId: "No HubSpot record",
        sourceAttribution: "Static fictional fixture",
      },
      memory: fallback.memory,
      followUps: fallback.followUps.map((item) => ({ ...item, crmStatus: "Not synced" })),
      integrations: fallback.integrations,
    };
  }

  const lifecycle = result.data;
  const lead = lifecycle.lead;
  const qualification = lead?.qualification;
  const name = [lifecycle.contact?.first_name, lifecycle.contact?.last_name]
    .filter(Boolean)
    .join(" ") || "Fictional caller";
  const region = `${lifecycle.contact?.city ?? "Tampa"}, ${lifecycle.contact?.state ?? "FL"}`;
  const estimatedValue = (lead?.estimated_value ?? 0) / 100;
  const transcript = lifecycle.segments.map((segment) => ({
    t: new Intl.DateTimeFormat("en-US", {
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
    }).format(
      new Date(
        new Date(segment.started_at).getTime() -
          new Date(lifecycle.call.started_at).getTime(),
      ),
    ),
    speaker: segment.speaker === "caller" ? ("Caller" as const) : ("AI" as const),
    text: segment.redacted_text ?? segment.text,
  }));

  return {
    source: "persisted" as const,
    error: null,
    business: {
      id: lifecycle.account.id,
      name: lifecycle.account.name,
      vertical: "Home services — fictional persisted sandbox",
      region,
    },
    overview: {
      period: "Persisted fictional sandbox",
      revenueProtected: (lifecycle.revenue?.estimated_recovered_revenue ?? 0) / 100,
      revenueProtectedDelta: "Illustrative estimate — not verified revenue",
      recoveredCalls: 0,
      qualifiedLeads: lifecycle.revenue?.qualified_leads ?? 0,
      appointments: 0,
      followUpsDue: lead ? 1 : 0,
      missedCallRecoveryRate: 0,
      atRiskCount: 0,
    },
    founderBriefing: {
      whatChanged: "A persisted fictional call was captured, qualified, and queued for human follow-up.",
      revenueProtectedLine: `${fallback.usd(estimatedValue)} illustrative opportunity — not verified or recovered revenue.`,
      topNextAction: "Review the fictional qualification and complete a human callback.",
      points: [
        "Records are tenant-scoped and persisted in the ResponseOS sandbox.",
        "The decision and action are seeded fixtures, not runtime AI decisions.",
        "No provider, CRM, calendar, or messaging mutation occurred.",
      ],
    },
    call: {
      id: lifecycle.call.id,
      channel: "Simulated inbound voice · persisted sandbox fixture",
      startedAt: dateTime(lifecycle.call.started_at),
      duration: `${lifecycle.call.duration_seconds ?? 0}s`,
      disposition: "Seeded qualification · human callback required",
      urgency: lead?.urgency ?? ("medium" as const),
      revenueRange: { min: estimatedValue, max: estimatedValue },
      caller: name,
      consent: { sms: false, call: false },
      qualificationScore: qualification?.qualification_score ?? 0,
      intent: qualification?.service_needed ?? "Service assessment",
      serviceRequested: qualification?.service_needed ?? "Service assessment",
      appointmentStatus: "Not scheduled — operator callback only",
      summary: lifecycle.call.summary ?? "No summary available.",
      nextAction: {
        label: "Human callback review",
        owner: "Demo operator",
        dueAt: "Manual review",
      },
      crmSyncStatus: "Not synced — mock CRM contract only",
      memoryStatus: "Persisted sandbox evidence",
      transcript,
    },
    lead: {
      id: lead?.id ?? "no-demo-lead",
      name,
      region,
      serviceCategory: qualification?.service_needed ?? "Service assessment",
      workType: "manual review",
      estimatedValue: { min: estimatedValue, max: estimatedValue },
      qualificationScore: qualification?.qualification_score ?? 0,
      qualificationBand: qualification?.qualification_status ?? "not scored",
      urgency: lead?.urgency ?? ("medium" as const),
      dealStage: lead?.status ?? "not created",
      hubspotDealId: "No HubSpot record",
      crmSyncStatus: "Not synced",
      followUpOwner: "Demo operator",
      appointmentIntent: "Human callback requested",
      sourceAttribution: "Persisted fictional call fixture",
      relatedCallId: lifecycle.call.id,
      relatedMemoryId: lifecycle.transcript?.id ?? "No transcript fixture",
    },
    memory: {
      id: lifecycle.transcript?.id ?? "no-transcript-fixture",
      capturedAt: dateTime(lifecycle.transcript?.created_at ?? lifecycle.call.created_at),
      model: "Persisted Phase-1 sandbox evidence",
      sourceEvent: {
        type: lead?.event_type ?? "simulated.call",
        callId: lifecycle.call.id,
        channel: "persisted sandbox fixture",
      },
      entities: [
        { label: "Contact", value: name },
        { label: "Business", value: lifecycle.account.name },
        { label: "Tenant type", value: lifecycle.account.account_type },
      ],
      summary: lifecycle.call.summary ?? "No summary available.",
      operationalContext: qualification?.service_needed ?? "Manual service assessment review.",
      commercialContext: `${fallback.usd(estimatedValue)} illustrative estimate; verified revenue is $0.`,
      nextActions: [{ label: "Review fictional callback", owner: "Demo operator", dueAt: "Manual review" }],
      trail: [
        { t: "14:00", event: "Simulated call persisted", detail: `Call ${lifecycle.call.id} stored in the sandbox tenant.` },
        { t: "14:04", event: "Seeded qualification linked", detail: `Score ${qualification?.qualification_score ?? 0}; no runtime model execution.` },
        ...lifecycle.audit.map((entry) => ({
          t: "14:04",
          event: entry.action,
          detail: entry.reason ?? "Persisted audit evidence.",
        })),
      ],
      gates: fallback.memory.gates,
    },
    followUps: [{
      id: "manual-review-demo",
      lead: name,
      reason: "Review fictional qualified callback request",
      urgency: lead?.urgency ?? ("medium" as const),
      dueAt: "Manual review",
      owner: "Demo operator",
      estimatedValue: { min: estimatedValue, max: estimatedValue },
      crmStatus: "Not synced",
      suggestedAction: "Review the persisted sandbox record; do not contact a real person.",
      riskIfIgnored: "Illustrative only — this sandbox does not represent a real customer outcome.",
    }],
    integrations: [
      { name: "HubSpot CRM sync", state: "mock" as const, detail: "Contract and fixture only — no HubSpot record was written." },
      { name: "Telephony event delivery", state: "mock" as const, detail: "Persisted simulated call — no live carrier or AI voice provider." },
      { name: "Calendar / scheduling", state: "disabled" as const, detail: "No calendar mutation or appointment promise." },
      { name: "Business Memory capture", state: "captured" as const, detail: "Tenant-scoped transcript, workflow, and audit fixtures persisted." },
      { name: "Event bus", state: "mock" as const, detail: "No live event relay or autonomous action execution." },
    ],
  };
});
