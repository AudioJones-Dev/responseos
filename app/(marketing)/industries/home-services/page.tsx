import { pageMetadata } from "@/lib/seo";
import { IndustryPage, type IndustryContent } from "../_components/IndustryPage";

export const metadata = pageMetadata({
  title: "For home services",
  description:
    "Missed-call response, intake, and booking for HVAC, roofing, plumbing, electrical, and landscaping businesses — designed around after-hours demand.",
  path: "/industries/home-services",
});

const CONTENT: IndustryContent = {
  eyebrow: "For home services",
  headline: "Every missed call is a job that went to the next contractor.",
  lede: "HVAC, roofing, plumbing, electrical, landscaping. ResponseOS is designed to catch the missed call at 6:42pm, reply by text, qualify the urgency, and book the estimate before the homeowner moves on.",
  points: [
    {
      title: "Catch the 6:42pm missed call",
      body: "Designed so after-hours and on-the-job calls get a response instead of voicemail.",
    },
    {
      title: "Reply before they call the next contractor",
      body: "An automated text is designed to open the conversation before the homeowner dials the next contractor on their list.",
    },
    {
      title: "Qualify urgency, then book",
      body: "Service area, job type, and urgency are designed to be scored, and qualified demand is designed to route straight to a booked estimate.",
    },
  ],
  problemsHeading: "Where home-service calls go missing",
  problems: [
    {
      title: "The crew is on the job",
      body: "Calls come in while your techs are on a roof, under a sink, or in a crawlspace. Nobody can pick up, and the homeowner doesn't wait.",
    },
    {
      title: "Demand peaks after hours",
      body: "When the AC quits on a Friday night or a pipe bursts on Sunday, homeowners call down the list until someone answers.",
    },
    {
      title: "Voicemail doesn't qualify",
      body: "A voicemail tells you someone called. It doesn't tell you whether it's a routine tune-up or a full replacement, or whether they're in your service area.",
    },
    {
      title: "Callbacks live in someone's head",
      body: "Follow-up depends on whoever saw the missed call remembering it. By morning, the job has often gone to whoever called back first.",
    },
  ],
  steps: [
    {
      title: "Capture",
      body: "A missed call, a text reply, or a web form is designed to land in one record, so no inquiry sits unworked.",
    },
    {
      title: "Respond",
      body: "An automated text is designed to open the conversation within moments. AI inbound answering is in development.",
    },
    {
      title: "Qualify",
      body: "Urgency, job type, service area, and decision-maker are designed to be scored before anyone spends time on a callback.",
    },
    {
      title: "Hand off",
      body: "Qualified demand is designed to route to a booked estimate or a human callback, with the call context attached.",
    },
  ],
  signals: [
    "Urgency: no heat, no cooling, or an active leak versus routine maintenance",
    "Repair versus replacement",
    "Service area, checked against the ZIP codes you cover",
    "Whether the caller owns the home or needs a landlord's sign-off",
    "Preferred appointment window",
    "Consent to follow up by call or text",
  ],
  faqs: [
    {
      q: "Does ResponseOS replace my answering service?",
      a: "Not necessarily. An answering service takes a message; ResponseOS is designed around what happens next — qualifying the lead, assigning the follow-up, and keeping the record. The assessment can also conclude that your current setup just needs configuring.",
    },
    {
      q: "How are emergency calls handled?",
      a: "Urgent calls are designed to be flagged and handed to a person with the details attached. A person decides the next step; ResponseOS does not dispatch technicians on its own.",
    },
    {
      q: "Will it work with my CRM or field-service software?",
      a: "ResponseOS is designed to sync with your existing system through provider adapters rather than replacing it. Live CRM integrations are still being validated, and CRM sync is mock-only in the demo. The assessment confirms what your stack would need.",
    },
    {
      q: "Is my business a good fit?",
      a: "Usually when your average job value is around $300 or more, you miss a meaningful number of calls (often 20 or more a month), and you have a clear booking or quote process. These are signals, not hard cutoffs.",
    },
    {
      q: "What does it cost?",
      a: "Every engagement starts with the $1,000 flat Readiness & Revenue Leak Assessment. If it's a fit, you get a proposal for a one-time setup fee plus a monthly retainer, and the full $1,000 is credited if you sign within 30 days.",
    },
  ],
};

export default function HomeServicesPage() {
  return <IndustryPage content={CONTENT} />;
}
