import {
  ALWAYS_ESCALATE,
  CLAIM_AUTHORITY,
  escalationMessage,
  refusalMessage,
  unverifiedFallback,
  type ClaimAuthority,
} from "./authority";
import { classifyProfessionalQuestion, matchesKeyword } from "./intent";
import {
  DEFAULT_AGENT_PROFILE_POLICY,
  type AgentProfilePolicy,
  type ProfessionalAppointmentType,
} from "./policy";
import {
  getProfessionalKnowledgeProvider,
  type ApprovedProfessionalAsset,
  type ProfessionalKnowledgeCategory,
} from "@/lib/providers/professionalKnowledge";
import { getSchedulingProvider } from "@/lib/providers/scheduling";
import type { ProfessionalOpportunity } from "@/types/professionalOpportunity";
import type { Appointment } from "@/types/appointment";

const UNKNOWN_OWNER = "the account owner";

export interface ProfessionalAnswer {
  category: ProfessionalKnowledgeCategory;
  authority: ClaimAuthority;
  /** True only when a verified record backed the message. */
  answered: boolean;
  message: string;
  /** Record ids that grounded the answer. Empty when nothing was cited. */
  sources: string[];
  escalated: boolean;
}

function applyPolicy(
  category: ProfessionalKnowledgeCategory,
  policy: AgentProfilePolicy,
): ClaimAuthority {
  const base = CLAIM_AUTHORITY[category];
  if (category === "compensation") return policy.compensationDisclosure;
  if (category === "references") return policy.referencesDisclosure;
  if (category === "consulting_rates") return policy.compensationDisclosure;
  return base;
}

/**
 * Categories a directly-named skill or project may re-route. "Any
 * experience with ClickUp?" classifies as work history, and "tell me
 * about Career OS" classifies as work history too — on the word
 * "career" — but in both cases the tenant's own record is the better
 * answer.
 *
 * The gated categories are absent on purpose, so a skill or project
 * name in "what salary does he want for Salesforce work?" cannot turn a
 * compensation, rates, reference, private, or calendar question into an
 * answerable one. `projects` is absent too: "what projects has he built
 * with Salesforce?" is already a project question, and naming a skill
 * inside it does not make it a question about the skill.
 */
const TENANT_VOCABULARY_MAY_OVERRIDE: ReadonlySet<ProfessionalKnowledgeCategory> =
  new Set(["unknown", "work_history", "profile"]);

/**
 * A project is asked about by its short name, not its full record name:
 * "what is ARO?" should reach "ARO — agent execution & handoff runtime".
 */
function projectMatchTerms(name: string): string[] {
  const lead = name.split("—")[0].trim().toLowerCase();
  const full = name.toLowerCase();
  return lead === full ? [full] : [full, lead];
}

/**
 * Resolves the claim category, consulting the account's own verified
 * project and skill names when the generic classifier has no better
 * answer.
 *
 * Recruiters ask "does he know Salesforce?" or "what is ARO?" far more
 * often than they say the words "skill" or "project", and the generic
 * rules cannot know one tenant's vocabulary. The lookup stays here
 * rather than in `classifyProfessionalQuestion` so the shared classifier
 * remains tenant-agnostic — no account's data is compiled into it.
 *
 * Projects are checked first: a project name is the more specific
 * claim, and without this "tell me about Career OS" answers out of the
 * work-history record, which is a wrong answer rather than a fallback.
 */
async function resolveCategory(
  accountId: string,
  question: string,
): Promise<ProfessionalKnowledgeCategory> {
  const category = classifyProfessionalQuestion(question);
  if (!TENANT_VOCABULARY_MAY_OVERRIDE.has(category)) return category;

  const normalized = question.toLowerCase();
  const provider = getProfessionalKnowledgeProvider();

  const projects = await provider.getProjects(accountId);
  const namedProject = projects.some(
    (project) =>
      project.verified &&
      projectMatchTerms(project.name).some((term) =>
        matchesKeyword(normalized, term),
      ),
  );
  if (namedProject) return "projects";

  const skills = await provider.getSkills(accountId);
  const namedSkill = skills.some(
    (skill) => skill.verified && matchesKeyword(normalized, skill.name.toLowerCase()),
  );
  return namedSkill ? "skills" : category;
}

/**
 * Answers a professional question from verified knowledge only.
 *
 * Every path that is not backed by a verified record ends in the
 * fallback, a refusal, or an escalation — the function has no branch
 * that improvises a professional fact. `policy` is supplied by the
 * caller (resolved from the answering agent profile) so this stays a
 * pure function over the knowledge provider.
 */
export async function answerProfessionalQuestion(input: {
  accountId: string;
  question: string;
  profileType?: string;
  policy?: AgentProfilePolicy;
}): Promise<ProfessionalAnswer> {
  const policy = input.policy ?? DEFAULT_AGENT_PROFILE_POLICY;
  const provider = getProfessionalKnowledgeProvider();
  const profile = await provider.getProfile(input.accountId);
  const ownerName = profile?.ownerName ?? UNKNOWN_OWNER;

  const category = await resolveCategory(input.accountId, input.question);
  const authority = applyPolicy(category, policy);

  if (authority === "refuse") {
    return {
      category,
      authority,
      answered: false,
      message: refusalMessage(ownerName),
      sources: [],
      escalated: ALWAYS_ESCALATE.has(category),
    };
  }

  if (authority === "escalate") {
    return {
      category,
      authority,
      answered: false,
      message: escalationMessage(ownerName),
      sources: [],
      escalated: true,
    };
  }

  if (authority === "tool_lookup") {
    return {
      category,
      authority,
      answered: false,
      message: `Let me check ${ownerName}'s calendar for open times rather than quote one from memory.`,
      sources: [],
      escalated: false,
    };
  }

  if (authority === "unavailable") {
    return {
      category,
      authority,
      answered: false,
      message: unverifiedFallback(ownerName),
      sources: [],
      escalated: false,
    };
  }

  const results = await provider.search({
    accountId: input.accountId,
    query: input.question,
    profileType: input.profileType ?? "professional_assistant",
  });
  // Both filters matter: a record must be verified *and* answer the
  // category actually asked about, so a question about work history
  // can never be satisfied by an unrelated record that happened to
  // share a keyword.
  const verified = results.filter(
    (record) => record.verified && record.category === category,
  );

  if (verified.length === 0) {
    return {
      category,
      authority: "unavailable",
      answered: false,
      message: unverifiedFallback(ownerName),
      sources: [],
      escalated: false,
    };
  }

  return {
    category,
    authority,
    answered: true,
    message: verified.map((record) => record.body).join(" "),
    sources: verified.map((record) => record.id),
    escalated: false,
  };
}

/**
 * Approved assets a caller may be handed: public assets whose type the
 * answering profile allows. Private repositories and unpublished case
 * studies never pass this filter.
 */
export async function listShareableAssets(input: {
  accountId: string;
  policy?: AgentProfilePolicy;
}): Promise<ApprovedProfessionalAsset[]> {
  const policy = input.policy ?? DEFAULT_AGENT_PROFILE_POLICY;
  const assets = await getProfessionalKnowledgeProvider().getApprovedAssets(
    input.accountId,
  );
  return assets.filter(
    (asset) => asset.public && policy.allowedAssetTypes.includes(asset.type),
  );
}

export interface ProfessionalMeetingWindow {
  slotId: string;
  appointmentType: ProfessionalAppointmentType;
  startsAt: string;
  endsAt: string;
}

/**
 * Open meeting windows for an appointment type the profile allows.
 * Only start/end times cross the boundary — no calendar event titles,
 * attendees, or private detail.
 */
export async function listProfessionalMeetingWindows(input: {
  accountId: string;
  appointmentType: ProfessionalAppointmentType;
  startsAfter: string;
  startsBefore: string;
  policy?: AgentProfilePolicy;
}): Promise<ProfessionalMeetingWindow[]> {
  const policy = input.policy ?? DEFAULT_AGENT_PROFILE_POLICY;
  if (!policy.allowedAppointmentTypes.includes(input.appointmentType)) {
    return [];
  }

  const slots = await getSchedulingProvider().listAvailableSlots({
    accountId: input.accountId,
    eventTypeId: input.appointmentType,
    startsAfter: input.startsAfter,
    startsBefore: input.startsBefore,
  });

  return slots.map((slot) => ({
    slotId: slot.slotId,
    appointmentType: input.appointmentType,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
  }));
}

export interface ProfessionalOpportunitySummary {
  company?: string;
  recruiter?: string;
  role?: string;
  opportunity_type: string;
  interest_level?: string;
  questions_asked: string[];
  appointment: { status: string; datetime?: string };
  recommended_preparation: string[];
  next_action?: string;
}

/**
 * Machine- and UI-readable close-out record for a completed
 * interaction (spec §14). Derived entirely from stored rows — it
 * introduces no new facts.
 */
export function summarizeProfessionalOpportunity(
  opportunity: ProfessionalOpportunity,
  appointment?: Appointment | null,
): ProfessionalOpportunitySummary {
  return {
    company: opportunity.company,
    recruiter: opportunity.recruiter_name,
    role: opportunity.role_title,
    opportunity_type: opportunity.opportunity_type,
    interest_level: opportunity.interest_level,
    questions_asked: opportunity.questions_asked ?? [],
    appointment: {
      status: appointment ? appointment.status : "none",
      datetime: appointment?.start_time,
    },
    recommended_preparation: opportunity.recommended_preparation ?? [],
    next_action: opportunity.next_action,
  };
}
