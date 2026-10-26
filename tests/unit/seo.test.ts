import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GET as llms } from "@/app/llms.txt/route";
import ContractorsPage from "@/app/(marketing)/industries/contractors/page";
import HomeServicesPage from "@/app/(marketing)/industries/home-services/page";
import { JsonLd } from "@/components/seo/JsonLd";
import { OG_IMAGE, assessmentJsonLd, pageMetadata } from "@/lib/seo";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("SEO surfaces", () => {
  test("sitemap and robots follow NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain("https://example.com/");
    expect(urls).toContain("https://example.com/industries/contractors");
    expect(urls.some((u) => u.includes("/demo/walkthrough"))).toBe(false);

    const r = robots();
    expect(r.sitemap).toBe("https://example.com/sitemap.xml");
    expect(JSON.stringify(r.rules)).toContain("/admin");
  });

  test("site URL is reduced to an http(s) origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://user:pw@example.com/app/?q=1#x";
    expect(sitemap()[0].url).toBe("https://example.com/");
    process.env.NEXT_PUBLIC_APP_URL = "mailto:ops@example.com";
    expect(robots().sitemap).toBe("http://localhost:3000/sitemap.xml");
  });

  test("page metadata keeps the shared social image and sets a canonical", () => {
    const m = pageMetadata({ title: "Pricing", description: "d", path: "/pricing" });
    expect(m.alternates?.canonical).toBe("/pricing");
    expect(m.openGraph?.images).toEqual([OG_IMAGE]);
    expect(m.openGraph?.title).toBe("Pricing — ResponseOS");
  });

  test("llms.txt is plain text and avoids prohibited claims", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    const res = llms();
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("https://example.com/audit");
    expect(body).toContain("not HIPAA-certified");
    for (const claim of ["recovers revenue", "production-ready", "provider-independent"]) {
      expect(body).not.toContain(claim);
    }
  });
});

// No approved public price exists for the assessment; superseded tier names
// must not come back as the current public model.
// "$300 average job value" is a pre-existing fit signal, not a price.
const UNAPPROVED_COMMERCIAL = [/\$\s?\d{1,3},\d{3}/, /\bUSD\b/, /credited/i, /30 days/i, /Recovery (Core|Pro|Performance)/];

function ldJson(html: string): unknown[] {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

// React escapes these when rendering text nodes.
function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

describe("commercial claims", () => {
  test("assessment structured data carries no Offer or price", () => {
    const data = assessmentJsonLd();
    expect(data).not.toHaveProperty("offers");
    const json = JSON.stringify(data);
    for (const pattern of [/"Offer"/, /price/i, /priceCurrency/, ...UNAPPROVED_COMMERCIAL]) {
      expect(json).not.toMatch(pattern);
    }
  });

  test("llms.txt states no assessment price, credit terms, or superseded tiers", async () => {
    const body = await llms().text();
    for (const pattern of UNAPPROVED_COMMERCIAL) expect(body).not.toMatch(pattern);
  });

  test.each([
    ["home services", HomeServicesPage],
    ["contractors", ContractorsPage],
  ] as [string, ComponentType][])("%s page states no assessment price or credit terms", (_name, Page) => {
    const html = renderToStaticMarkup(createElement(Page));
    for (const pattern of [/\$\s?1,?000/, /\bUSD\b/, /credited/i, /30 days/i]) {
      expect(html).not.toMatch(pattern);
    }
  });
});

describe("structured data rendering", () => {
  test("JsonLd escapes markup so a string cannot close the script tag", () => {
    const hostile = { name: "</script><script>alert(1)</script>" };
    const html = renderToStaticMarkup(createElement(JsonLd, { data: hostile }));
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(ldJson(html)).toEqual([hostile]);
  });

  test.each([
    ["home services", HomeServicesPage],
    ["contractors", ContractorsPage],
  ] as [string, ComponentType][])("%s FAQ schema parses and matches the visible FAQ", (_name, Page) => {
    const html = renderToStaticMarkup(createElement(Page));
    const faq = ldJson(html).find((d) => (d as { "@type"?: string })["@type"] === "FAQPage") as
      | { mainEntity: { name: string; acceptedAnswer: { text: string } }[] }
      | undefined;
    expect(faq).toBeDefined();
    expect(faq!.mainEntity).toHaveLength(5);
    for (const q of faq!.mainEntity) {
      expect(html).toContain(`>${escapeText(q.name)}</h3>`);
      expect(html).toContain(`>${escapeText(q.acceptedAnswer.text)}</p>`);
    }
  });
});

describe("sitemap", () => {
  test("lists exactly the nine public marketing routes", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://seo-test.invalid";
    expect(sitemap().map((e) => e.url)).toEqual([
      "https://seo-test.invalid/",
      "https://seo-test.invalid/audit",
      "https://seo-test.invalid/pricing",
      "https://seo-test.invalid/demo",
      "https://seo-test.invalid/industries/home-services",
      "https://seo-test.invalid/industries/contractors",
      "https://seo-test.invalid/trust",
      "https://seo-test.invalid/privacy",
      "https://seo-test.invalid/terms",
    ]);
  });
});
