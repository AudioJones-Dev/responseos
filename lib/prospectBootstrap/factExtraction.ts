import type { AcquiredWebsitePage } from "./websiteAcquisition";

export interface ObservedKnowledgeFact {
  key: string;
  value: unknown;
  evidenceExcerpt: string;
  sourceUrl: string;
  confidence: number;
}

function excerpt(text: string, value: string): string {
  const index = text.toLowerCase().indexOf(value.toLowerCase());
  if (index < 0) return text.slice(0, 280);
  return text.slice(Math.max(0, index - 80), Math.min(text.length, index + value.length + 160));
}

function uniqueFacts(facts: ObservedKnowledgeFact[]): ObservedKnowledgeFact[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = `${fact.key}:${JSON.stringify(fact.value).toLowerCase()}:${fact.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SERVICE_TERMS = [
  "roof", "plumb", "hvac", "air conditioning", "heating", "electrical",
  "garage door", "landscap", "pest control", "water damage", "remodel",
  "flooring", "painting", "pool", "fence", "window", "gutter",
];

function compactSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 12 && sentence.length <= 280);
}

function faqKey(question: string): string {
  const slug = question.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 72);
  return `faq.${slug || "question"}`;
}

export function extractObservedFacts(pages: AcquiredWebsitePage[]): ObservedKnowledgeFact[] {
  const facts: ObservedKnowledgeFact[] = [];
  for (const page of pages) {
    const text = page.extractedText;
    const phoneMatches = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) ?? [];
    for (const phone of phoneMatches.slice(0, 3)) {
      facts.push({ key: "contact.phone", value: phone.trim(), evidenceExcerpt: excerpt(text, phone), sourceUrl: page.normalizedUrl, confidence: 0.9 });
    }
    const emailMatches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    for (const email of emailMatches.slice(0, 3)) {
      facts.push({ key: "contact.email", value: email.toLowerCase(), evidenceExcerpt: excerpt(text, email), sourceUrl: page.normalizedUrl, confidence: 0.9 });
    }
    const hoursMatches = text.match(/(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^.!?]{0,120}(?:am|pm|closed)/gi) ?? [];
    for (const hours of hoursMatches.slice(0, 7)) {
      facts.push({ key: "operating_hours.statement", value: hours.trim(), evidenceExcerpt: excerpt(text, hours), sourceUrl: page.normalizedUrl, confidence: 0.7 });
    }
    const sentences = compactSentences(text);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (SERVICE_TERMS.some((term) => lower.includes(term))) {
        facts.push({ key: "service.statement", value: sentence, evidenceExcerpt: excerpt(text, sentence), sourceUrl: page.normalizedUrl, confidence: 0.58 });
      }
      if (/\b(serv(?:e|es|ing)|service areas?|coverage areas?)\b/i.test(sentence)) {
        facts.push({ key: "service_area.statement", value: sentence, evidenceExcerpt: excerpt(text, sentence), sourceUrl: page.normalizedUrl, confidence: 0.6 });
      }
      if (/\b(warrant(?:y|ies)|financing|free estimates?|emergency service|satisfaction guarantee)\b/i.test(sentence)) {
        facts.push({ key: "policy.statement", value: sentence, evidenceExcerpt: excerpt(text, sentence), sourceUrl: page.normalizedUrl, confidence: 0.58 });
      }
      if (/\b\d{1,6}\s+[A-Za-z0-9 .'-]+\s(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way)\b/i.test(sentence)) {
        facts.push({ key: "location.statement", value: sentence, evidenceExcerpt: excerpt(text, sentence), sourceUrl: page.normalizedUrl, confidence: 0.65 });
      }
    }
    for (const match of text.matchAll(/([^.!?]{8,180}\?)\s*([^!?]{8,280}[.!])/g)) {
      const question = match[1].trim();
      const answer = match[2].trim();
      facts.push({
        key: faqKey(question),
        value: { question, answer },
        evidenceExcerpt: excerpt(text, match[0]),
        sourceUrl: page.normalizedUrl,
        confidence: 0.55,
      });
    }
    if (page === pages[0]) {
      const heading = text.split(/[.!?]/)[0]?.trim();
      if (heading && heading.length <= 160) {
        facts.push({ key: "business.profile_statement", value: heading, evidenceExcerpt: excerpt(text, heading), sourceUrl: page.normalizedUrl, confidence: 0.55 });
      }
    }
  }
  return uniqueFacts(facts);
}
