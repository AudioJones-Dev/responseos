import type { Metadata } from "next";
import Link from "next/link";
import { RevenueExposureEstimator } from "@/components/marketing/RevenueExposureEstimator";
import { MarketingButtonLink } from "@/components/marketing/MarketingButtonLink";
import { AtmosphereBackground } from "@/components/layout/AtmosphereBackground";
import { ButtonLink, Card } from "@/components/ui";
import { absoluteSiteUrl } from "@/lib/site";

const META_DESCRIPTION =
  "Find missed-call and follow-up leaks, estimate revenue exposure, and request a practical recovery audit for your home service business.";

export const metadata: Metadata = {
  title: { absolute: "Revenue Recovery for Home Service Businesses | ResponseOS" },
  description: META_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "ResponseOS",
    title: "Stop losing jobs you already paid to attract.",
    description: META_DESCRIPTION,
    url: "/",
    locale: "en_US",
    images: [
      {
        url: "/og/responseos-og.png",
        width: 1200,
        height: 630,
        alt: "ResponseOS — Revenue Recovery for Home Service Businesses",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Stop losing jobs you already paid to attract.",
    description: META_DESCRIPTION,
    images: ["/og/responseos-og.png"],
  },
};

const EVIDENCE = [
  {
    value: "64%",
    statement:
      "of surveyed contractors said phone calls are their dominant customer communication channel.",
    source: "ServiceTitan 2025 Residential Services Report",
    method: "Survey of more than 1,000 residential contractors",
    href: "https://www.servicetitan.com/press/residential-industry-report-2025",
  },
  {
    value: "56%",
    statement:
      "of surveyed home-service owners said customers expect a response within one hour.",
    source: "Jobber 2026 Home Service Trends Report",
    method: "Survey of 1,050 U.S. home-service business owners",
    href: "https://www.getjobber.com/home-service-trends-report/",
  },
  {
    value: "15%",
    statement:
      "of surveyed recent homeowners said they had to follow up repeatedly with a provider; 9% said they never received a response.",
    source: "Jobber 2026 Recent Homebuyer Report",
    method: "Survey of 800 recent U.S. homeowners",
    href: "https://www.getjobber.com/recent-homebuyer-report/",
  },
];

const LEAKS = [
  {
    title: "Missed calls go cold",
    body: "The caller has a real problem now. When nobody responds, that demand can move to the next company on the list.",
  },
  {
    title: "Estimates disappear",
    body: "A quote can sit untouched because the next follow-up depends on someone remembering to make it.",
  },
  {
    title: "Results stay invisible",
    body: "Calls, notes, and booked work live in different places, so the owner cannot see where the leak started.",
  },
];

const RECOVERY_STEPS = [
  {
    title: "Capture the opportunity",
    body: "Keep the call, request, and customer context together.",
  },
  {
    title: "Respond while interest is high",
    body: "Create a clear next response instead of letting the request wait.",
  },
  {
    title: "Keep follow-up moving",
    body: "Make the next touch visible, consistent, and easy to review.",
  },
  {
    title: "Tie outcomes to revenue",
    body: "Separate an estimate from a verified business outcome.",
  },
];

const FAQS = [
  {
    question: "What problem does ResponseOS solve?",
    answer:
      "ResponseOS is designed to help home-service businesses identify missed-call, follow-up, and reporting gaps that let legitimate demand disappear before it becomes booked work.",
  },
  {
    question: "How is the revenue-exposure estimate calculated?",
    answer:
      "The calculator multiplies your monthly missed new-customer calls by your typical close rate and average booked job value. It is a planning estimate based only on your inputs, not a guarantee or a client result.",
  },
  {
    question: "Does ResponseOS replace my office staff?",
    answer:
      "No. ResponseOS is designed to support repeatable response and follow-up while keeping people in control of exceptions, customer judgment, and business decisions.",
  },
  {
    question: "Does it connect to my current software?",
    answer:
      "The current product preview uses sample data and is not connected to your live phone, customer-management, or scheduling systems. Integration options are evaluated during the audit and remain subject to readiness approval.",
  },
  {
    question: "What happens after I request an audit?",
    answer:
      "AJ Digital reviews your inputs, validates the assumptions behind the estimate, maps the current follow-up process, and gives you a practical fit or no-fit recommendation before any implementation decision.",
  },
];

function JsonLd() {
  const home = absoluteSiteUrl("/");
  const logo = absoluteSiteUrl("/icon-512.png");
  const audit = absoluteSiteUrl("/audit");
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${home}#organization`,
        name: "ResponseOS",
        legalName: "AJ Digital LLC",
        url: home,
        logo,
      },
      {
        "@type": "WebSite",
        "@id": `${home}#website`,
        name: "ResponseOS",
        url: home,
        publisher: { "@id": `${home}#organization` },
        description: META_DESCRIPTION,
      },
      {
        "@type": "Service",
        "@id": `${audit}#service`,
        name: "Readiness and revenue leak assessment",
        serviceType: "Revenue recovery assessment for home-service businesses",
        url: audit,
        provider: { "@id": `${home}#organization` },
        audience: {
          "@type": "BusinessAudience",
          audienceType: "Home-service business owners and operators",
        },
        description:
          "A diagnostic that reviews missed demand, follow-up gaps, and the assumptions behind a revenue-exposure estimate before implementation.",
      },
      {
        "@type": "FAQPage",
        "@id": `${home}#faq`,
        mainEntity: FAQS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export default function MarketingHome() {
  return (
    <main className="flex-1">
      <JsonLd />

      <section className="relative isolate mx-auto w-full max-w-6xl overflow-hidden px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
        <AtmosphereBackground
          family="signal-field"
          size="1920x1080"
          intensity={0.8}
        />
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:gap-14">
          <div className="pt-2">
            <p className="inline-flex rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-ink-secondary">
              Revenue recovery for home service businesses
            </p>
            <h1 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.03] text-ink sm:text-6xl">
              Stop losing jobs you <span className="text-accent">already paid to attract.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-secondary">
              Missed calls, slow follow-up, and forgotten estimates turn paid-for
              demand into lost work. ResponseOS helps you find those leaks,
              estimate the revenue exposed, and build a practical recovery plan.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="#revenue-estimator" glow>
                Estimate my revenue leak
              </ButtonLink>
              <MarketingButtonLink
                event="homepage_demo_clicked"
                href="/demo"
                variant="secondary"
              >
                See how ResponseOS works
              </MarketingButtonLink>
            </div>
            <p className="mt-4 max-w-xl text-xs leading-5 text-ink-muted">
              The product preview uses sample data. Live phone, customer-management,
              and scheduling integrations are not active.
            </p>
          </div>

          <RevenueExposureEstimator />
        </div>
      </section>

      <section
        aria-labelledby="evidence-title"
        className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20"
      >
        <div className="border-y border-line py-6">
          <p
            id="evidence-title"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted"
          >
            Why response and follow-up matter
          </p>
          <dl className="mt-6 grid gap-8 lg:grid-cols-3 lg:gap-0">
            {EVIDENCE.map((item, index) => (
              <div
                key={item.source}
                className={index === 0 ? "lg:pr-8" : "lg:border-l lg:border-line lg:px-8"}
              >
                <dt className="font-display text-4xl font-semibold text-accent">
                  {item.value}
                </dt>
                <dd className="mt-3 text-sm leading-6 text-ink-secondary">
                  {item.statement}
                </dd>
                <dd className="mt-4 text-xs leading-5 text-ink-muted">
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink-secondary underline decoration-line-strong underline-offset-4 hover:text-ink"
                  >
                    {item.source}
                  </a>
                  <span className="block">{item.method}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-canvas-soft">
        <AtmosphereBackground
          family="noise-glass"
          size="1600x900"
          intensity={0.35}
        />
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-action">
              Where revenue leaks
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
              The lead rarely disappears all at once
            </h2>
            <p className="mt-4 text-sm leading-6 text-ink-secondary">
              It slips away between the first call, the next follow-up, and the
              moment someone asks what happened.
            </p>
          </div>
          <ol className="border-t border-line">
            {LEAKS.map((item, index) => (
              <li
                key={item.title}
                className="grid gap-3 border-b border-line py-6 sm:grid-cols-[3rem_1fr]"
              >
                <span className="font-mono text-sm text-ink-muted">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-ink-secondary">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="how-it-works"
        className="relative isolate mx-auto w-full max-w-6xl overflow-hidden px-4 py-16 sm:px-6 sm:py-20"
      >
        <AtmosphereBackground
          family="ledger-depth"
          size="1600x900"
          intensity={0.55}
        />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          The ResponseOS recovery method
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold text-ink">
          Keep the opportunity moving, then verify what happened
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {RECOVERY_STEPS.map((step, index) => (
            <article key={step.title} className="border-t border-line-strong pt-5">
              <p className="font-mono text-xs text-accent">0{index + 1}</p>
              <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-secondary">
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <Card className="relative isolate overflow-hidden p-7 sm:p-10" as="section">
          <AtmosphereBackground
            family="recovery-beam"
            size="1600x900"
            intensity={0.38}
            position="right center"
          />
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Built around evidence, not AI hype
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
                A recovery plan should be explainable
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-ink-secondary">
                The system is designed to support repeatable work while people
                keep control of exceptions, customer judgment, and final business
                decisions.
              </p>
            </div>
            <ul className="space-y-4 text-sm leading-6 text-ink-secondary">
              <li className="border-b border-line pb-4">
                AI is the mechanism, not the headline.
              </li>
              <li className="border-b border-line pb-4">
                Estimated revenue stays separate from verified outcomes.
              </li>
              <li>
                The assessment can recommend a simpler fix or conclude that
                ResponseOS is not the right fit.
              </li>
            </ul>
          </div>
        </Card>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 sm:px-6 sm:pb-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            Home services first
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
            Built for phone-driven service demand
          </h2>
        </div>
        <div>
          <p className="max-w-2xl text-sm leading-6 text-ink-secondary">
            The first use case is a founder-led business where missed calls and
            inconsistent follow-up can quickly become missed work.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2 text-sm text-ink-secondary">
            {["HVAC", "Plumbing", "Roofing", "Electrical", "General contracting"].map(
              (industry) => (
                <li
                  key={industry}
                  className="rounded-full border border-line bg-surface px-4 py-2"
                >
                  {industry}
                </li>
              ),
            )}
          </ul>
          <Link
            href="/industries/home-services"
            className="mt-6 inline-flex text-sm font-medium text-ink underline decoration-accent underline-offset-4"
          >
            See the home-services use case
          </Link>
        </div>
      </section>

      <section
        id="faq"
        className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6 sm:pb-20"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          Clear answers
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
          Questions a business owner should ask
        </h2>
        <div className="mt-8 border-t border-line">
          {FAQS.map((item) => (
            <details key={item.question} className="group border-b border-line py-5">
              <summary className="cursor-pointer list-none pr-8 text-base font-semibold text-ink marker:content-none">
                {item.question}
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <Card className="relative isolate overflow-hidden p-8 sm:p-10" as="section">
          <AtmosphereBackground
            family="recovery-beam"
            size="1600x900"
            intensity={0.45}
            position="right center"
          />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="max-w-2xl font-display text-3xl font-semibold text-ink">
                Find the revenue leaks hiding in your current follow-up
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-ink-secondary">
                Start with your numbers, then validate the assumptions before
                making an implementation decision.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <ButtonLink href="/audit" glow>
                Request my revenue audit
              </ButtonLink>
              <MarketingButtonLink
                event="homepage_demo_clicked"
                href="/demo"
                variant="secondary"
              >
                Explore the sample preview
              </MarketingButtonLink>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
