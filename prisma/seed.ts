/**
 * ResponseOS — deterministic seed for v0.2.
 *
 * Aligned with docs/v0.2-implementation-spec.md §5.
 *
 * Rules:
 * - Idempotent: every record is upserted by stable id, so running this script
 *   N times produces the same final state.
 * - Deterministic ids: re-uses the existing mock fixture ids in lib/mock/*
 *   (org_mock_*, contact_mock_*, call_mock_*, lead_mock_*, booking_mock_*,
 *   quote_mock_*, rev_mock_*) so DB-backed dashboards render byte-identical
 *   numbers to the in-memory fixtures (Strict fixture parity per Q8 default).
 * - Fake-only data: phone numbers use the +1555… reserved test range, emails
 *   use .example TLDs, addresses are synthetic. No real client PII.
 * - Append-only AuditLog rows are upserted by stable id so re-running does
 *   not duplicate them.
 *
 * Run via:
 *   DATABASE_URL=postgresql://... DIRECT_URL=postgresql://... npx prisma db seed
 *
 * The PrismaClient binding lookup happens lazily so this file only requires a
 * generated client (`npx prisma generate`) at run time, not at typecheck time.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Stable timestamp anchors that match lib/mock/calls.ts and lib/mock/leads.ts
// so DB-backed dashboards line up with the existing in-memory fixtures.
const BASE_TIME = new Date("2026-05-04T14:30:00.000Z").getTime();
const at = (offsetMinutes: number): Date =>
  new Date(BASE_TIME + offsetMinutes * 60_000);

// Engagement / assessment anchors. Static so re-running is deterministic.
const ASSESSMENT_DELIVERED_AT = new Date("2026-04-20T15:00:00.000Z");
const ASSESSMENT_SIGNED_AT = new Date("2026-04-23T17:30:00.000Z");
const ENGAGEMENT_STARTED_AT = new Date("2026-04-24T13:00:00.000Z");
const PILOT_ENDS_AT = new Date("2026-07-23T17:30:00.000Z");

async function seedAccounts() {
  await prisma.account.upsert({
    where: { id: "org_mock_1" },
    update: {},
    create: {
      id: "org_mock_1",
      name: "Sunshine HVAC",
      slug: "sunshine-hvac",
      industry: "home-services",
      website_url: "https://sunshine-hvac.example",
      primary_phone: "+15555550100",
      timezone: "America/New_York",
      status: "active",
    },
  });

  await prisma.account.upsert({
    where: { id: "org_mock_2" },
    update: {},
    create: {
      id: "org_mock_2",
      name: "Coastal Roofing Co.",
      slug: "coastal-roofing",
      industry: "home-services",
      website_url: "https://coastalroofing.example",
      primary_phone: "+15555550200",
      timezone: "America/New_York",
      status: "active",
    },
  });
}

async function seedUsers() {
  // AJ Digital super-admin (cross-tenant; account_id null).
  await prisma.user.upsert({
    where: { id: "user_aj_admin_1" },
    update: {},
    create: {
      id: "user_aj_admin_1",
      account_id: null,
      role: "aj_admin",
      name: "AJ Admin",
      email: "aj@responseos.example",
      phone: "+15555550001",
    },
  });

  // Tenant owner for org_mock_1.
  await prisma.user.upsert({
    where: { id: "user_acme_owner_1" },
    update: {},
    create: {
      id: "user_acme_owner_1",
      account_id: "org_mock_1",
      role: "client_admin",
      name: "Sunshine Owner",
      email: "owner@sunshine-hvac.example",
      phone: "+15555550101",
    },
  });

  // Tenant viewer (office manager) for org_mock_1.
  await prisma.user.upsert({
    where: { id: "user_acme_viewer_1" },
    update: {},
    create: {
      id: "user_acme_viewer_1",
      account_id: "org_mock_1",
      role: "client_viewer",
      name: "Sunshine Office Manager",
      email: "manager@sunshine-hvac.example",
      phone: "+15555550102",
    },
  });
}

async function seedContacts() {
  await prisma.contact.upsert({
    where: { id: "contact_mock_1" },
    update: {},
    create: {
      id: "contact_mock_1",
      account_id: "org_mock_1",
      first_name: "Jordan",
      last_name: "Reyes",
      phone: "+15555550199",
      email: "jordan.reyes@example.com",
      address: "123 Main St",
      city: "Tampa",
      state: "FL",
      zip: "33601",
      source: "call",
    },
  });

  await prisma.contact.upsert({
    where: { id: "contact_mock_2" },
    update: {},
    create: {
      id: "contact_mock_2",
      account_id: "org_mock_1",
      first_name: "Avery",
      last_name: "Klein",
      phone: "+15555550288",
      email: "avery.klein@example.com",
      address: "123 Main St",
      city: "St. Petersburg",
      state: "FL",
      zip: "33701",
      source: "form",
    },
  });

  await prisma.contact.upsert({
    where: { id: "contact_mock_3" },
    update: {},
    create: {
      id: "contact_mock_3",
      account_id: "org_mock_2",
      first_name: "Sam",
      last_name: "Patel",
      phone: "+15555550377",
      email: "sam.patel@example.com",
      address: "123 Main St",
      city: "Clearwater",
      state: "FL",
      zip: "33755",
      source: "sms",
    },
  });
}

async function seedCalls() {
  await prisma.call.upsert({
    where: { id: "call_mock_1" },
    update: {},
    create: {
      id: "call_mock_1",
      account_id: "org_mock_1",
      contact_id: "contact_mock_1",
      provider: "twilio",
      direction: "inbound",
      status: "missed",
      from_number: "+15555550199",
      to_number: "+15555550100",
      started_at: at(0),
      ended_at: at(0),
      duration_seconds: 0,
      sentiment: "neutral",
      spam_score: 0.04,
      lead_score: 65,
    },
  });

  await prisma.call.upsert({
    where: { id: "call_mock_2" },
    update: {},
    create: {
      id: "call_mock_2",
      account_id: "org_mock_1",
      contact_id: "contact_mock_2",
      provider: "retell",
      direction: "inbound",
      status: "answered",
      from_number: "+15555550288",
      to_number: "+15555550100",
      started_at: at(45),
      ended_at: at(48),
      duration_seconds: 178,
      transcript:
        "Caller asked for AC quote on a 1,800 sq ft single-family home. Wants service this week.",
      summary: "AC quote request, single-family, this week timeline.",
      sentiment: "positive",
      spam_score: 0.02,
      lead_score: 84,
    },
  });

  await prisma.call.upsert({
    where: { id: "call_mock_3" },
    update: {},
    create: {
      id: "call_mock_3",
      account_id: "org_mock_1",
      contact_id: null,
      provider: "twilio",
      direction: "inbound",
      status: "spam",
      from_number: "+18005550000",
      to_number: "+15555550100",
      started_at: at(90),
      ended_at: at(90),
      duration_seconds: 4,
      sentiment: "neutral",
      spam_score: 0.94,
      lead_score: 5,
    },
  });

  await prisma.call.upsert({
    where: { id: "call_mock_4" },
    update: {},
    create: {
      id: "call_mock_4",
      account_id: "org_mock_2",
      contact_id: "contact_mock_3",
      provider: "vapi",
      direction: "outbound",
      status: "completed",
      from_number: "+15555550200",
      to_number: "+15555550377",
      started_at: at(120),
      ended_at: at(123),
      duration_seconds: 145,
      transcript: "Outbound recovery call after missed inbound. Booked an estimate.",
      summary: "Recovery success: estimate booked.",
      sentiment: "positive",
      spam_score: 0,
      lead_score: 79,
    },
  });
}

async function seedLeadEvents() {
  const events: Array<Parameters<typeof prisma.leadEvent.create>[0]["data"]> = [
    {
      id: "lead_mock_1",
      account_id: "org_mock_1",
      contact_id: "contact_mock_1",
      call_id: "call_mock_1",
      source: "phone",
      event_type: "missed_call",
      status: "new",
      urgency: "medium",
      estimated_value: 65_000,
      created_at: at(0),
      updated_at: at(0),
    },
    {
      id: "lead_mock_2",
      account_id: "org_mock_1",
      contact_id: "contact_mock_2",
      call_id: "call_mock_2",
      source: "phone",
      event_type: "qualified_lead",
      status: "qualified",
      urgency: "high",
      estimated_value: 120_000,
      created_at: at(48),
      updated_at: at(48),
    },
    {
      id: "lead_mock_3",
      account_id: "org_mock_1",
      contact_id: "contact_mock_2",
      source: "phone",
      event_type: "appointment_booked",
      status: "booked",
      urgency: "high",
      estimated_value: 120_000,
      created_at: at(50),
      updated_at: at(50),
    },
    {
      id: "lead_mock_4",
      account_id: "org_mock_1",
      contact_id: "contact_mock_1",
      source: "phone",
      event_type: "spam",
      status: "unqualified",
      urgency: "low",
      estimated_value: 75_000,
      notes: "Robocaller, marked spam.",
      created_at: at(91),
      updated_at: at(91),
    },
    {
      id: "lead_mock_5",
      account_id: "org_mock_2",
      contact_id: "contact_mock_3",
      call_id: "call_mock_4",
      source: "outbound",
      event_type: "appointment_booked",
      status: "booked",
      urgency: "medium",
      estimated_value: 240_000,
      recovered_value: 240_000,
      created_at: at(125),
      updated_at: at(125),
    },
    {
      id: "lead_mock_6",
      account_id: "org_mock_1",
      contact_id: "contact_mock_1",
      source: "website",
      event_type: "quote_request",
      status: "qualified",
      urgency: "medium",
      estimated_value: 95_000,
      created_at: at(180),
      updated_at: at(180),
    },
    {
      id: "lead_mock_7",
      account_id: "org_mock_1",
      contact_id: "contact_mock_1",
      source: "phone",
      event_type: "follow_up_needed",
      status: "new",
      urgency: "low",
      estimated_value: 75_000,
      created_at: at(210),
      updated_at: at(210),
    },
    {
      id: "lead_mock_8",
      account_id: "org_mock_2",
      contact_id: "contact_mock_3",
      source: "outbound",
      event_type: "quote_sent",
      status: "quoted",
      urgency: "medium",
      estimated_value: 240_000,
      created_at: at(260),
      updated_at: at(260),
    },
    {
      id: "lead_mock_9",
      account_id: "org_mock_1",
      contact_id: "contact_mock_2",
      source: "phone",
      event_type: "job_won",
      status: "won",
      urgency: "high",
      estimated_value: 120_000,
      recovered_value: 120_000,
      created_at: at(360),
      updated_at: at(360),
    },
    {
      id: "lead_mock_10",
      account_id: "org_mock_1",
      contact_id: "contact_mock_1",
      source: "phone",
      event_type: "job_lost",
      status: "lost",
      urgency: "low",
      estimated_value: 75_000,
      notes: "Customer chose competitor on price.",
      created_at: at(420),
      updated_at: at(420),
    },
    {
      id: "lead_mock_11",
      account_id: "org_mock_1",
      contact_id: "contact_mock_1",
      source: "sms",
      event_type: "qualified_lead",
      status: "qualified",
      urgency: "high",
      estimated_value: 80_000,
      created_at: at(480),
      updated_at: at(480),
    },
  ];

  for (const data of events) {
    await prisma.leadEvent.upsert({
      where: { id: data.id! },
      update: {},
      create: data,
    });
  }
}

async function seedLeadQualifications() {
  const rows: Array<Parameters<typeof prisma.leadQualification.create>[0]["data"]> = [
    {
      id: "qual_mock_lead_2",
      lead_event_id: "lead_mock_2",
      service_needed: "AC repair",
      service_area_match: true,
      budget_range: "1000-2000",
      timeline: "this_week",
      property_type: "single_family",
      decision_maker: true,
      qualification_score: 84,
      qualification_status: "qualified",
    },
    {
      id: "qual_mock_lead_3",
      lead_event_id: "lead_mock_3",
      service_needed: "AC repair estimate visit",
      service_area_match: true,
      budget_range: "1000-2000",
      timeline: "this_week",
      property_type: "single_family",
      decision_maker: true,
      qualification_score: 86,
      qualification_status: "qualified",
    },
    {
      id: "qual_mock_lead_8",
      lead_event_id: "lead_mock_8",
      service_needed: "Roof replacement",
      service_area_match: true,
      budget_range: "10000-20000",
      timeline: "this_month",
      property_type: "single_family",
      decision_maker: true,
      qualification_score: 78,
      qualification_status: "qualified",
    },
  ];

  for (const data of rows) {
    await prisma.leadQualification.upsert({
      where: { id: data.id! },
      update: {},
      create: data,
    });
  }
}

async function seedBookings() {
  // Static start/end so seed is fully deterministic (mock fixtures use Date.now()
  // but the seed uses fixed anchors to satisfy strict fixture parity at rest).
  const BOOKING_1_START = new Date("2026-05-08T15:00:00.000Z");
  const BOOKING_1_END = new Date("2026-05-08T16:30:00.000Z");
  const BOOKING_2_START = new Date("2026-05-09T17:00:00.000Z");
  const BOOKING_2_END = new Date("2026-05-09T18:00:00.000Z");

  await prisma.booking.upsert({
    where: { id: "booking_mock_1" },
    update: {},
    create: {
      id: "booking_mock_1",
      account_id: "org_mock_1",
      contact_id: "contact_mock_2",
      lead_event_id: "lead_mock_3",
      calendar_provider: "google",
      title: "AC repair estimate — Avery Klein",
      start_time: BOOKING_1_START,
      end_time: BOOKING_1_END,
      status: "confirmed",
      location: "1500 Bay St, St. Petersburg, FL 33701",
    },
  });

  await prisma.booking.upsert({
    where: { id: "booking_mock_2" },
    update: {},
    create: {
      id: "booking_mock_2",
      account_id: "org_mock_2",
      contact_id: "contact_mock_3",
      lead_event_id: "lead_mock_5",
      calendar_provider: "calcom",
      title: "Roof inspection — Sam Patel",
      start_time: BOOKING_2_START,
      end_time: BOOKING_2_END,
      status: "scheduled",
      location: "880 Gulf Blvd, Clearwater, FL 33755",
    },
  });
}

async function seedQuoteRequests() {
  await prisma.quoteRequest.upsert({
    where: { id: "quote_mock_1" },
    update: {},
    create: {
      id: "quote_mock_1",
      account_id: "org_mock_1",
      contact_id: "contact_mock_1",
      lead_event_id: "lead_mock_6",
      service_type: "AC tune-up + repair",
      description: "Two-zone unit, upstairs blowing warm air.",
      photos: [],
      property_address: "123 Main St, Tampa, FL 33601",
      estimated_value: 95_000,
      status: "reviewing",
    },
  });

  await prisma.quoteRequest.upsert({
    where: { id: "quote_mock_2" },
    update: {},
    create: {
      id: "quote_mock_2",
      account_id: "org_mock_2",
      contact_id: "contact_mock_3",
      lead_event_id: "lead_mock_8",
      service_type: "Roof replacement",
      description: "Asphalt shingle, ~2,200 sq ft, post-storm assessment.",
      photos: [],
      property_address: "880 Gulf Blvd, Clearwater, FL 33755",
      estimated_value: 240_000,
      status: "sent",
    },
  });
}

async function seedRevenueMetrics() {
  await prisma.revenueMetrics.upsert({
    where: { id: "rev_mock_current" },
    update: {},
    create: {
      id: "rev_mock_current",
      account_id: "org_mock_1",
      period_start: new Date("2026-05-01T00:00:00.000Z"),
      period_end: new Date("2026-05-31T23:59:59.999Z"),
      total_calls: 87,
      missed_calls: 31,
      calls_answered_by_ai: 24,
      qualified_leads: 14,
      appointments_booked: 8,
      quotes_requested: 4,
      quotes_sent: 3,
      jobs_won: 2,
      estimated_recovered_revenue: 1_245_000,
      verified_recovered_revenue: 540_000,
      admin_hours_saved: 22,
      response_time_avg_seconds: 38,
      roi_multiple: 3.8,
    },
  });

  await prisma.revenueMetrics.upsert({
    where: { id: "rev_mock_prev_1" },
    update: {},
    create: {
      id: "rev_mock_prev_1",
      account_id: "org_mock_1",
      period_start: new Date("2026-04-01T00:00:00.000Z"),
      period_end: new Date("2026-04-30T23:59:59.999Z"),
      total_calls: 71,
      missed_calls: 27,
      calls_answered_by_ai: 19,
      qualified_leads: 11,
      appointments_booked: 6,
      quotes_requested: 3,
      quotes_sent: 2,
      jobs_won: 1,
      estimated_recovered_revenue: 880_000,
      verified_recovered_revenue: 310_000,
      admin_hours_saved: 17,
      response_time_avg_seconds: 51,
      roi_multiple: 2.7,
    },
  });

  await prisma.revenueMetrics.upsert({
    where: { id: "rev_mock_prev_2" },
    update: {},
    create: {
      id: "rev_mock_prev_2",
      account_id: "org_mock_1",
      period_start: new Date("2026-03-01T00:00:00.000Z"),
      period_end: new Date("2026-03-31T23:59:59.999Z"),
      total_calls: 64,
      missed_calls: 30,
      calls_answered_by_ai: 12,
      qualified_leads: 8,
      appointments_booked: 4,
      quotes_requested: 2,
      quotes_sent: 1,
      jobs_won: 1,
      estimated_recovered_revenue: 620_000,
      verified_recovered_revenue: 180_000,
      admin_hours_saved: 12,
      response_time_avg_seconds: 64,
      roi_multiple: 1.9,
    },
  });
}

async function seedAssessmentReport() {
  await prisma.assessmentReport.upsert({
    where: { id: "assessment_mock_1" },
    update: {},
    create: {
      id: "assessment_mock_1",
      account_id: "org_mock_1",
      status: "signed",
      inputs_json: {
        missed_call_volume_per_month: 31,
        after_hours_demand_pct: 22,
        avg_job_value_cents: 95_000,
        close_rate_pct: 38,
        response_time_seconds_p50: 62,
        lead_sources: ["phone", "website", "sms"],
        crm_readiness: "basic",
        booking_workflow: "manual_calendar",
        quote_workflow: "spreadsheet",
        follow_up_process: "ad_hoc",
        calendar_readiness: "shared_google",
        escalation_process: "owner_phone",
        compliance_risk: "low",
        notes: "Synthetic fixture inputs only.",
      },
      readiness_score: 72,
      revenue_leak_estimate: 1_245_000,
      fit_diagnosis: "ai_fit",
      current_workflow_map: {
        nodes: ["call_in", "voicemail", "manual_callback"],
      },
      recommended_workflow_map: {
        nodes: [
          "call_in",
          "ai_response",
          "qualification",
          "booking",
          "owner_notify",
        ],
      },
      implementation_scope:
        "Recovery Pro: AI receptionist + qualification + booking + recovery SMS.",
      projected_roi_multiple: 3.8,
      proposed_tier: "recovery_pro",
      proposed_setup_cents: 650_000,
      proposed_monthly_cents: 200_000,
      proposed_outcome_terms: {
        kind: "per_qualified_appointment",
        rate_cents: 7_500,
      },
      delivered_at: ASSESSMENT_DELIVERED_AT,
      signed_at: ASSESSMENT_SIGNED_AT,
    },
  });
}

async function seedEngagement() {
  await prisma.engagement.upsert({
    where: { id: "engagement_mock_1" },
    update: {},
    create: {
      id: "engagement_mock_1",
      account_id: "org_mock_1",
      assessment_report_id: "assessment_mock_1",
      tier: "recovery_pro",
      status: "active",
      setup_fee_cents: 650_000,
      monthly_fee_cents: 200_000,
      outcome_fee_kind: "per_qualified_appointment",
      outcome_fee_terms_json: {
        rate_cents: 7_500,
        threshold: 0,
      },
      usage_model: "bundled_with_cap",
      included_voice_minutes: 2_000,
      passthrough_margin_pct: null,
      is_founding_pilot: true,
      pilot_ends_at: PILOT_ENDS_AT,
      signed_at: ASSESSMENT_SIGNED_AT,
      started_at: ENGAGEMENT_STARTED_AT,
    },
  });
}

async function seedAuditLogs() {
  const rows: Array<Parameters<typeof prisma.auditLog.create>[0]["data"]> = [
    {
      id: "audit_mock_1",
      account_id: "org_mock_1",
      actor_user_id: "user_aj_admin_1",
      actor_type: "user",
      action: "account.created",
      target_type: "Account",
      target_id: "org_mock_1",
      created_at: new Date("2026-04-10T12:00:00.000Z"),
    },
    {
      id: "audit_mock_2",
      account_id: "org_mock_1",
      actor_user_id: "user_aj_admin_1",
      actor_type: "user",
      action: "assessment.delivered",
      target_type: "AssessmentReport",
      target_id: "assessment_mock_1",
      created_at: ASSESSMENT_DELIVERED_AT,
    },
    {
      id: "audit_mock_3",
      account_id: "org_mock_1",
      actor_user_id: "user_acme_owner_1",
      actor_type: "user",
      action: "assessment.signed",
      target_type: "AssessmentReport",
      target_id: "assessment_mock_1",
      created_at: ASSESSMENT_SIGNED_AT,
    },
    {
      id: "audit_mock_4",
      account_id: "org_mock_1",
      actor_user_id: null,
      actor_type: "system",
      action: "engagement.created",
      target_type: "Engagement",
      target_id: "engagement_mock_1",
      created_at: ASSESSMENT_SIGNED_AT,
    },
    {
      id: "audit_mock_5",
      account_id: "org_mock_1",
      actor_user_id: null,
      actor_type: "system",
      action: "lead.qualified",
      target_type: "LeadEvent",
      target_id: "lead_mock_2",
      created_at: at(48),
    },
    {
      id: "audit_mock_6",
      account_id: "org_mock_1",
      actor_user_id: null,
      actor_type: "system",
      action: "booking.confirmed",
      target_type: "Booking",
      target_id: "booking_mock_1",
      created_at: at(60),
    },
  ];

  for (const data of rows) {
    await prisma.auditLog.upsert({
      where: { id: data.id! },
      update: {},
      create: data,
    });
  }
}

async function main() {
  await seedAccounts();
  await seedUsers();
  await seedContacts();
  await seedCalls();
  await seedLeadEvents();
  await seedLeadQualifications();
  await seedBookings();
  await seedQuoteRequests();
  await seedRevenueMetrics();
  await seedAssessmentReport();
  await seedEngagement();
  await seedAuditLogs();
  // WebhookEvent intentionally seeded empty per spec §5; the v0.3 ingest path
  // is the first writer.
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
