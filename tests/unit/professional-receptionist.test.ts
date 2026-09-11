import { describe, expect, test } from "vitest";
import {
  classifyProfessionalQuestion,
  detectProfessionalIntent,
  matchesKeyword,
  unverifiedFallback,
  answerProfessionalQuestion,
  listProfessionalMeetingWindows,
  listShareableAssets,
  parseAgentProfilePolicy,
  resolveAgentProfile,
  summarizeProfessionalOpportunity,
  DEFAULT_AGENT_PROFILE_POLICY,
  type AgentProfilePolicy,
} from "@/lib/professional";
import { getMockAgentProfiles } from "@/lib/mock/agentProfiles";
import { getMockProfessionalOpportunities } from "@/lib/mock/professionalOpportunities";
import { getProfessionalHandoffProvider } from "@/lib/providers/professionalHandoff";
import {
  getProfessionalKnowledgeProvider,
  INTERNAL_DEMO_ACCOUNT_ID,
} from "@/lib/providers/professionalKnowledge";
import { countsTowardCustomerRevenue } from "@/lib/revenue/customerRevenueScope";

const DEMO_ACCOUNT = INTERNAL_DEMO_ACCOUNT_ID;
const OWNER = "Tyrone Nelms";

const recruiterPolicy: AgentProfilePolicy = parseAgentProfilePolicy(
  getMockAgentProfiles().find((p) => p.type === "recruiter_receptionist")
    ?.system_policy_json,
);

describe("professional intent detection", () => {
  test.each([
    ["Can we schedule a call next week?", "interview_scheduling"],
    ["I'm a recruiter at Northwind Systems.", "recruiting"],
    ["We'd like consulting help with our ops.", "consulting_inquiry"],
    ["Is he open to a contract?", "contract_opportunity"],
    ["We have a full-time opening.", "employment_inquiry"],
    ["Where can I find his portfolio?", "portfolio_question"],
    ["How does this ResponseOS demo work?", "demo"],
    ["Hello there.", "general_professional"],
  ])("%s → %s", (text, expected) => {
    expect(detectProfessionalIntent(text)).toBe(expected);
  });
});

describe("question classification", () => {
  test.each([
    ["What is his salary expectation?", "compensation"],
    ["Can you provide a reference?", "references"],
    ["What's his hourly rate?", "consulting_rates"],
    ["What is his home address?", "personal"],
    ["Tell me about his work history.", "work_history"],
    ["Who is Tyrone?", "profile"],
    ["What times is he available?", "interview_availability"],
    ["Blue whales are large.", "unknown"],
  ])("%s → %s", (question, expected) => {
    expect(classifyProfessionalQuestion(question)).toBe(expected);
  });
});

describe("answerProfessionalQuestion", () => {
  test("answers from a verified record and cites it", async () => {
    const answer = await answerProfessionalQuestion({
      accountId: DEMO_ACCOUNT,
      question: "Who is Tyrone?",
      policy: recruiterPolicy,
    });
    expect(answer.category).toBe("profile");
    expect(answer.answered).toBe(true);
    expect(answer.sources.length).toBeGreaterThan(0);
  });

  test("answers work history, skills, education and certifications from the imported resume", async () => {
    const cases: Array<[string, string]> = [
      ["Tell me about his work history.", "Florida Ramp & Lift"],
      ["What skills does he have?", "Workflow Automation"],
      ["What degree does he hold?", "American Academy"],
      ["Which certifications does he hold?", "coursera.org"],
    ];
    for (const [question, expected] of cases) {
      const answer = await answerProfessionalQuestion({
        accountId: DEMO_ACCOUNT,
        question,
        policy: recruiterPolicy,
      });
      expect(answer.answered).toBe(true);
      expect(answer.sources.length).toBeGreaterThan(0);
      expect(answer.message).toContain(expected);
    }
  });

  test("routes a question naming a skill directly, without the word 'skill'", async () => {
    for (const question of [
      "Does he know Salesforce?",
      "Any experience with ClickUp?",
      "How much SharePoint has he done?",
    ]) {
      const answer = await answerProfessionalQuestion({
        accountId: DEMO_ACCOUNT,
        question,
        policy: recruiterPolicy,
      });
      expect(answer.category).toBe("skills");
      expect(answer.answered).toBe(true);
    }
  });

  test("a keyword buried inside a longer word never triggers a refusal", async () => {
    // "age" is a substring of "management": plain substring matching
    // classified this as a private question and refused it.
    const answer = await answerProfessionalQuestion({
      accountId: DEMO_ACCOUNT,
      question: "How is he with stakeholder management?",
      policy: recruiterPolicy,
    });
    expect(answer.category).toBe("skills");
    expect(answer.authority).not.toBe("refuse");
    expect(answer.answered).toBe(true);
  });

  test("a named skill never re-routes a project question away from its fallback", async () => {
    // Projects have no canonical source. A skill name in the question
    // must not let the skills record stand in for the missing one.
    const answer = await answerProfessionalQuestion({
      accountId: DEMO_ACCOUNT,
      question: "What projects has he built with Salesforce?",
      policy: recruiterPolicy,
    });
    expect(answer.category).toBe("projects");
    expect(answer.answered).toBe(false);
    expect(answer.message).toBe(unverifiedFallback(OWNER));
  });

  test("a word that merely ends in 's' is matched exactly, never truncated", async () => {
    // "address" must not be stemmed to "addres": a truncated match on a
    // keyword that governs a refusal is a worse answer, not a safer one.
    expect(matchesKeyword("what is his home address?", "home address")).toBe(
      true,
    );
    expect(matchesKeyword("what is his home addres?", "home address")).toBe(
      false,
    );
    expect(matchesKeyword("tell me about the busines", "business")).toBe(false);
    expect(matchesKeyword("tell me about the business", "business")).toBe(true);
    // Irregular plurals are not derived — "analysi" must never match.
    expect(matchesKeyword("his analysi work", "analysis")).toBe(false);
    expect(matchesKeyword("his analysis work", "analysis")).toBe(true);
  });

  test("plurals match in both directions", async () => {
    // The verified skill is "CRM Systems"; a caller saying "CRM system"
    // must still reach it, and vice versa.
    for (const question of [
      "Has he worked with CRM system?",
      "Has he worked with CRM systems?",
    ]) {
      const answer = await answerProfessionalQuestion({
        accountId: DEMO_ACCOUNT,
        question,
        policy: recruiterPolicy,
      });
      expect(answer.category).toBe("skills");
      expect(answer.answered).toBe(true);
    }
  });

  test("a named skill never re-routes a gated question", async () => {
    const gated: Array<[string, string]> = [
      ["What salary does he want for Salesforce work?", "compensation"],
      ["What's his hourly rate for ClickUp implementation?", "consulting_rates"],
      ["Can I get a reference for his Salesforce work?", "references"],
      ["What's his personal phone number for Notion questions?", "personal"],
    ];
    for (const [question, expected] of gated) {
      const answer = await answerProfessionalQuestion({
        accountId: DEMO_ACCOUNT,
        question,
        policy: recruiterPolicy,
      });
      expect(answer.category).toBe(expected);
      expect(answer.answered).toBe(false);
    }
  });

  test("a skill named by another tenant's caller is not answered from this tenant's list", async () => {
    const answer = await answerProfessionalQuestion({
      accountId: "org_mock_1",
      question: "Does he know Salesforce?",
      policy: recruiterPolicy,
    });
    expect(answer.answered).toBe(false);
  });

  test("never fabricates a career claim when no verified record exists", async () => {
    // Projects are the one category with no canonical source.
    const answer = await answerProfessionalQuestion({
      accountId: DEMO_ACCOUNT,
      question: "What projects has he built?",
      policy: recruiterPolicy,
    });
    expect(answer.answered).toBe(false);
    expect(answer.authority).toBe("unavailable");
    expect(answer.sources).toEqual([]);
    expect(answer.message).toBe(unverifiedFallback(OWNER));
  });

  test("no answer ever surfaces an unverified record body", async () => {
    const questions = [
      "Tell me about his work history.",
      "What skills does he have?",
      "What projects has he built?",
      "What degree does he hold?",
      "Which certifications does he hold?",
    ];
    for (const question of questions) {
      const answer = await answerProfessionalQuestion({
        accountId: DEMO_ACCOUNT,
        question,
        policy: recruiterPolicy,
      });
      expect(answer.message).not.toContain("PLACEHOLDER");
    }
  });

  test("compensation escalates rather than negotiating", async () => {
    const answer = await answerProfessionalQuestion({
      accountId: DEMO_ACCOUNT,
      question: "What salary is he looking for?",
      policy: recruiterPolicy,
    });
    expect(answer.authority).toBe("escalate");
    expect(answer.escalated).toBe(true);
    expect(answer.answered).toBe(false);
  });

  test("a stricter profile policy can refuse what the matrix would escalate", async () => {
    const answer = await answerProfessionalQuestion({
      accountId: DEMO_ACCOUNT,
      question: "What salary is he looking for?",
      policy: { ...recruiterPolicy, compensationDisclosure: "refuse" },
    });
    expect(answer.authority).toBe("refuse");
    expect(answer.answered).toBe(false);
  });

  test("private questions are refused", async () => {
    const answer = await answerProfessionalQuestion({
      accountId: DEMO_ACCOUNT,
      question: "What is his home address?",
      policy: recruiterPolicy,
    });
    expect(answer.authority).toBe("refuse");
    expect(answer.answered).toBe(false);
  });

  test("availability is a tool lookup, never quoted from memory", async () => {
    const answer = await answerProfessionalQuestion({
      accountId: DEMO_ACCOUNT,
      question: "What times is he available?",
      policy: recruiterPolicy,
    });
    expect(answer.authority).toBe("tool_lookup");
    expect(answer.answered).toBe(false);
  });

  test("another tenant gets nothing — knowledge is account-scoped", async () => {
    const answer = await answerProfessionalQuestion({
      accountId: "org_mock_1",
      question: "Who is Tyrone?",
      policy: recruiterPolicy,
    });
    expect(answer.answered).toBe(false);
    expect(answer.sources).toEqual([]);
    expect(answer.message).toBe(unverifiedFallback("the account owner"));
  });
});

describe("asset sharing", () => {
  test("shares only public assets of an allowed type", async () => {
    const assets = await listShareableAssets({
      accountId: DEMO_ACCOUNT,
      policy: recruiterPolicy,
    });
    expect(assets.every((asset) => asset.public)).toBe(true);
    expect(assets.map((asset) => asset.url)).toEqual([
      "https://tyronenelms.com",
    ]);
  });

  test("an asset whose type the profile disallows is withheld", async () => {
    const assets = await listShareableAssets({
      accountId: DEMO_ACCOUNT,
      policy: { ...recruiterPolicy, allowedAssetTypes: ["github"] },
    });
    expect(assets).toEqual([]);
  });

  test("the default policy shares nothing", async () => {
    const assets = await listShareableAssets({ accountId: DEMO_ACCOUNT });
    expect(assets).toEqual([]);
  });
});

describe("meeting windows", () => {
  test("offers windows for an allowed appointment type", async () => {
    const windows = await listProfessionalMeetingWindows({
      accountId: DEMO_ACCOUNT,
      appointmentType: "recruiter_screen",
      startsAfter: "2026-01-01T00:00:00.000Z",
      startsBefore: "2026-02-01T00:00:00.000Z",
      policy: recruiterPolicy,
    });
    expect(windows.length).toBeGreaterThan(0);
    expect(windows[0].appointmentType).toBe("recruiter_screen");
  });

  test("offers nothing for a type the profile does not allow", async () => {
    const windows = await listProfessionalMeetingWindows({
      accountId: DEMO_ACCOUNT,
      appointmentType: "consulting_discovery",
      startsAfter: "2026-01-01T00:00:00.000Z",
      startsBefore: "2026-02-01T00:00:00.000Z",
      policy: recruiterPolicy,
    });
    expect(windows).toEqual([]);
  });
});

describe("agent profile policy", () => {
  test("malformed policy JSON falls back to the strict default", () => {
    expect(parseAgentProfilePolicy(null)).toEqual(DEFAULT_AGENT_PROFILE_POLICY);
    expect(parseAgentProfilePolicy("nope")).toEqual(
      DEFAULT_AGENT_PROFILE_POLICY,
    );
    expect(parseAgentProfilePolicy({ allowedAppointmentTypes: 7 })).toEqual(
      DEFAULT_AGENT_PROFILE_POLICY,
    );
  });

  test("unknown enum members are dropped and the fallback mode cannot be loosened", () => {
    const policy = parseAgentProfilePolicy({
      allowedAppointmentTypes: ["recruiter_screen", "not_a_type"],
      allowedAssetTypes: ["resume", "nonsense"],
      compensationDisclosure: "answer",
      knowledgeFallback: "anything_goes",
    });
    expect(policy.allowedAppointmentTypes).toEqual(["recruiter_screen"]);
    expect(policy.allowedAssetTypes).toEqual(["resume"]);
    expect(policy.compensationDisclosure).toBe("escalate");
    expect(policy.knowledgeFallback).toBe("verified_only");
  });

  test("resolves the requested profile, then the default, and never a disabled one", () => {
    const profiles = getMockAgentProfiles();
    expect(resolveAgentProfile(profiles, "consulting_receptionist")?.slug).toBe(
      "consulting-receptionist",
    );
    expect(resolveAgentProfile(profiles)?.slug).toBe("recruiter-receptionist");
    expect(
      resolveAgentProfile(profiles.map((p) => ({ ...p, enabled: false }))),
    ).toBeNull();
  });
});

describe("opportunity summary", () => {
  test("renders the close-out record from stored fields only", () => {
    const opportunity = getMockProfessionalOpportunities()[0];
    const summary = summarizeProfessionalOpportunity(opportunity);
    expect(summary).toEqual({
      company: "Northwind Systems",
      recruiter: "Jane Smith",
      role: "Business Systems Analyst",
      opportunity_type: "employment",
      interest_level: "high",
      questions_asked: [
        "business systems experience",
        "AI implementation experience",
        "example project work",
      ],
      appointment: { status: "none", datetime: undefined },
      recommended_preparation: [
        "review the company platform",
        "prepare an operations case study",
        "prepare a business systems transformation example",
      ],
      next_action: "prepare for recruiter interview",
    });
  });
});

describe("provider mocks work without credentials", () => {
  test("knowledge provider resolves to the fixture adapter and is account-scoped", async () => {
    const provider = getProfessionalKnowledgeProvider();
    expect(provider.providerId).toBe("mock");
    expect(await provider.getProfile("org_mock_1")).toBeNull();
    expect(await provider.getExperience("org_mock_1")).toEqual([]);
    expect(
      await provider.search({
        accountId: "org_mock_1",
        query: "experience",
        profileType: "recruiter_receptionist",
      }),
    ).toEqual([]);
  });

  test("imported resume records are verified and carry no invented dates", async () => {
    const provider = getProfessionalKnowledgeProvider();
    const experience = await provider.getExperience(DEMO_ACCOUNT);
    const skills = await provider.getSkills(DEMO_ACCOUNT);

    expect(experience.length).toBeGreaterThan(0);
    expect(skills.length).toBeGreaterThan(0);
    expect(experience.every((record) => record.verified)).toBe(true);
    expect(skills.every((record) => record.verified)).toBe(true);

    // The resume dates only two roles; the rest must stay undated rather
    // than carry a guess.
    const dated = experience.filter((record) => record.startDate);
    expect(dated.map((record) => record.company).sort()).toEqual([
      "AJ Digital / Freelance Consulting",
      "Florida Ramp & Lift",
    ]);
  });

  test("records with no canonical source stay unverified", async () => {
    const projects = await getProfessionalKnowledgeProvider().getProjects(
      DEMO_ACCOUNT,
    );
    expect(projects.every((record) => !record.verified)).toBe(true);
  });

  test("handoff provider is a no-op that reports non-delivery", async () => {
    const provider = getProfessionalHandoffProvider();
    expect(provider.providerId).toBe("noop");
    const receipt = await provider.emit({
      name: "professional.opportunity.created",
      payload: {
        accountId: DEMO_ACCOUNT,
        opportunityId: "popp_tyrone_1",
        opportunityType: "employment",
      },
    });
    expect(receipt).toEqual({
      providerId: "noop",
      event: "professional.opportunity.created",
      delivered: false,
    });
  });
});

describe("customer revenue scope", () => {
  test("only customer tenants count toward customer revenue", () => {
    expect(countsTowardCustomerRevenue("customer")).toBe(true);
    expect(countsTowardCustomerRevenue("internal_demo")).toBe(false);
    expect(countsTowardCustomerRevenue("internal")).toBe(false);
    expect(countsTowardCustomerRevenue("sandbox")).toBe(false);
  });
});
