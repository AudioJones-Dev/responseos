import type { Metadata } from "next";

let warnedFallback = false;

// The public origin comes from NEXT_PUBLIC_APP_URL, so moving the marketing
// site to another domain is an env change: canonicals, sitemap, robots,
// llms.txt and JSON-LD all follow it.
export function siteUrl(): URL {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) {
    try {
      const url = new URL(fromEnv);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return new URL(url.origin);
      }
    } catch {
      // A malformed value must not crash the build/boot — fall back.
    }
  }
  if (process.env.NODE_ENV === "production" && !warnedFallback) {
    warnedFallback = true;
    console.warn(
      "NEXT_PUBLIC_APP_URL is missing or invalid; canonicals, sitemap, robots and llms.txt fall back to http://localhost:3000.",
    );
  }
  return new URL("http://localhost:3000");
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl()).toString();
}

export const SITE_NAME = "ResponseOS";
export const PUBLISHER_NAME = "AJ Digital LLC";

// Social-card copy — Variant A (Revenue Recovery), per
// docs/product/responseos-og-social-preview-spec.md §3/§5.
export const OG_IMAGE = {
  url: "/og/responseos-og.png",
  width: 1200,
  height: 630,
  alt: "ResponseOS — stop losing revenue to missed calls.",
};

export const SITE_OPEN_GRAPH = {
  type: "website",
  siteName: SITE_NAME,
  title: "Stop losing revenue to missed calls and weak follow-up.",
  description:
    "ResponseOS is designed to answer the calls you miss, qualify the lead, and estimate the revenue at stake.",
  locale: "en_US",
  images: [OG_IMAGE],
} satisfies NonNullable<Metadata["openGraph"]>;

export const SITE_TWITTER = {
  card: "summary_large_image",
  title: "Stop losing revenue to missed calls.",
  description:
    "ResponseOS is designed to catch the calls you miss, qualify the lead, and show you what to do next.",
  images: [OG_IMAGE.url],
} satisfies NonNullable<Metadata["twitter"]>;

// Next replaces (not merges) a parent's openGraph/twitter when a page sets
// its own, so each page carries the shared image and site name forward.
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const socialTitle = `${title} — ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...SITE_OPEN_GRAPH, title: socialTitle, description, url: path },
    twitter: { ...SITE_TWITTER, title: socialTitle, description },
  };
}

export function organizationJsonLd() {
  const url = siteUrl().toString();
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${url}#organization`,
      name: PUBLISHER_NAME,
      url,
      logo: absoluteUrl("/brand/responseos-mark.png"),
      brand: { "@type": "Brand", name: SITE_NAME },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${url}#website`,
      name: SITE_NAME,
      url,
      inLanguage: "en-US",
      publisher: { "@id": `${url}#organization` },
    },
  ];
}

export function faqJsonLd(faqs: ReadonlyArray<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function assessmentJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Readiness & Revenue Leak Assessment",
    serviceType: "Business diagnostic",
    description:
      "A diagnostic that sizes missed demand, scores readiness, and returns a fit / no-fit answer before any implementation.",
    url: absoluteUrl("/audit"),
    provider: { "@id": `${siteUrl().toString()}#organization` },
    areaServed: "US",
  };
}
