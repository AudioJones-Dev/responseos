import type { ProfessionalKnowledgeCategory } from "@/lib/providers/professionalKnowledge";

export type ProfessionalIntent =
  | "recruiting"
  | "employment_inquiry"
  | "contract_opportunity"
  | "consulting_inquiry"
  | "portfolio_question"
  | "interview_scheduling"
  | "general_professional"
  | "demo";

/**
 * Deterministic keyword classifier. Mock-first by construction: no
 * model call, no network, same answer every run — which is what makes
 * it testable and demo-safe. A model-backed classifier can replace it
 * behind this signature without touching callers.
 *
 * Ordering is significant: the earliest matching rule wins, so a
 * message that both mentions a role and asks for a time classifies as
 * scheduling.
 */
const INTENT_RULES: Array<{ intent: ProfessionalIntent; keywords: string[] }> = [
  {
    intent: "interview_scheduling",
    keywords: [
      "schedule",
      "book a time",
      "book time",
      "calendar",
      "availability for a call",
      "set up a call",
      "interview time",
    ],
  },
  {
    intent: "recruiting",
    keywords: ["recruiter", "recruiting", "hiring manager", "sourcing", "candidate for"],
  },
  {
    intent: "consulting_inquiry",
    keywords: ["consulting", "consultant", "advisory", "engagement", "statement of work"],
  },
  {
    intent: "contract_opportunity",
    keywords: ["contract", "contractor", "freelance", "1099", "short-term engagement"],
  },
  {
    intent: "employment_inquiry",
    keywords: ["full-time", "full time", "role", "position", "job", "opening", "hiring"],
  },
  {
    intent: "portfolio_question",
    keywords: ["portfolio", "resume", "cv", "github", "linkedin", "case study", "project"],
  },
  { intent: "demo", keywords: ["demo", "responseos", "walkthrough", "how does this work"] },
];

/**
 * Whole-word keyword match.
 *
 * Plain substring matching silently mis-routes: "age" is inside
 * "management", so "how is he with stakeholder management?" classified
 * as a private question and got refused. A refusal is the most
 * expensive wrong answer the receptionist can give, so matching is
 * anchored to word boundaries. Multi-word keywords still match as
 * phrases.
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  // Plurals match in both directions — "certification" finds
  // "certifications", and the skill "CRM Systems" finds "CRM system" —
  // by comparing on the singular stem. A keyword buried mid-word still
  // does not match.
  const stem =
    keyword.length > 3 && keyword.endsWith("s") ? keyword.slice(0, -1) : keyword;
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}s?([^a-z0-9]|$)`, "i").test(text);
}

export function detectProfessionalIntent(text: string): ProfessionalIntent {
  const normalized = text.toLowerCase();
  for (const rule of INTENT_RULES) {
    if (rule.keywords.some((keyword) => matchesKeyword(normalized, keyword))) {
      return rule.intent;
    }
  }
  return "general_professional";
}

/**
 * Maps a question onto the claim category whose authority governs the
 * answer. `unknown` is the safe default — it routes to the fallback
 * line rather than to an improvised answer.
 */
const CATEGORY_RULES: Array<{
  category: ProfessionalKnowledgeCategory;
  keywords: string[];
}> = [
  {
    category: "interview_availability",
    keywords: [
      "when are you free",
      "availability",
      "available",
      "schedule",
      "calendar",
      "book",
    ],
  },
  {
    category: "compensation",
    keywords: ["salary", "compensation", "pay range", "base", "equity", "comp"],
  },
  { category: "consulting_rates", keywords: ["rate", "rates", "hourly", "day rate", "pricing"] },
  { category: "references", keywords: ["reference", "referral from", "vouch", "background check"] },
  {
    category: "education",
    keywords: ["education", "degree", "school", "university", "college", "graduated"],
  },
  {
    category: "certifications",
    keywords: ["certification", "certified", "credential", "license"],
  },
  { category: "case_studies", keywords: ["case study", "case studies"] },
  {
    category: "projects",
    keywords: ["project", "portfolio", "built", "shipped", "github", "resume", "cv"],
  },
  { category: "skills", keywords: ["skill", "stack", "technology", "technical", "tools", "proficient"] },
  {
    category: "work_history",
    keywords: ["experience", "work history", "worked", "employer", "background", "career", "years"],
  },
  {
    category: "employment_preferences",
    keywords: ["prefer", "looking for", "interested in", "open to"],
  },
  {
    category: "contract_availability",
    keywords: ["contract", "full-time", "full time", "start date", "notice period"],
  },
  {
    category: "personal",
    keywords: ["home address", "personal", "family", "married", "age", "phone number"],
  },
  // Last: "who"/"about" are broad enough to swallow more specific
  // questions, so every narrower rule gets first refusal.
  {
    category: "profile",
    keywords: ["who is", "who are", "who does", "tell me about", "introduce"],
  },
];

export function classifyProfessionalQuestion(
  question: string,
): ProfessionalKnowledgeCategory {
  const normalized = question.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => matchesKeyword(normalized, keyword))) {
      return rule.category;
    }
  }
  return "unknown";
}
