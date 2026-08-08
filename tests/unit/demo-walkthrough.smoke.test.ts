import { describe, test, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  steps,
  call,
  lead,
  memory,
  integrations,
  followUps,
  DEMO_ONLY,
  usd,
  usdRange,
  type IntegrationState,
} from "@/app/(demo)/_data/scenario";
import { isPublicPath } from "@/lib/auth/route-protection";

/**
 * Smoke test for the mock-safe clickable demo walkthrough — the surface the
 * Aug-15 demo deploy showcases (gap doc D7, critical-path step 4). Pure
 * data/route-contract checks (no React render, no new deps), in the existing
 * unit-test idiom. Guards the two things that would break or embarrass a live
 * demo: a broken step→page/nav mapping, and a violated mock-safe / Phase-1 gate
 * invariant.
 */
describe("demo walkthrough — smoke (D7)", () => {
  test("every walkthrough step resolves to an existing page file", () => {
    // href "/demo/walkthrough/call" -> app/(demo)/demo/walkthrough/call/page.tsx
    for (const s of steps) {
      const file = path.join(process.cwd(), "app", "(demo)", s.href, "page.tsx");
      expect(existsSync(file), `missing page for step "${s.label}" (${s.href})`).toBe(true);
    }
  });

  test("every walkthrough step is a public route (reachable without auth)", () => {
    for (const s of steps) {
      expect(isPublicPath(s.href), `${s.href} must be public`).toBe(true);
    }
  });

  test("steps start at the Overview and have unique hrefs", () => {
    expect(steps[0].href).toBe("/demo/walkthrough");
    const hrefs = steps.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test("scenario cross-references are internally consistent", () => {
    expect(lead.relatedCallId).toBe(call.id);
    expect(lead.relatedMemoryId).toBe(memory.id);
    expect(memory.sourceEvent.callId).toBe(call.id);
    expect(lead.qualificationScore).toBe(call.qualificationScore);
    expect(lead.estimatedValue).toEqual(call.revenueRange);
    expect(followUps[0].lead).toBe(lead.name);
  });

  test("Phase-1 memory gates render disabled (ADR-0034 — no RAG/vector/knowledge)", () => {
    expect(memory.gates.rag_enabled).toBe(false);
    expect(memory.gates.vector_memory_enabled).toBe(false);
    expect(memory.gates.per_tenant_knowledge_enabled).toBe(false);
  });

  test("demo is mock-safe — DEMO_ONLY and only mock-safe integration states", () => {
    expect(DEMO_ONLY).toBe(true);
    const allowed = new Set<IntegrationState>(["synced", "mock", "disabled", "captured"]);
    for (const i of integrations) {
      expect(allowed.has(i.state), `integration "${i.name}" has state "${i.state}"`).toBe(true);
    }
  });

  test("currency formatting helpers", () => {
    expect(usd(1500)).toBe("$1,500");
    expect(usdRange({ min: 1500, max: 4500 })).toBe("$1,500–$4,500");
  });
});
