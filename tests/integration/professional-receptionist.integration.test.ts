import { afterAll, beforeEach, describe, expect, test } from "vitest";
import {
  AgentProfiles,
  ProfessionalOpportunities,
  RevenueMetrics,
} from "@/lib/data";
import {
  bookProfessionalAppointment,
  captureProfessionalOpportunity,
  requestProfessionalEscalation,
} from "@/lib/professional/intake";
import { parseAgentProfilePolicy } from "@/lib/professional";
import { disconnectTestDb, prisma, resetAndSeedTestDb, setDevSession } from "./setup";

const DEMO_ACCOUNT = "org_tyrone_1";

beforeEach(async () => {
  await resetAndSeedTestDb();
  setDevSession("aj_admin");
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("internal demo account classification", () => {
  test("the reference tenant and prospect sandbox keep their distinct account classifications", async () => {
    const accounts = await prisma.account.findMany({ orderBy: { id: "asc" } });
    expect(
      accounts.map((account) => [account.id, account.account_type]),
    ).toEqual([
      ["org_mock_1", "customer"],
      ["org_mock_2", "customer"],
      ["org_responseos_demo", "sandbox"],
      ["org_tyrone_1", "internal_demo"],
    ]);
  });
});

describe("agent profiles", () => {
  test("all four profiles are seeded, exactly one is default, and each carries a parseable policy", async () => {
    const result = await AgentProfiles.listAgentProfiles({
      accountId: DEMO_ACCOUNT,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.map((profile) => profile.type).sort()).toEqual([
      "consulting_receptionist",
      "demo_mode",
      "professional_assistant",
      "recruiter_receptionist",
    ]);
    expect(result.data.filter((profile) => profile.is_default)).toHaveLength(1);
    for (const profile of result.data) {
      expect(
        parseAgentProfilePolicy(profile.system_policy_json).knowledgeFallback,
      ).toBe("verified_only");
    }
  });

  test("a tenant user cannot read another tenant's profiles", async () => {
    setDevSession("client_admin@org_mock_1");
    const own = await AgentProfiles.listAgentProfiles({});
    expect(own.ok).toBe(true);
    if (own.ok) expect(own.data).toEqual([]);

    const other = await AgentProfiles.listAgentProfiles({
      accountId: DEMO_ACCOUNT,
    });
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.error.code).toBe("tenant_scope_denied");
  });
});

describe("professional opportunities", () => {
  test("the seeded opportunity carries its interaction provenance", async () => {
    const result = await ProfessionalOpportunities.listProfessionalOpportunities(
      { accountId: DEMO_ACCOUNT },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);

    const opportunity = result.data[0];
    expect(opportunity.company).toBe("Northwind Systems");
    expect(opportunity.role_title).toBe("Business Systems Analyst");
    expect(opportunity.source_call_id).toBe("call_tyrone_1");
    expect(opportunity.source_conversation_id).toBe("conv_tyrone_1");
    expect(opportunity.appointment_id).toBe("booking_tyrone_1");
    expect(opportunity.next_action).toBe("prepare for recruiter interview");
  });

  test("a tenant user cannot read or write another tenant's opportunities", async () => {
    setDevSession("client_admin@org_mock_1");

    const read = await ProfessionalOpportunities.listProfessionalOpportunities({
      accountId: DEMO_ACCOUNT,
    });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.code).toBe("tenant_scope_denied");

    const byId =
      await ProfessionalOpportunities.getProfessionalOpportunityById(
        "popp_tyrone_1",
      );
    expect(byId.ok).toBe(false);
    if (!byId.ok) expect(byId.error.code).toBe("tenant_scope_denied");

    const write = await captureProfessionalOpportunity({
      accountId: DEMO_ACCOUNT,
      opportunityType: "employment",
      company: "Should Not Land",
    });
    expect(write.ok).toBe(false);
    if (!write.ok) expect(write.error.code).toBe("tenant_scope_denied");

    const rows = await prisma.professionalOpportunity.findMany({
      where: { company: "Should Not Land" },
    });
    expect(rows).toEqual([]);
  });

  test("capture writes the record, audits it, and emits a non-delivered handoff", async () => {
    const captured = await captureProfessionalOpportunity({
      accountId: DEMO_ACCOUNT,
      opportunityType: "consulting",
      contactId: "contact_tyrone_recruiter_1",
      agentProfileId: "agent_tyrone_consulting",
      company: "Contoso Logistics",
      questionsAsked: ["systems integration scope"],
      summary: "Consulting discovery requested.",
      nextAction: "hold discovery call",
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;

    expect(captured.data.opportunity.status).toBe("new");
    expect(captured.data.handoff).toEqual({
      providerId: "noop",
      event: "professional.opportunity.created",
      delivered: false,
    });

    const audits = await prisma.auditLog.findMany({
      where: {
        account_id: DEMO_ACCOUNT,
        action: "professional.opportunity.created",
        target_id: captured.data.opportunity.id,
      },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].category).toBe("workflow");
  });

  test("escalation is audited and emitted without answering anything", async () => {
    const result = await requestProfessionalEscalation({
      accountId: DEMO_ACCOUNT,
      reason: "compensation question",
      category: "compensation",
      opportunityId: "popp_tyrone_1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.event).toBe("professional.escalation.requested");
    expect(result.data.delivered).toBe(false);

    const audits = await prisma.auditLog.findMany({
      where: {
        account_id: DEMO_ACCOUNT,
        action: "professional.escalation.requested",
      },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].reason).toBe("compensation question");
  });

  test("a tenant user cannot escalate against another tenant", async () => {
    setDevSession("client_admin@org_mock_1");
    const result = await requestProfessionalEscalation({
      accountId: DEMO_ACCOUNT,
      reason: "should not be recorded",
      category: "compensation",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("tenant_scope_denied");

    const audits = await prisma.auditLog.findMany({
      where: { action: "professional.escalation.requested" },
    });
    expect(audits).toEqual([]);
  });
});

describe("scheduling from the receptionist", () => {
  test("booking an allowed type creates an appointment and links it to the opportunity", async () => {
    const policy = parseAgentProfilePolicy({
      allowedAppointmentTypes: ["recruiter_screen"],
      allowedAssetTypes: [],
      compensationDisclosure: "escalate",
      referencesDisclosure: "escalate",
    });

    const captured = await captureProfessionalOpportunity({
      accountId: DEMO_ACCOUNT,
      opportunityType: "employment",
      contactId: "contact_tyrone_recruiter_1",
      company: "Contoso Logistics",
      roleTitle: "Systems Analyst",
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;

    const booked = await bookProfessionalAppointment({
      accountId: DEMO_ACCOUNT,
      contactId: "contact_tyrone_recruiter_1",
      opportunityId: captured.data.opportunity.id,
      appointmentType: "recruiter_screen",
      slotId: "slot-1",
      inviteeName: "Jane Smith",
      inviteeEmail: "jane.smith@northwind.example",
      title: "Recruiter screen — Jane Smith",
      policy,
    });
    expect(booked.ok).toBe(true);
    if (!booked.ok) return;
    expect(booked.data.appointment.account_id).toBe(DEMO_ACCOUNT);

    const linked =
      await ProfessionalOpportunities.getProfessionalOpportunityById(
        captured.data.opportunity.id,
      );
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.data.appointment_id).toBe(booked.data.appointment.id);
    expect(linked.data.status).toBe("scheduled");
  });

  test("an out-of-scope opportunity is rejected before any booking or appointment is written", async () => {
    const before = await prisma.appointment.count();
    const denied = await bookProfessionalAppointment({
      accountId: DEMO_ACCOUNT,
      contactId: "contact_tyrone_recruiter_1",
      opportunityId: "popp_does_not_exist",
      appointmentType: "recruiter_screen",
      slotId: "slot-1",
      inviteeName: "Jane Smith",
      inviteeEmail: "jane.smith@northwind.example",
      title: "Should not be booked",
      policy: parseAgentProfilePolicy({
        allowedAppointmentTypes: ["recruiter_screen"],
      }),
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("not_found");
    expect(await prisma.appointment.count()).toBe(before);
  });

  test("an appointment cannot be linked to an opportunity in another tenant", async () => {
    const linked = await ProfessionalOpportunities.attachAppointmentToOpportunity(
      {
        opportunityId: "popp_tyrone_1",
        // booking_mock_1 belongs to org_mock_1, not the demo tenant.
        appointmentId: "booking_mock_1",
      },
    );
    expect(linked.ok).toBe(false);
    if (!linked.ok) expect(linked.error.code).toBe("tenant_scope_denied");

    const row = await prisma.professionalOpportunity.findUnique({
      where: { id: "popp_tyrone_1" },
    });
    expect(row?.appointment_id).toBe("booking_tyrone_1");
  });

  test("a type the profile does not allow is refused before anything is written", async () => {
    const before = await prisma.appointment.count();
    const denied = await bookProfessionalAppointment({
      accountId: DEMO_ACCOUNT,
      contactId: "contact_tyrone_recruiter_1",
      opportunityId: "popp_tyrone_1",
      appointmentType: "hiring_manager_interview",
      slotId: "slot-1",
      inviteeName: "Jane Smith",
      inviteeEmail: "jane.smith@northwind.example",
      title: "Should not be booked",
      policy: parseAgentProfilePolicy({
        allowedAppointmentTypes: ["demo"],
      }),
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe("policy_denied");
    expect(await prisma.appointment.count()).toBe(before);
  });
});

describe("reporting exclusion", () => {
  test("internal demo metrics are visible to the tenant but excluded from the cross-tenant rollup", async () => {
    await prisma.revenueMetrics.create({
      data: {
        id: "rev_tyrone_1",
        account_id: DEMO_ACCOUNT,
        period_start: new Date("2026-08-01T00:00:00.000Z"),
        period_end: new Date("2026-08-31T23:59:59.999Z"),
        total_calls: 4,
        estimated_recovered_revenue: 100_000,
        verified_recovered_revenue: 100_000,
      },
    });

    const rollup = await RevenueMetrics.listRevenueMetrics({});
    expect(rollup.ok).toBe(true);
    if (!rollup.ok) return;
    expect(rollup.data.map((row) => row.account_id)).not.toContain(
      DEMO_ACCOUNT,
    );

    const scoped = await RevenueMetrics.listRevenueMetrics({
      accountId: DEMO_ACCOUNT,
    });
    expect(scoped.ok).toBe(true);
    if (scoped.ok) expect(scoped.data.map((row) => row.id)).toEqual(["rev_tyrone_1"]);
  });
});
