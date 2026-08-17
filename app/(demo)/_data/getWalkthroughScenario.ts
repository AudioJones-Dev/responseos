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
        hubspotDealId: "No live HubSpot record",
        sourceAttribution: "Static fallback fixture",
      },
      memory: fallback.memory,
      followUps: fallback.followUps,
      integrations: fallback.integrations,
    };
  }

  const lifecycle = result.data;
  const lead = lifecycle.lead;
  const qualification = lead?.qualification;
  const contactName = [
    lifecycle.contact?.first_name,
    lifecycle.contact?.last_name,
  ]
    .filter(Boolean)
    .join(" ");
  const estimatedValue = (lead?.estimated_value ?? 0) / 100;
  const appointmentDate = lifecycle.appointment
    ? dateTime(lifecycle.appointment.start_time)
    : "Manual review required";
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
      region: `${lifecycle.contact?.city ?? "Tampa"}, ${lifecycle.contact?.state ?? "FL"}`,
    },
    overview: {
      period: "Persisted sandbox fixture",
      revenueProtected:
        (lifecycle.revenue?.estimated_recovered_revenue ?? 0) / 100,
      revenueProtectedDelta: "Illustrative estimate — not verified revenue",
      recoveredCalls: 0,
      qualifiedLeads: lifecycle.revenue?.qualified_leads ?? 0,
      appointments: lifecycle.revenue?.appointments_booked ?? 0,
      followUpsDue: lifecycle.appointment ? 1 : 0,
      missedCallRecoveryRate: 0,
      atRiskCount: 0,
    },
    founderBriefing: {
      whatChanged:
        "A persisted simulated call was captured, qualified, and linked to a manual appointment fixture.",
      revenueProtectedLine: `${fallback.usd(estimatedValue)} illustrative opportunity — not verified or recovered revenue.`,
      topNextAction: lifecycle.appointment
        ? `Review the simulated appointment scheduled for ${appointmentDate}.`
        : "Review the simulated lead manually.",
      points: [
        "The records are tenant-scoped and persisted in the ResponseOS sandbox.",
        "The decision and action are seeded fixtures, not runtime AI decisions.",
        "No provider, CRM, calendar, or messaging mutation occurred.",
      ],
    },
    call: {
      id: lifecycle.call.id,
      channel: "Simulated inbound voice · persisted sandbox fixture",
      startedAt: dateTime(lifecycle.call.started_at),
      duration: `${lifecycle.call.duration_seconds ?? 0}s`,
      disposition: "Seeded qualification and manual appointment fixture",
      urgency: lead?.urgency ?? ("medium" as const),
      revenueRange: { min: estimatedValue, max: estimatedValue },
      caller: contactName || "Fictional caller",
      consent: { sms: false, call: false },
      qualificationScore: qualification?.qualification_score ?? 0,
      intent: qualification?.service_needed ?? "Service assessment",
      serviceRequested:
        qualification?.service_needed ?? "Service assessment",
      appointmentStatus: lifecycle.appointment
        ? `Seeded ${lifecycle.appointment.status} appointment`
        : "No appointment fixture",
      summary: lifecycle.call.summary ?? "No summary available.",
      nextAction: {
        label: "Manual appointment review",
        owner: "Demo operator",
        dueAt: appointmentDate,
      },
      crmSyncStatus: "Not synced — mock CRM contract only",
      memoryStatus: "Persisted sandbox evidence",
      transcript,
    },
    lead: {
      id: lead?.id ?? "no-demo-lead",
      name: contactName || "Fictional caller",
      region: `${lifecycle.contact?.city ?? "Tampa"}, ${lifecycle.contact?.state ?? "FL"}`,
      serviceCategory: qualification?.service_needed ?? "Service assessment",
      workType: lifecycle.quote?.status ?? "manual review",
      estimatedValue: { min: estimatedValue, max: estimatedValue },
      qualificationScore: qualification?.qualification_score ?? 0,
      qualificationBand: qualification?.qualification_status ?? "not scored",
      urgency: lead?.urgency ?? ("medium" as const),
      dealStage: lead?.status ?? "not created",
      hubspotDealId: "No live HubSpot record",
      crmSyncStatus: "Not synced",
      followUpOwner: "Demo operator",
      appointmentIntent: lifecycle.appointment?.title ?? "Manual review",
      sourceAttribution: "Persisted simulated call fixture",
      relatedCallId: lifecycle.call.id,
      relatedMemoryId: lifecycle.transcript?.id ?? "No transcript fixture",
    },
    memory: {
      id: lifecycle.transcript?.id ?? "no-transcript-fixture",
      capturedAt: dateTime(
        lifecycle.transcript?.created_at ?? lifecycle.call.created_at,
      ),
      model: "Persisted Phase-1 sandbox evidence",
      sourceEvent: {
        type: lead?.event_type ?? "simulated.call",
        callId: lifecycle.call.id,
        channel: "persisted sandbox fixture",
      },
      entities: [
        { label: "Contact", value: contactName || "Fictional caller" },
        { label: "Business", value: lifecycle.account.name },
        { label: "Tenant type", value: lifecycle.account.account_type },
      ],
      summary: lifecycle.call.summary ?? "No summary available.",
      operationalContext:
        qualification?.service_needed ?? "Manual service assessment review.",
      commercialContext: `${fallback.usd(estimatedValue)} illustrative estimate; verified revenue is $0.`,
      nextActions: [
        {
          label: "Review simulated appointment",
          owner: "Demo operator",
          dueAt: appointmentDate,
        },
      ],
      trail: [
        {
          t: "14:00",
          event: "Simulated call persisted",
          detail: `Call record ${lifecycle.call.id} stored in the sandbox tenant.`,
        },
        {
          t: "14:04",
          event: "Seeded qualification linked",
          detail: `Score ${qualification?.qualification_score ?? 0}; no runtime model execution.`,
        },
        ...lifecycle.audit.map((entry) => ({
          t: "14:04",
          event: entry.action,
          detail: entry.reason ?? "Persisted audit evidence.",
        })),
      ],
      gates: fallback.memory.gates,
    },
    followUps: [
      {
        id: lifecycle.appointment?.id ?? "manual-review-demo",
        lead: contactName || "Fictional caller",
        reason: "Review simulated appointment fixture",
        urgency: lead?.urgency ?? ("medium" as const),
        dueAt: appointmentDate,
        owner: "Demo operator",
        estimatedValue: { min: estimatedValue, max: estimatedValue },
        crmStatus: "Not synced",
        suggestedAction:
          "Review the persisted sandbox record; do not contact a real person.",
        riskIfIgnored:
          "Illustrative only — this sandbox does not represent a real customer outcome.",
      },
    ],
    integrations: [
      {
        name: "HubSpot CRM sync",
        state: "mock" as const,
        detail: "Contract and fixture only — no HubSpot record was written.",
      },
      {
        name: "Telephony event delivery",
        state: "mock" as const,
        detail: "Persisted simulated call — no live carrier or AI voice provider.",
      },
      {
        name: "Calendar / scheduling",
        state: "disabled" as const,
        detail: "Manual appointment fixture — no calendar mutation.",
      },
      {
        name: "Business Memory capture",
        state: "captured" as const,
        detail: "Tenant-scoped transcript, workflow, and audit fixtures persisted.",
      },
      {
        name: "Event bus",
        state: "mock" as const,
        detail: "No live event relay or autonomous action execution.",
      },
    ],
  };
});
