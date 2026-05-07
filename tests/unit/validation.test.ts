import { describe, expect, test } from "vitest";
import {
  CreateEngagementInputSchema,
  CreateOrganizationInputSchema,
  e164PhoneSchema,
  LeadStatusLabel,
  internalLeadStatusToLabel,
  TwilioVoiceWebhookSchema,
} from "@/lib/validation/api";

describe("validation/common", () => {
  test("e164PhoneSchema accepts +1555… and rejects junk", () => {
    expect(() => e164PhoneSchema.parse("+15555550100")).not.toThrow();
    expect(() => e164PhoneSchema.parse("555-555-0100")).toThrow();
  });
});

describe("validation/labels: LeadStatusLabel brand enum (DESIGN.md §11)", () => {
  test("accepts the canonical six labels", () => {
    for (const label of [
      "Recovered",
      "Booked",
      "In Progress",
      "Needs Review",
      "Escalated",
      "Archived",
    ] as const) {
      expect(() => LeadStatusLabel.parse(label)).not.toThrow();
    }
  });

  test("rejects internal Prisma enum values directly", () => {
    expect(() => LeadStatusLabel.parse("won")).toThrow();
    expect(() => LeadStatusLabel.parse("qualified")).toThrow();
  });

  test("internalLeadStatusToLabel maps every internal status to a brand label", () => {
    for (const internal of [
      "new",
      "qualified",
      "unqualified",
      "booked",
      "quoted",
      "won",
      "lost",
      "archived",
    ]) {
      const label = internalLeadStatusToLabel[internal];
      expect(label).toBeDefined();
      expect(() => LeadStatusLabel.parse(label!)).not.toThrow();
    }
  });
});

describe("validation/organization", () => {
  test("CreateOrganizationInputSchema rejects non-kebab slug", () => {
    const result = CreateOrganizationInputSchema.safeParse({
      name: "Acme",
      slug: "Acme HVAC",
      industry: "home-services",
      timezone: "America/New_York",
    });
    expect(result.success).toBe(false);
  });
});

describe("validation/engagement: tier ↔ fee range matrix", () => {
  const baseValid = {
    organization_id: "org_mock_1",
    assessment_report_id: "assessment_mock_1",
    setup_fee_cents: 650_000,
    monthly_fee_cents: 200_000,
    usage_model: "bundled_with_cap" as const,
    included_voice_minutes: 2_000,
    signed_at: "2026-04-23T17:30:00.000Z",
  };

  test("recovery_pro accepts in-range fees", () => {
    const result = CreateEngagementInputSchema.safeParse({
      ...baseValid,
      tier: "recovery_pro",
    });
    expect(result.success).toBe(true);
  });

  test("recovery_core rejects pro-tier setup fee", () => {
    const result = CreateEngagementInputSchema.safeParse({
      ...baseValid,
      tier: "recovery_core",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) =>
      i.path.includes("setup_fee_cents"),
    );
    expect(issue).toBeDefined();
  });

  test("passthrough usage model requires margin_pct", () => {
    const result = CreateEngagementInputSchema.safeParse({
      ...baseValid,
      tier: "recovery_pro",
      usage_model: "passthrough_with_margin",
      included_voice_minutes: undefined,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((i) =>
      i.path.includes("passthrough_margin_pct"),
    );
    expect(issue).toBeDefined();
  });
});

describe("validation/webhook", () => {
  test("TwilioVoiceWebhookSchema accepts the canonical Twilio payload", () => {
    const result = TwilioVoiceWebhookSchema.safeParse({
      CallSid: "CA123",
      AccountSid: "AC123",
      From: "+15555550199",
      To: "+15555550100",
      CallStatus: "completed",
    });
    expect(result.success).toBe(true);
  });

  test("TwilioVoiceWebhookSchema rejects missing CallSid", () => {
    const result = TwilioVoiceWebhookSchema.safeParse({
      AccountSid: "AC123",
      From: "+15555550199",
      To: "+15555550100",
    });
    expect(result.success).toBe(false);
  });
});
