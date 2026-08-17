import { afterEach, describe, expect, test } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

const originalUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalUrl;
  }
});

describe("marketing discovery metadata", () => {
  test("publishes only public marketing routes in the sitemap", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://responseos.example";
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain("https://responseos.example/");
    expect(urls).toContain("https://responseos.example/audit");
    expect(urls.some((url) => url.includes("/admin"))).toBe(false);
    expect(urls.some((url) => url.includes("/client"))).toBe(false);
    expect(urls.some((url) => url.includes("/api"))).toBe(false);
  });

  test("allows ChatGPT search discovery but blocks GPTBot training crawl", () => {
    const rules = robots().rules;
    expect(Array.isArray(rules)).toBe(true);
    if (!Array.isArray(rules)) return;

    expect(rules).toContainEqual(
      expect.objectContaining({ userAgent: "OAI-SearchBot", allow: "/" }),
    );
    expect(rules).toContainEqual({ userAgent: "GPTBot", disallow: "/" });
  });
});
