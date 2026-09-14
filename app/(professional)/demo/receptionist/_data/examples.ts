import type { ClaimAuthority } from "@/lib/professional";

/**
 * The questions the demo page offers as one-click examples, each paired
 * with the authority it is meant to demonstrate.
 *
 * The pairing is the point: these are the eight outcomes a visitor is
 * invited to try, so a classifier or fixture change that silently moves
 * one of them — a refusal becoming an answer, an answer decaying to the
 * fallback — is the demo misrepresenting the receptionist. A test walks
 * this list and asserts each still lands where it says.
 */
export const EXAMPLE_QUESTIONS: ReadonlyArray<{
  question: string;
  expects: ClaimAuthority;
}> = [
  { question: "What is his business systems experience?", expects: "answer" },
  { question: "What projects has he built?", expects: "answer" },
  { question: "What is ARO?", expects: "answer" },
  { question: "Which certifications does he hold?", expects: "answer" },
  { question: "Do you have a case study I can read?", expects: "unavailable" },
  { question: "What salary is he looking for?", expects: "escalate" },
  { question: "What is his home address?", expects: "refuse" },
  { question: "When is he free for a call?", expects: "tool_lookup" },
];
