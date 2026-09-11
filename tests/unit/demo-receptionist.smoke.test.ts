import { describe, test, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { EXAMPLE_QUESTIONS } from "@/app/(demo)/demo/receptionist/_data/examples";
import { getMockAgentProfiles } from "@/lib/mock/agentProfiles";
import {
  answerProfessionalQuestion,
  parseAgentProfilePolicy,
  resolveAgentProfile,
} from "@/lib/professional";
import { INTERNAL_DEMO_ACCOUNT_ID } from "@/lib/providers/professionalKnowledge";
import { isPublicPath } from "@/lib/auth/route-protection";

/**
 * Smoke test for the receptionist's only entry point (ADR-0046, seventh
 * follow-up). Same idiom as the walkthrough smoke test: route and data
 * contracts, no React render.
 *
 * Guards the two things that would embarrass or endanger the demo — an
 * advertised example question that no longer does what it advertises,
 * and the page acquiring the ability to write.
 */

const PAGE = path.join(
  process.cwd(),
  "app",
  "(demo)",
  "demo",
  "receptionist",
  "page.tsx",
);

describe("demo receptionist page — smoke", () => {
  test("the page exists and is reachable without auth", () => {
    expect(existsSync(PAGE)).toBe(true);
    expect(isPublicPath("/demo/receptionist")).toBe(true);
  });

  test("every advertised example still lands on the authority it advertises", async () => {
    const policy = parseAgentProfilePolicy(
      resolveAgentProfile(getMockAgentProfiles())?.system_policy_json,
    );

    for (const { question, expects } of EXAMPLE_QUESTIONS) {
      const answer = await answerProfessionalQuestion({
        accountId: INTERNAL_DEMO_ACCOUNT_ID,
        question,
        policy,
      });
      expect(answer.authority, `"${question}"`).toBe(expects);
      // "answer" is the only authority that may speak a record.
      expect(answer.answered, `"${question}"`).toBe(expects === "answer");
    }
  });

  test("the examples demonstrate every authority the receptionist has", () => {
    // A demo that only shows answers misrepresents a system whose whole
    // point is declining well.
    expect(new Set(EXAMPLE_QUESTIONS.map((e) => e.expects))).toEqual(
      new Set(["answer", "unavailable", "escalate", "refuse", "tool_lookup"]),
    );
  });

  test("the page cannot write: it never reaches the intake path", () => {
    // captureProfessionalOpportunity, requestProfessionalEscalation and
    // bookProfessionalAppointment create rows. An anonymous visitor must
    // not be able to, so the page must not import them — directly or via
    // the barrel, which deliberately omits intake.
    //
    // Asserted against imports rather than raw source: the file discusses
    // the write path in prose, and a test that cannot tell a comment from
    // a call would fail on the explanation of why the call is absent.
    const source = readFileSync(PAGE, "utf8");

    const modules = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(modules).not.toContain("@/lib/professional/intake");

    const bindings = [...source.matchAll(/import\s*\{([^}]+)\}\s*from/g)]
      .flatMap((m) => m[1].split(","))
      .map((name) => name.replace(/^\s*type\s+/, "").trim())
      .filter(Boolean);
    for (const writer of [
      "captureProfessionalOpportunity",
      "requestProfessionalEscalation",
      "bookProfessionalAppointment",
    ]) {
      expect(bindings, `page must not import ${writer}`).not.toContain(writer);
    }
  });

  test("the account is a constant, never taken from the request", () => {
    // Tenant isolation here is structural: the request carries the
    // question and nothing else, so no query parameter can name an
    // account (SECURITY.md — derived, never accepted).
    const source = readFileSync(PAGE, "utf8");
    expect(source).toContain("INTERNAL_DEMO_ACCOUNT_ID");
    // The only value read out of searchParams is the question.
    const reads = [...source.matchAll(/await searchParams\)\.(\w+)/g)].map(
      (match) => match[1],
    );
    expect(reads).toEqual(["q"]);
  });
});
