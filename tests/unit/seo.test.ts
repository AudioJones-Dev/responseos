import { afterEach, describe, expect, test } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GET as llms } from "@/app/llms.txt/route";
import { OG_IMAGE, pageMetadata } from "@/lib/seo";

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
