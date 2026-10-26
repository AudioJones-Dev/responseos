import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import PricingPage, { metadata } from "@/app/(marketing)/pricing/page";

// ADR-0028 retired the named Recovery tiers as the public model.
describe("pricing page scope", () => {
  const html = renderToStaticMarkup(createElement(PricingPage));

  test("names no tiers", () => {
    expect(html).not.toMatch(/Recovery (Core|Pro|Performance)/);
    expect(html).not.toMatch(/Choose your tier|Default offer/);
    expect(String(metadata.description)).not.toMatch(/tier/i);
  });

  test("keeps the scope and its status labels", () => {
    for (const item of ["Missed-call recovery", "Quote and booking flows", "Monthly ROI report"]) {
      expect(html).toContain(item);
    }
    expect(html).toContain("AI inbound answering (in development)");
    expect(html).toContain("In development");
  });
});
