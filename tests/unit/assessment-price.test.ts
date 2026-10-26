import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import HomePage from "@/app/(marketing)/page";
import AuditPage, { metadata as auditMetadata } from "@/app/(marketing)/audit/page";
import PricingPage from "@/app/(marketing)/pricing/page";

// ADR-0083: the assessment is $1,500 flat everywhere it is priced.
describe("assessment price", () => {
  test.each([
    ["home", HomePage],
    ["audit", AuditPage],
    ["pricing", PricingPage],
  ] as [string, ComponentType][])("%s page shows $1,500 and not $1,000", (_name, Page) => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain("$1,500");
    expect(html).not.toContain("$1,000");
  });

  test("audit description states $1,500", () => {
    expect(auditMetadata.description).toContain("$1,500");
  });
});
