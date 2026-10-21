import { absoluteUrl } from "@/lib/seo";

// Plain-text site summary for AI agents (llmstxt.org). Status language
// follows doctrine §20: designed / in development / not claimed.
export function GET() {
  const link = (path: string) => absoluteUrl(path);
  const body = `# ResponseOS

> ResponseOS is Revenue Recovery Infrastructure for founder-led service businesses, built by AJ Digital LLC. It is designed to capture missed calls, qualify leads, book appointments, and report estimated and verified outcomes across phone, text, and web.

Current status: ResponseOS is an internal-first product in active development. The public site and demo walkthrough run on mock adapters and fictional records; live provider integrations are still being validated. It is not a live customer service, it is not HIPAA-certified, and it holds no SOC 2, ISO 27001, or PCI DSS certification. Estimated opportunity value is reported separately from verified outcomes.

## How to start

- [Readiness & Revenue Leak Assessment](${link("/audit")}): A $1,000 flat paid diagnostic that sizes missed demand, scores readiness, and gives a fit / no-fit answer. The full fee applies toward implementation if signed within 30 days.
- [Pricing](${link("/pricing")}): Assessment first, then a one-time setup fee plus a monthly retainer. Tiers: Recovery Core, Recovery Pro, Recovery Performance. No performance-only pricing.

## Product

- [Platform overview](${link("/")}): The capture, qualify, recover, report loop the product is designed around.
- [Product demo](${link("/demo")}): A simulated walkthrough on fictional data, with an FAQ on what is and isn't active.
- [Home services](${link("/industries/home-services")}): HVAC, roofing, plumbing, electrical, and landscaping.
- [Contractors](${link("/industries/contractors")}): Designed around estimator routing, scope capture, and quote-to-job tracking.

## Trust

- [Trust & security](${link("/trust")}): Each control labeled implemented, partial, planned, or not claimed.
- [Privacy policy](${link("/privacy")})
- [Terms of service](${link("/terms")})

## Fit

Usually a fit: average job value around $300 or more, meaningful missed-call volume (often 20+ a month), a clear booking or quote process. Not for first pilots: medical, legal, HIPAA-regulated, or other sensitive regulated workflows.
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
