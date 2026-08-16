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

// Internal demo tenant anchors (ADR-0046). Fixed so the reference
// account seeds byte-identically on every run.
const DEMO_PROFILE_AT = new Date("2026-08-03T12:00:00.000Z");
const DEMO_CALL_STARTED = new Date("2026-08-03T14:15:00.000Z");
const DEMO_CALL_ENDED = new Date("2026-08-03T14:21:00.000Z");
const DEMO_OPPORTUNITY_AT = new Date("2026-08-03T14:22:00.000Z");
const DEMO_APPOINTMENT_START = new Date("2026-08-13T18:00:00.000Z");
const DEMO_APPOINTMENT_END = new Date("2026-08-13T18:30:00.000Z");
const DEMO_SMS_AT = new Date("2026-08-03T14:25:00.000Z");
const DEMO_SMS_REPLY_AT = new Date("2026-08-03T14:31:00.000Z");

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

  // ResponseOS reference tenant (ADR-0046). An ordinary account in
  // every respect — same accessors, same isolation, same audit — with
  // `internal_demo` classification so it never counts as customer
  // revenue.
  await prisma.account.upsert({
    where: { id: "org_tyrone_1" },
    update: {},
    create: {
      id: "org_tyrone_1",
      name: "Tyrone Nelms",
      slug: "tyrone-nelms",
      industry: "professional-services",
      website_url: "https://tyronenelms.example",
      primary_phone: "+15555550700",
      timezone: "America/New_York",
      status: "active",
      account_type: "internal_demo",
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

  // Owner of the internal demo tenant.
  await prisma.user.upsert({
    where: { id: "user_tyrone_1" },
    update: {},
    create: {
      id: "user_tyrone_1",
      account_id: "org_tyrone_1",
      role: "client_admin",
      name: "Tyrone Nelms",
      email: "tyrone@tyronenelms.example",
      phone: "+15555550700",
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

  // Recruiter who reached the internal demo tenant's receptionist.
  await prisma.contact.upsert({
    where: { id: "contact_tyrone_recruiter_1" },
    update: {},
    create: {
      id: "contact_tyrone_recruiter_1",
      account_id: "org_tyrone_1",
      first_name: "Jane",
      last_name: "Smith",
      phone: "+15555550701",
      email: "jane.smith@northwind.example",
      source: "call",
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

  // Internal demo tenant — recruiter call answered by the professional
  // receptionist. The transcript deliberately shows the receptionist
  // declining to answer unverified career questions.
  await prisma.call.upsert({
    where: { id: "call_tyrone_1" },
    update: {},
    create: {
      id: "call_tyrone_1",
      account_id: "org_tyrone_1",
      contact_id: "contact_tyrone_recruiter_1",
      provider: "vapi",
      direction: "inbound",
      status: "answered",
      from_number: "+15555550701",
      to_number: "+15555550700",
      started_at: DEMO_CALL_STARTED,
      ended_at: DEMO_CALL_ENDED,
      duration_seconds: 360,
      transcript:
        "Recruiter asked about business systems experience, AI implementation experience and stakeholder management. No verified career record is loaded, so each question was captured rather than answered, and a recruiter screen was scheduled.",
      summary:
        "Recruiter screen requested for a Business Systems Analyst role; three career questions captured for follow-up.",
      sentiment: "positive",
      spam_score: 0,
      lead_score: 88,
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

async function seedAppointments() {
  // Static start/end so seed is fully deterministic (mock fixtures use Date.now()
  // but the seed uses fixed anchors to satisfy strict fixture parity at rest).
  const BOOKING_1_START = new Date("2026-05-08T15:00:00.000Z");
  const BOOKING_1_END = new Date("2026-05-08T16:30:00.000Z");
  const BOOKING_2_START = new Date("2026-05-09T17:00:00.000Z");
  const BOOKING_2_END = new Date("2026-05-09T18:00:00.000Z");

  await prisma.appointment.upsert({
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

  await prisma.appointment.upsert({
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

  // Internal demo tenant — recruiter screen booked by the receptionist.
  await prisma.appointment.upsert({
    where: { id: "booking_tyrone_1" },
    update: {},
    create: {
      id: "booking_tyrone_1",
      account_id: "org_tyrone_1",
      contact_id: "contact_tyrone_recruiter_1",
      calendar_provider: "manual",
      title: "Recruiter screen — Jane Smith (Northwind Systems)",
      start_time: DEMO_APPOINTMENT_START,
      end_time: DEMO_APPOINTMENT_END,
      status: "scheduled",
      notes:
        "Booked by the ResponseOS professional receptionist (recruiter_screen).",
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
      action: "appointment.confirmed",
      target_type: "Appointment",
      target_id: "booking_mock_1",
      created_at: at(60),
    },
    // 31D — exercises the expanded AuditLog substrate (actor_role,
    // category, reason, before_ref, after_ref, expires_at). This row
    // is the canonical example of the break-glass category. The
    // privileged read accessor that will write rows like this lands
    // in a separate PR after 31D is merged + reviewed.
    {
      id: "audit_mock_7",
      account_id: "org_mock_1",
      actor_user_id: "user_aj_admin_1",
      actor_type: "user",
      actor_role: "aj_admin",
      action: "transcript.break_glass.read",
      category: "break_glass",
      target_type: "CallTranscript",
      target_id: "xcr_mock_1",
      reason: "Incident #demo investigation",
      before_ref: { artifact_state: "redacted_only_visible" },
      after_ref: { artifact_state: "raw_briefly_revealed" },
      expires_at: new Date("2026-05-04T17:30:00.000Z"),
      created_at: new Date("2026-05-04T16:30:00.000Z"),
    },
    // Internal demo tenant — the receptionist's own write path is
    // audited exactly like a customer tenant's.
    {
      id: "audit_tyrone_1",
      account_id: "org_tyrone_1",
      actor_user_id: null,
      actor_type: "system",
      action: "professional.opportunity.created",
      category: "workflow",
      target_type: "ProfessionalOpportunity",
      target_id: "popp_tyrone_1",
      metadata_json: {
        agent_profile_id: "agent_tyrone_recruiter",
        opportunity_type: "employment",
      },
      created_at: DEMO_OPPORTUNITY_AT,
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

// --- v0.2 closeout step 2.3, PR 31A — communication substrate seeds --------

// Mock-sentinel bytes per ADR-0020. Stored verbatim in
// `credentials_encrypted` when no `RESPONSEOS_PROVIDER_KEY` is set.
// The bytes are the UTF-8 encoding of the literal string "<MOCK_REDACTED>".
const MOCK_CREDENTIAL_SENTINEL = Buffer.from("<MOCK_REDACTED>", "utf8");
const CONNECTION_VERIFIED_AT = new Date("2026-05-04T14:30:00.000Z");
const CONV_1_LAST_MESSAGE = new Date("2026-05-04T15:45:00.000Z");
const CONV_2_LAST_MESSAGE = new Date("2026-05-04T17:30:00.000Z");
const SMS_1_AT = new Date("2026-05-04T15:43:00.000Z");
const SMS_2_AT = new Date("2026-05-04T15:45:00.000Z");
const SMS_3_AT = new Date("2026-05-04T17:25:00.000Z");
const SMS_4_AT = new Date("2026-05-04T17:30:00.000Z");

async function seedProviderConnections() {
  await prisma.providerConnection.upsert({
    where: { id: "pconn_mock_1" },
    update: {},
    create: {
      id: "pconn_mock_1",
      account_id: "org_mock_1",
      provider: "twilio",
      credentials_encrypted: MOCK_CREDENTIAL_SENTINEL,
      status: "connected",
      scopes: [],
      connected_by: "user_acme_owner_1",
      last_verified_at: CONNECTION_VERIFIED_AT,
      created_at: CONNECTION_VERIFIED_AT,
    },
  });

  await prisma.providerConnection.upsert({
    where: { id: "pconn_mock_2" },
    update: {},
    create: {
      id: "pconn_mock_2",
      account_id: "org_mock_1",
      provider: "hubspot",
      credentials_encrypted: MOCK_CREDENTIAL_SENTINEL,
      status: "connected",
      scopes: [
        "crm.objects.contacts.read",
        "crm.objects.contacts.write",
        "crm.objects.deals.read",
        "crm.objects.deals.write",
      ],
      connected_by: "user_acme_owner_1",
      last_verified_at: CONNECTION_VERIFIED_AT,
      created_at: CONNECTION_VERIFIED_AT,
    },
  });
}

async function seedConversations() {
  await prisma.conversation.upsert({
    where: { id: "conv_mock_1" },
    update: {},
    create: {
      id: "conv_mock_1",
      account_id: "org_mock_1",
      contact_id: "contact_mock_1",
      business_number: "+15555550100",
      peer_number: "+15555550199",
      status: "open",
      last_message_at: CONV_1_LAST_MESSAGE,
      created_at: CONV_1_LAST_MESSAGE,
    },
  });

  await prisma.conversation.upsert({
    where: { id: "conv_mock_2" },
    update: {},
    create: {
      id: "conv_mock_2",
      account_id: "org_mock_2",
      contact_id: "contact_mock_3",
      business_number: "+15555550200",
      peer_number: "+15555550377",
      status: "open",
      last_message_at: CONV_2_LAST_MESSAGE,
      created_at: CONV_2_LAST_MESSAGE,
    },
  });

  await prisma.conversation.upsert({
    where: { id: "conv_tyrone_1" },
    update: {},
    create: {
      id: "conv_tyrone_1",
      account_id: "org_tyrone_1",
      contact_id: "contact_tyrone_recruiter_1",
      business_number: "+15555550700",
      peer_number: "+15555550701",
      status: "open",
      last_message_at: DEMO_SMS_REPLY_AT,
      created_at: DEMO_SMS_AT,
    },
  });
}

async function seedSmsMessages() {
  await prisma.smsMessage.upsert({
    where: { id: "sms_mock_1" },
    update: {},
    create: {
      id: "sms_mock_1",
      account_id: "org_mock_1",
      conversation_id: "conv_mock_1",
      provider: "twilio",
      provider_message_id: "SM_mock_1",
      direction: "inbound",
      from_number: "+15555550199",
      to_number: "+15555550100",
      body: "Hi — looking for an AC tune-up quote this week.",
      status: "received",
      segment_count: 1,
      created_at: SMS_1_AT,
    },
  });

  await prisma.smsMessage.upsert({
    where: { id: "sms_mock_2" },
    update: {},
    create: {
      id: "sms_mock_2",
      account_id: "org_mock_1",
      conversation_id: "conv_mock_1",
      provider: "twilio",
      provider_message_id: "SM_mock_2",
      direction: "outbound",
      from_number: "+15555550100",
      to_number: "+15555550199",
      body: "Thanks for reaching out. We can be on-site Thursday at 3pm.",
      status: "delivered",
      segment_count: 1,
      sent_at: SMS_2_AT,
      delivered_at: SMS_2_AT,
      created_at: SMS_2_AT,
    },
  });

  await prisma.smsMessage.upsert({
    where: { id: "sms_mock_3" },
    update: {},
    create: {
      id: "sms_mock_3",
      account_id: "org_mock_2",
      conversation_id: "conv_mock_2",
      provider: "twilio",
      provider_message_id: "SM_mock_3",
      direction: "inbound",
      from_number: "+15555550377",
      to_number: "+15555550200",
      body: "Need a roof inspection — any availability this week?",
      status: "received",
      segment_count: 1,
      created_at: SMS_3_AT,
    },
  });

  await prisma.smsMessage.upsert({
    where: { id: "sms_mock_4" },
    update: {},
    create: {
      id: "sms_mock_4",
      account_id: "org_mock_2",
      conversation_id: "conv_mock_2",
      provider: "twilio",
      provider_message_id: "SM_mock_4",
      direction: "outbound",
      from_number: "+15555550200",
      to_number: "+15555550377",
      body: "We can stop by Friday at 10am — confirming via email shortly.",
      status: "delivered",
      segment_count: 1,
      sent_at: SMS_4_AT,
      delivered_at: SMS_4_AT,
      created_at: SMS_4_AT,
    },
  });

  await prisma.smsMessage.upsert({
    where: { id: "sms_tyrone_1" },
    update: {},
    create: {
      id: "sms_tyrone_1",
      account_id: "org_tyrone_1",
      conversation_id: "conv_tyrone_1",
      provider: "manual",
      provider_message_id: "SM_tyrone_1",
      direction: "outbound",
      from_number: "+15555550700",
      to_number: "+15555550701",
      body: "Recruiter screen confirmed for Aug 13, 2:00pm ET. Your three questions were passed along for Tyrone to answer directly.",
      status: "delivered",
      segment_count: 1,
      sent_at: DEMO_SMS_AT,
      delivered_at: DEMO_SMS_AT,
      created_at: DEMO_SMS_AT,
    },
  });

  await prisma.smsMessage.upsert({
    where: { id: "sms_tyrone_2" },
    update: {},
    create: {
      id: "sms_tyrone_2",
      account_id: "org_tyrone_1",
      conversation_id: "conv_tyrone_1",
      provider: "manual",
      provider_message_id: "SM_tyrone_2",
      direction: "inbound",
      from_number: "+15555550701",
      to_number: "+15555550700",
      body: "Great — I'll send the role description before the call.",
      status: "received",
      segment_count: 1,
      created_at: DEMO_SMS_REPLY_AT,
    },
  });
}

// --- v0.2 closeout step 2.3, PR 31B — call intelligence substrate seeds ---

// Anchored to call_mock_2 (the seeded "answered" call) so the seeded
// segments / transcript / qa log all attach to the only call in the
// fixtures that has a transcript body.
const SEG_1_START = new Date("2026-05-04T15:15:00.000Z");
const SEG_1_END = new Date("2026-05-04T15:15:08.000Z");
const SEG_2_START = new Date("2026-05-04T15:15:08.000Z");
const SEG_2_END = new Date("2026-05-04T15:15:18.000Z");
const TRANSCRIPT_CREATED_AT = new Date("2026-05-04T15:18:30.000Z");
const QA_REVIEWED_AT = new Date("2026-05-04T16:00:00.000Z");

async function seedCallSegments() {
  await prisma.callSegment.upsert({
    where: { id: "seg_mock_1" },
    update: {},
    create: {
      id: "seg_mock_1",
      account_id: "org_mock_1",
      call_id: "call_mock_2",
      sequence: 1,
      speaker: "caller",
      text: "Hi, I'm looking for an AC tune-up quote for my single-family home in Tampa.",
      confidence: 0.92,
      started_at: SEG_1_START,
      ended_at: SEG_1_END,
      created_at: SEG_1_END,
    },
  });

  await prisma.callSegment.upsert({
    where: { id: "seg_mock_2" },
    update: {},
    create: {
      id: "seg_mock_2",
      account_id: "org_mock_1",
      call_id: "call_mock_2",
      sequence: 2,
      speaker: "agent",
      text: "Happy to help. About what year was the unit installed, and what's the square footage?",
      confidence: 0.95,
      started_at: SEG_2_START,
      ended_at: SEG_2_END,
      created_at: SEG_2_END,
    },
  });

  const demoTurns = [
    {
      id: "seg_tyrone_1",
      sequence: 1,
      speaker: "caller" as const,
      text: "Hi — I'm a recruiter at Northwind Systems. Can you tell me about Tyrone's business systems experience?",
      confidence: 0.94,
      offsetSeconds: 0,
    },
    {
      id: "seg_tyrone_2",
      sequence: 2,
      speaker: "agent" as const,
      text: "I don't have verified information available for that, but I can note the question for Tyrone or help schedule a conversation with Tyrone.",
      confidence: 0.97,
      offsetSeconds: 12,
    },
    {
      id: "seg_tyrone_3",
      sequence: 3,
      speaker: "caller" as const,
      text: "Let's schedule a recruiter screen for the Business Systems Analyst role.",
      confidence: 0.95,
      offsetSeconds: 24,
    },
  ];

  for (const turn of demoTurns) {
    const startedAt = new Date(
      DEMO_CALL_STARTED.getTime() + turn.offsetSeconds * 1_000,
    );
    const endedAt = new Date(startedAt.getTime() + 10_000);
    await prisma.callSegment.upsert({
      where: { id: turn.id },
      update: {},
      create: {
        id: turn.id,
        account_id: "org_tyrone_1",
        call_id: "call_tyrone_1",
        sequence: turn.sequence,
        speaker: turn.speaker,
        text: turn.text,
        confidence: turn.confidence,
        started_at: startedAt,
        ended_at: endedAt,
        created_at: endedAt,
      },
    });
  }
}

async function seedCallTranscripts() {
  await prisma.callTranscript.upsert({
    where: { id: "xcr_mock_1" },
    update: {},
    create: {
      id: "xcr_mock_1",
      account_id: "org_mock_1",
      call_id: "call_mock_2",
      inline_text:
        "Caller asked for AC quote on a 1,800 sq ft single-family home. Wants service this week.",
      language: "en",
      retention_lane: "full",
      created_at: TRANSCRIPT_CREATED_AT,
    },
  });

  await prisma.callTranscript.upsert({
    where: { id: "xcr_tyrone_1" },
    update: {},
    create: {
      id: "xcr_tyrone_1",
      account_id: "org_tyrone_1",
      call_id: "call_tyrone_1",
      inline_text:
        "Recruiter asked about business systems experience, AI implementation experience and stakeholder management. No verified career record is loaded, so each question was captured rather than answered, and a recruiter screen was scheduled.",
      language: "en",
      retention_lane: "full",
      created_at: DEMO_CALL_ENDED,
    },
  });
}

async function seedQaLogs() {
  await prisma.qaLog.upsert({
    where: { id: "qa_mock_1" },
    update: {},
    create: {
      id: "qa_mock_1",
      account_id: "org_mock_1",
      call_id: "call_mock_2",
      rubric_version: "v1",
      reviewer_type: "system",
      score: 84,
      findings_json: {
        greeting: "pass",
        qualification: "pass",
        next_step: "pass",
      },
      notes: "Caller qualified; estimate visit scheduled.",
      reviewed_at: QA_REVIEWED_AT,
      created_at: QA_REVIEWED_AT,
    },
  });

  await prisma.qaLog.upsert({
    where: { id: "qa_tyrone_1" },
    update: {},
    create: {
      id: "qa_tyrone_1",
      account_id: "org_tyrone_1",
      call_id: "call_tyrone_1",
      rubric_version: "v1",
      reviewer_type: "system",
      score: 91,
      findings_json: {
        greeting: "pass",
        grounding: "pass",
        unverified_claim_avoided: "pass",
        next_step: "pass",
      },
      notes:
        "Receptionist declined all three unverified career questions and captured them instead; recruiter screen scheduled.",
      reviewed_at: DEMO_OPPORTUNITY_AT,
      created_at: DEMO_OPPORTUNITY_AT,
    },
  });
}

// --- v0.2 closeout step 2.3, PR 31C — workflow execution substrate seeds --

const WFR_1_STARTED = new Date("2026-05-04T15:18:30.000Z");
const WFR_1_ENDED = new Date("2026-05-04T15:18:33.000Z");
const WFR_2_STARTED = new Date("2026-05-04T17:30:00.000Z");
const WFR_2_ENDED = new Date("2026-05-04T17:30:04.000Z");

async function seedWorkflowRuns() {
  await prisma.workflowRun.upsert({
    where: { id: "wfr_mock_1" },
    update: {},
    create: {
      id: "wfr_mock_1",
      account_id: "org_mock_1",
      workflow_run_id: "n8n_run_mock_1",
      workflow_id: "missed_call_recovery",
      provider: "n8n",
      trigger_event_id: "call_mock_1",
      status: "completed",
      started_at: WFR_1_STARTED,
      ended_at: WFR_1_ENDED,
      created_at: WFR_1_STARTED,
    },
  });

  await prisma.workflowRun.upsert({
    where: { id: "wfr_mock_2" },
    update: {},
    create: {
      id: "wfr_mock_2",
      account_id: "org_mock_2",
      workflow_run_id: "n8n_run_mock_2",
      workflow_id: "new_lead_followup",
      provider: "n8n",
      trigger_event_id: "lead_mock_5",
      status: "failed",
      started_at: WFR_2_STARTED,
      ended_at: WFR_2_ENDED,
      error_message: "vendor_unavailable",
      created_at: WFR_2_STARTED,
    },
  });

  await prisma.workflowRun.upsert({
    where: { id: "wfr_tyrone_1" },
    update: {},
    create: {
      id: "wfr_tyrone_1",
      account_id: "org_tyrone_1",
      workflow_run_id: "internal_run_tyrone_1",
      workflow_id: "professional_opportunity_intake",
      provider: "internal",
      trigger_event_id: "call_tyrone_1",
      status: "completed",
      started_at: DEMO_OPPORTUNITY_AT,
      ended_at: DEMO_OPPORTUNITY_AT,
      created_at: DEMO_OPPORTUNITY_AT,
    },
  });
}

// --- Internal demo professional receptionist (ADR-0046) -------------------

async function seedAgentProfiles() {
  const profiles: Array<
    Parameters<typeof prisma.agentProfile.create>[0]["data"]
  > = [
    {
      id: "agent_tyrone_consulting",
      account_id: "org_tyrone_1",
      name: "Consulting Receptionist",
      slug: "consulting-receptionist",
      type: "consulting_receptionist",
      enabled: true,
      is_default: false,
      system_policy_json: {
        allowedAppointmentTypes: ["consulting_discovery"],
        allowedAssetTypes: ["portfolio", "case_study"],
        compensationDisclosure: "escalate",
        referencesDisclosure: "escalate",
        knowledgeFallback: "verified_only",
      },
      metadata_json: {
        description:
          "Qualifies consulting and advisory inquiries, captures the operational problem, and routes discovery calls.",
      },
      created_at: DEMO_PROFILE_AT,
      updated_at: DEMO_PROFILE_AT,
    },
    {
      id: "agent_tyrone_demo",
      account_id: "org_tyrone_1",
      name: "Demo Mode",
      slug: "demo-mode",
      type: "demo_mode",
      enabled: true,
      is_default: false,
      system_policy_json: {
        allowedAppointmentTypes: ["demo"],
        allowedAssetTypes: [],
        compensationDisclosure: "escalate",
        referencesDisclosure: "escalate",
        knowledgeFallback: "verified_only",
      },
      metadata_json: {
        description:
          "Narrates the ResponseOS workflow being exercised during a live demonstration while staying grounded in this account's real records.",
      },
      created_at: DEMO_PROFILE_AT,
      updated_at: DEMO_PROFILE_AT,
    },
    {
      id: "agent_tyrone_professional",
      account_id: "org_tyrone_1",
      name: "Professional Assistant",
      slug: "professional-assistant",
      type: "professional_assistant",
      enabled: true,
      is_default: false,
      system_policy_json: {
        allowedAppointmentTypes: ["professional_intro"],
        allowedAssetTypes: ["portfolio", "linkedin"],
        compensationDisclosure: "escalate",
        referencesDisclosure: "escalate",
        knowledgeFallback: "verified_only",
      },
      metadata_json: {
        description:
          "General professional front door — who Tyrone is, what he works on, and how to reach him.",
      },
      created_at: DEMO_PROFILE_AT,
      updated_at: DEMO_PROFILE_AT,
    },
    {
      id: "agent_tyrone_recruiter",
      account_id: "org_tyrone_1",
      name: "Recruiter Receptionist",
      slug: "recruiter-receptionist",
      type: "recruiter_receptionist",
      enabled: true,
      is_default: true,
      system_policy_json: {
        allowedAppointmentTypes: [
          "recruiter_screen",
          "hiring_manager_interview",
        ],
        allowedAssetTypes: ["resume", "portfolio", "linkedin", "github"],
        compensationDisclosure: "escalate",
        referencesDisclosure: "escalate",
        knowledgeFallback: "verified_only",
      },
      metadata_json: {
        description:
          "Answers verified questions about Tyrone Nelms' professional experience, projects and capabilities, captures recruiting opportunities, and helps schedule interviews.",
      },
      created_at: DEMO_PROFILE_AT,
      updated_at: DEMO_PROFILE_AT,
    },
  ];

  for (const data of profiles) {
    await prisma.agentProfile.upsert({
      where: { id: data.id! },
      update: {},
      create: data,
    });
  }
}

async function seedProfessionalOpportunities() {
  await prisma.professionalOpportunity.upsert({
    where: { id: "popp_tyrone_1" },
    update: {},
    create: {
      id: "popp_tyrone_1",
      account_id: "org_tyrone_1",
      contact_id: "contact_tyrone_recruiter_1",
      agent_profile_id: "agent_tyrone_recruiter",
      opportunity_type: "employment",
      company: "Northwind Systems",
      role_title: "Business Systems Analyst",
      recruiter_name: "Jane Smith",
      recruiter_email: "jane.smith@northwind.example",
      recruiter_phone: "+15555550701",
      interest_level: "high",
      status: "scheduled",
      source_call_id: "call_tyrone_1",
      source_conversation_id: "conv_tyrone_1",
      appointment_id: "booking_tyrone_1",
      questions_asked: [
        "business systems experience",
        "AI implementation experience",
        "stakeholder management",
      ],
      summary:
        "Recruiter screen requested for a Business Systems Analyst role. Career questions were not answered from memory — no verified Career OS record is loaded, so each one was captured for follow-up.",
      recommended_preparation: [
        "review the company platform",
        "prepare an operations case study",
        "prepare a business systems transformation example",
      ],
      next_action: "prepare for recruiter interview",
      created_at: DEMO_OPPORTUNITY_AT,
      updated_at: DEMO_OPPORTUNITY_AT,
    },
  });
}

async function main() {
  await seedAccounts();
  await seedUsers();
  await seedContacts();
  await seedCalls();
  await seedLeadEvents();
  await seedLeadQualifications();
  await seedAppointments();
  await seedQuoteRequests();
  await seedRevenueMetrics();
  await seedAssessmentReport();
  await seedEngagement();
  await seedAuditLogs();
  await seedProviderConnections();
  await seedConversations();
  await seedSmsMessages();
  await seedCallSegments();
  await seedCallTranscripts();
  await seedQaLogs();
  await seedWorkflowRuns();
  await seedAgentProfiles();
  await seedProfessionalOpportunities();
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
