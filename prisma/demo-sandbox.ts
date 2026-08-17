import type { Prisma, PrismaClient } from "@prisma/client";
import {
  RESPONSEOS_DEMO_ACCOUNT_ID,
  RESPONSEOS_DEMO_CALL_ID,
} from "../lib/demo/constants";

type DemoDb = PrismaClient | Prisma.TransactionClient;

const CALL_STARTED_AT = new Date("2026-08-15T14:00:00.000Z");
const CALL_ENDED_AT = new Date("2026-08-15T14:04:30.000Z");
const APPOINTMENT_START = new Date("2026-08-18T15:00:00.000Z");
const APPOINTMENT_END = new Date("2026-08-18T16:00:00.000Z");

export async function seedResponseOsDemoSandbox(db: DemoDb): Promise<void> {
  await db.account.upsert({
    where: { id: RESPONSEOS_DEMO_ACCOUNT_ID },
    update: {},
    create: {
      id: RESPONSEOS_DEMO_ACCOUNT_ID,
      name: "Harbor Home Services Demo",
      slug: "responseos-demo",
      industry: "home-services",
      website_url: "https://harbor-home-services.example",
      primary_phone: "+15555550800",
      timezone: "America/New_York",
      status: "active",
      account_type: "sandbox",
      created_at: CALL_STARTED_AT,
      updated_at: CALL_STARTED_AT,
    },
  });

  await db.contact.upsert({
    where: { id: "contact_responseos_demo" },
    update: {},
    create: {
      id: "contact_responseos_demo",
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      first_name: "Morgan",
      last_name: "Lee",
      phone: "+15555550811",
      email: "morgan.lee@prospect.example",
      city: "Tampa",
      state: "FL",
      zip: "33602",
      source: "call",
      created_at: CALL_STARTED_AT,
      updated_at: CALL_STARTED_AT,
    },
  });

  await db.call.upsert({
    where: { id: RESPONSEOS_DEMO_CALL_ID },
    update: {},
    create: {
      id: RESPONSEOS_DEMO_CALL_ID,
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      contact_id: "contact_responseos_demo",
      provider: "manual",
      provider_call_id: "simulated-call-responseos-demo",
      direction: "inbound",
      status: "completed",
      from_number: "+15555550811",
      to_number: "+15555550800",
      started_at: CALL_STARTED_AT,
      ended_at: CALL_ENDED_AT,
      duration_seconds: 270,
      summary:
        "Simulated caller requested an urgent water-heater assessment and accepted a service appointment.",
      sentiment: "positive",
      spam_score: 0,
      lead_score: 88,
      created_at: CALL_STARTED_AT,
    },
  });

  const segments: Array<Prisma.CallSegmentCreateInput> = [
    {
      id: "segment_responseos_demo_1",
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      call_id: RESPONSEOS_DEMO_CALL_ID,
      sequence: 1,
      speaker: "agent",
      text: "Thanks for calling Harbor Home Services. How can I help today?",
      redacted_text:
        "Thanks for calling Harbor Home Services. How can I help today?",
      confidence: 1,
      started_at: CALL_STARTED_AT,
      ended_at: new Date("2026-08-15T14:00:08.000Z"),
      created_at: CALL_STARTED_AT,
    },
    {
      id: "segment_responseos_demo_2",
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      call_id: RESPONSEOS_DEMO_CALL_ID,
      sequence: 2,
      speaker: "caller",
      text: "Our water heater is leaking. We need someone this week in Tampa.",
      redacted_text:
        "Our water heater is leaking. We need someone this week in Tampa.",
      confidence: 0.98,
      started_at: new Date("2026-08-15T14:00:09.000Z"),
      ended_at: new Date("2026-08-15T14:00:23.000Z"),
      created_at: CALL_STARTED_AT,
    },
    {
      id: "segment_responseos_demo_3",
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      call_id: RESPONSEOS_DEMO_CALL_ID,
      sequence: 3,
      speaker: "agent",
      text: "I have recorded the service need and a Tuesday appointment window.",
      redacted_text:
        "I have recorded the service need and a Tuesday appointment window.",
      confidence: 1,
      started_at: new Date("2026-08-15T14:03:45.000Z"),
      ended_at: CALL_ENDED_AT,
      created_at: CALL_STARTED_AT,
    },
  ];

  for (const segment of segments) {
    await db.callSegment.upsert({
      where: {
        call_id_sequence: {
          call_id: RESPONSEOS_DEMO_CALL_ID,
          sequence: segment.sequence,
        },
      },
      update: {},
      create: segment,
    });
  }

  await db.callTranscript.upsert({
    where: { call_id: RESPONSEOS_DEMO_CALL_ID },
    update: {},
    create: {
      id: "transcript_responseos_demo",
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      call_id: RESPONSEOS_DEMO_CALL_ID,
      inline_text:
        "Simulated caller reported a leaking water heater, confirmed Tampa service area, and accepted a Tuesday appointment window.",
      language: "en",
      retention_lane: "redacted_only",
      redacted_at: CALL_ENDED_AT,
      created_at: CALL_ENDED_AT,
    },
  });

  await db.leadEvent.upsert({
    where: { id: "lead_responseos_demo" },
    update: {},
    create: {
      id: "lead_responseos_demo",
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      contact_id: "contact_responseos_demo",
      call_id: RESPONSEOS_DEMO_CALL_ID,
      source: "phone",
      event_type: "appointment_booked",
      status: "booked",
      urgency: "high",
      estimated_value: 185_000,
      recovered_value: null,
      notes: "Seeded simulation; no live provider or verified revenue event.",
      created_at: CALL_ENDED_AT,
      updated_at: CALL_ENDED_AT,
    },
  });

  await db.leadQualification.upsert({
    where: { lead_event_id: "lead_responseos_demo" },
    update: {},
    create: {
      id: "qualification_responseos_demo",
      lead_event_id: "lead_responseos_demo",
      service_needed: "Leaking water-heater assessment",
      service_area_match: true,
      budget_range: "Assessment required before quote",
      timeline: "this_week",
      property_type: "single-family home",
      decision_maker: true,
      qualification_score: 88,
      qualification_status: "qualified",
      created_at: CALL_ENDED_AT,
    },
  });

  await db.appointment.upsert({
    where: { id: "appointment_responseos_demo" },
    update: {},
    create: {
      id: "appointment_responseos_demo",
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      contact_id: "contact_responseos_demo",
      lead_event_id: "lead_responseos_demo",
      calendar_provider: "manual",
      title: "Water-heater assessment — simulated demo",
      start_time: APPOINTMENT_START,
      end_time: APPOINTMENT_END,
      status: "confirmed",
      location: "Tampa, FL (fictional demo)",
      notes: "Persisted sandbox fixture; not a live calendar booking.",
      created_at: CALL_ENDED_AT,
      updated_at: CALL_ENDED_AT,
    },
  });

  await db.quoteRequest.upsert({
    where: { id: "quote_responseos_demo" },
    update: {},
    create: {
      id: "quote_responseos_demo",
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      contact_id: "contact_responseos_demo",
      lead_event_id: "lead_responseos_demo",
      service_type: "Water-heater assessment",
      description: "Assessment required before any quote is issued.",
      photos: [],
      property_address: "Tampa, FL (fictional demo)",
      estimated_value: 185_000,
      status: "reviewing",
      created_at: CALL_ENDED_AT,
      updated_at: CALL_ENDED_AT,
    },
  });

  await db.workflowRun.upsert({
    where: { workflow_run_id: "workflow-run-responseos-demo" },
    update: {},
    create: {
      id: "workflow_responseos_demo",
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      workflow_run_id: "workflow-run-responseos-demo",
      workflow_id: "simulated_call_qualification",
      provider: "internal",
      trigger_event_id: "lead_responseos_demo",
      status: "completed",
      started_at: CALL_ENDED_AT,
      ended_at: new Date("2026-08-15T14:04:31.000Z"),
      payload_json: {
        simulation: true,
        decision_source: "seeded_fixture",
        next_action: "manual appointment review",
      },
      created_at: CALL_ENDED_AT,
    },
  });

  await db.auditLog.upsert({
    where: { id: "audit_responseos_demo" },
    update: {},
    create: {
      id: "audit_responseos_demo",
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      actor_type: "system",
      action: "demo.lifecycle.persisted",
      category: "workflow",
      target_type: "Call",
      target_id: RESPONSEOS_DEMO_CALL_ID,
      reason: "Deterministic prospect-facing sandbox fixture.",
      after_ref: {
        simulation: true,
        provider_effect: false,
        verified_revenue: false,
      },
      created_at: new Date("2026-08-15T14:04:32.000Z"),
    },
  });

  await db.revenueMetrics.upsert({
    where: {
      account_id_period_start_period_end: {
        account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
        period_start: new Date("2026-08-01T00:00:00.000Z"),
        period_end: new Date("2026-08-31T23:59:59.999Z"),
      },
    },
    update: {},
    create: {
      id: "revenue_responseos_demo",
      account_id: RESPONSEOS_DEMO_ACCOUNT_ID,
      period_start: new Date("2026-08-01T00:00:00.000Z"),
      period_end: new Date("2026-08-31T23:59:59.999Z"),
      total_calls: 1,
      calls_answered_by_ai: 0,
      qualified_leads: 1,
      appointments_booked: 1,
      quotes_requested: 1,
      estimated_recovered_revenue: 185_000,
      verified_recovered_revenue: 0,
      response_time_avg_seconds: 0,
      created_at: CALL_ENDED_AT,
    },
  });
}

export async function resetResponseOsDemoSandbox(
  db: PrismaClient,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const leadIds = await tx.leadEvent.findMany({
      where: { account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
      select: { id: true },
    });
    const ids = leadIds.map((lead) => lead.id);

    if (ids.length > 0) {
      await tx.leadQualification.deleteMany({
        where: { lead_event_id: { in: ids } },
      });
    }
    await tx.revenueMetrics.deleteMany({
      where: { account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
    });
    await tx.auditLog.deleteMany({
      where: { account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
    });
    await tx.workflowRun.deleteMany({
      where: { account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
    });
    await tx.quoteRequest.deleteMany({
      where: { account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
    });
    await tx.appointment.deleteMany({
      where: { account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
    });
    await tx.leadEvent.deleteMany({
      where: { account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
    });
    await tx.callTranscript.deleteMany({
      where: { account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
    });
    await tx.callSegment.deleteMany({
      where: { account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
    });
    await tx.call.deleteMany({
      where: { account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
    });
    await tx.contact.deleteMany({
      where: { account_id: RESPONSEOS_DEMO_ACCOUNT_ID },
    });
    await tx.account.deleteMany({
      where: {
        id: RESPONSEOS_DEMO_ACCOUNT_ID,
        account_type: "sandbox",
      },
    });

    await seedResponseOsDemoSandbox(tx);
  });
}
