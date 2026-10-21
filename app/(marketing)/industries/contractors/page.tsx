import { pageMetadata } from "@/lib/seo";
import { IndustryPage, type IndustryContent } from "../_components/IndustryPage";

export const metadata = pageMetadata({
  title: "For contractors",
  description:
    "ResponseOS for contractors — win the quote before it goes cold. Designed to capture missed calls, qualify leads, and follow up automatically.",
  path: "/industries/contractors",
});

const CONTENT: IndustryContent = {
  eyebrow: "For contractors",
  headline: "Win the quote before it goes cold",
  lede: "Remodelers, GCs, and specialty trades. ResponseOS is designed to route inbound to the right estimator, capture the scope, and track the quote-to-job funnel without the spreadsheet sprawl.",
  points: [
    {
      title: "Route to the right estimator",
      body: "Inbound is designed to land with the estimator who owns the trade and territory — no front-desk triage, no missed handoffs.",
    },
    {
      title: "Capture the scope on first contact",
      body: "Job type, square footage, timeline, and budget signal are designed to be captured and scored before anyone schedules a site visit.",
    },
    {
      title: "Track quote-to-job, not spreadsheets",
      body: "Every quote is designed to trace back to the lead that started it. Win-rate and verified-revenue reporting is planned on top of that trail.",
    },
  ],
  problemsHeading: "Where contractor leads go cold",
  problems: [
    {
      title: "Estimators are on site",
      body: "The people who can answer a scope question are walking a job when the phone rings. The lead gets voicemail and keeps calling around.",
    },
    {
      title: "Scope gets lost before the site visit",
      body: "Job type, size, and timeline get scribbled down, retyped, or forgotten between the first call and the estimate appointment.",
    },
    {
      title: "Quotes go out and stop there",
      body: "A quote is sent, nobody follows up, and the homeowner signs with the contractor who checked in first.",
    },
    {
      title: "No line from lead to signed job",
      body: "Without a record linking each job back to the call that started it, it's hard to see which lead sources and estimators actually win work.",
    },
  ],
  steps: [
    {
      title: "Capture",
      body: "Calls, texts, and web forms are designed to land in one record with the caller's scope attached.",
    },
    {
      title: "Qualify the scope",
      body: "Job type, size, timeline, and budget signal are designed to be scored before a site visit is booked.",
    },
    {
      title: "Route",
      body: "Qualified leads are designed to go to the estimator who owns the trade and territory, with the context already captured.",
    },
    {
      title: "Follow up on the quote",
      body: "Quote follow-up and outbound recovery are part of the Recovery Pro scope and are in development.",
    },
  ],
  signals: [
    "Project type and trade: remodel, addition, repair, or specialty work",
    "Rough size: square footage, rooms, or linear feet",
    "Timeline: start date, and whether there's a deadline",
    "Budget signal and how the project will be financed",
    "Whether the caller is the decision-maker",
    "Location, checked against the territory each estimator covers",
  ],
  faqs: [
    {
      q: "Can leads be routed by trade and territory?",
      a: "That's the design: each qualified lead goes to the estimator who owns that trade and territory, with the captured scope attached. Routing rules are set during implementation.",
    },
    {
      q: "Does ResponseOS write my quotes?",
      a: "No. Pricing and quoting stay with your estimators. ResponseOS is designed to track each quote back to the lead that started it, so follow-up doesn't depend on memory.",
    },
    {
      q: "Will it work with my CRM or estimating software?",
      a: "ResponseOS is designed to sync with the system you already use through provider adapters. Live CRM integrations are still being validated, and the assessment confirms what your setup would need.",
    },
    {
      q: "Is my business a good fit?",
      a: "Usually when your average job value is around $300 or more, you miss a meaningful number of calls (often 20 or more a month), and you have a clear quote process. These are signals, not hard cutoffs.",
    },
    {
      q: "What does it cost?",
      a: "Every engagement starts with the $1,000 flat Readiness & Revenue Leak Assessment. If it's a fit, you get a proposal for a one-time setup fee plus a monthly retainer, and the full $1,000 is credited if you sign within 30 days.",
    },
  ],
};

export default function ContractorsPage() {
  return <IndustryPage content={CONTENT} />;
}
