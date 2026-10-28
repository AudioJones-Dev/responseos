import { buildSetupDraft, type CreateSetupInput } from "./contracts";

export const SYNTHETIC_SETUP_INPUT: CreateSetupInput = {
  businessName: "Sunshine HVAC", slug: "sunshine-hvac", industry: "hvac",
  timezone: "America/New_York", founderName: "Taylor Example", contactNumber: "+12025550123",
  facts: [{ label: "Service area", value: "Example County — synthetic draft for review" }],
  disclosure: {
    text: "Thank you for calling Sunshine HVAC. With your permission, we'd like to record and transcribe this call for service documentation, quality assurance and training.",
    purpose: "Service documentation, quality assurance and training — draft purpose, awaiting review.",
    consentFlow: "Proposed: ask for explicit permission before any capture. Approval pending.",
    refusalFlow: "Proposed: no capture on refusal or uncertainty. Human handling must be agreed before launch.",
  },
};

export const SYNTHETIC_SETUP = {
  account: { id: "org_mock_1", name: "Sunshine HVAC", slug: "sunshine-hvac", industry: "hvac", timezone: "America/New_York", status: "paused" },
  draft: buildSetupDraft(SYNTHETIC_SETUP_INPUT, 1),
  synthetic: true,
};
