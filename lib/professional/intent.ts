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
  return keywordVariants(keyword).some((variant) => {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
  });
}

/** Endings where a trailing "s" is part of the word, not a plural. */
const NON_PLURAL_S = /(ss|is|us|as)$/i;

/**
 * The keyword itself, plus its regular plural counterpart.
 *
 * Only a regular plural is derived. Truncating every word that ends in
 * "s" would turn "address" into "addres" and match caller text that was
 * never written — and on a keyword that governs a refusal, a sloppier
 * match is a worse answer, not a safer one. Irregular forms
 * ("analysis" / "analyses") are not derived at all; author both spellings
 * when a keyword needs them.
 */
function keywordVariants(keyword: string): string[] {
  if (!keyword.endsWith("s")) return [keyword, `${keyword}s`];
  if (NON_PLURAL_S.test(keyword) || keyword.length <= 4) return [keyword];
  return [keyword, keyword.slice(0, -1)];
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
      // The receptionist answers *about* its owner, so callers ask in the
      // third person. "when are you free" alone missed "when is he free
      // for a call?" entirely, which is how a recruiter actually phrases
      // it — found by asking the demo route the obvious question.
      //
      // Each phrase pins "free" to a time sense. This rule is matched
      // before the gated categories, so anything looser turns a
      // compensation escalation into a calendar lookup: "is he free"
      // alone captures "is he free *to negotiate salary?*", and the bare
      // word is worse still. "free for" is safe because the colliding
      // phrasings take "free to".
      "when are you free",
      "when is he free",
      "when is she free",
      "when are they free",
      "free for",
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
