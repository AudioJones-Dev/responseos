# Deep Research Report — Curated Summary

This is a curated index/summary of the canonical product + architecture research that drives ResponseOS. It captures the load-bearing decisions; consult the full report for citations and vendor evidence.

**Source file:** `2f2c3a0f-deepresearchreport.md` (uploaded to this session). Full text is the authoritative reference for vendor capability claims, pricing, and integration surface details.

## Headline conclusion

The right move is **not** to clone QuoteIQ end-to-end. The right move is to build an **outcome-first RECOVER orchestration layer** that sits above bought communications infrastructure and below the client's CRM/FSM. AJ buys carrier-grade infrastructure; AJ builds the canonical model, prompt governance, ROI analytics, QA workflows, and white-label OS. That's where defensible IP lives and where consultants can charge for outcomes instead of minutes.

## Buy vs Build matrix

| Layer | Decision | Rationale |
|---|---|---|
| Telephony / SMS | **Buy** — Twilio | Carrier relations, numbers, webhooks, SIP, Media Streams are solved + expensive to recreate |
| Real-time voice runtime | **Buy** — Retell AI | Turn-taking, interruptions, post-call analysis, BAA path are productized |
| STT + TTS | **Mostly buy** | Speech quality + scale moves too fast to rebuild |
| Workflow glue | **Hybrid** | n8n for client-specific automations; core orchestration in code |
| Canonical data model | **Build** | Shared truth across Twilio, Retell, QuoteIQ, GHL, HubSpot, calendars, payments |
| Prompt + version governance | **Build** | Client IP, quality control, white-label resale enabler |
| QA, scoring, ROI analytics | **Build** | Main differentiation; core of outcome-based pricing |
| White-label tenant portal | **Build** | What clients and future partners actually buy |

## Recommended stack

| Layer | Default MVP | HIPAA option | Ownership |
|---|---|---|---|
| Channel + numbers | Twilio Voice + Messaging | Twilio HIPAA-eligible account | Buy |
| AI phone runtime | Retell AI | Retell with BAA, optional private/on-prem | Buy |
| STT | Retell-native first; Deepgram/AssemblyAI for QA | Deepgram with BAA, AssemblyAI redaction | Hybrid |
| TTS | Retell-native; ElevenLabs for premium where allowed | Vendor-native or BAA-covered | Hybrid |
| Database | Postgres on Supabase | RDS / Aurora on AWS | Build on top |
| Auth + tenant security | Supabase Auth + RLS | Cognito + RDS row isolation + IAM/KMS | Build on top |
| Backend API | NestJS / FastAPI (or Next.js Route Handlers in v0.1) | Same | Build |
| Queue + jobs | BullMQ/Redis | SQS + workers | Build |
| Workflow engine | n8n for tenant flows | n8n in private network or code-only | Hybrid |
| Frontend | Next.js App Router | Same, behind CloudFront | Build |
| Analytics | Postgres marts + BI dashboard | Same | Build |
| Monitoring | OpenTelemetry + Sentry | Same | Build |
| Hosting | Vercel + Supabase | ECS/Fargate + RDS + S3 + CloudFront + Route 53 + KMS | Hybrid |
| Secrets | Managed secret store | AWS Secrets Manager | Buy |

## RECOVER operational mapping

| Stage | Operator meaning | Business outcome |
|---|---|---|
| **Respond** | Answer every inbound call or text immediately | Fewer missed opportunities |
| **Evaluate** | Qualify service type, geography, urgency, budget, intent | Better lead quality |
| **Capture** | Normalize customer, job, transcript, attribution data | Reliable CRM and reporting |
| **Offer** | Present estimate, financing, self-scheduling, callback path | Faster conversion |
| **Verify** | Confirm appointment, consent, payment intent, routing | Lower no-shows, fewer errors |
| **Escalate** | Hand off edge cases, high-value jobs, compliance-sensitive calls | Better customer trust |
| **Report** | Prove recovered leads, booked jobs, revenue by tenant and source | Outcome-based pricing |

This is the canonical internal mapping. The marketing version (Revenue Leak Detection / Engagement Automation / Call Capture System / Outcome-Based Booking / Verification + Qualification / Economic ROI Tracking / Reporting + Retention) is the same framework in buyer language.

## Architecture posture

- **Event-ledger first.** Every webhook lands in `events` with a dedupe key before mutating any business object. Replay, audit, and CRM-swap migrations all depend on this.
- **Multi-tenant control plane.** Single platform; per-tenant scoping; per-tenant compliance mode.
- **Three deployment lanes.** Standard (Vercel + Supabase) → Privacy-hardened (PII scrubbing, redacted facts) → HIPAA-ready (AWS-hosted, BAA chain locked).
- **QuoteIQ posture.** Reference + connector, not system-of-record. Public surface is outbound webhooks + Zapier-mediated calendar sync.

## Open questions (carry forward)

1. **QuoteIQ private API.** The verified public surface is webhooks-out only. Confirm partner / private API access before promising deep bidirectional QuoteIQ automation.
2. **HIPAA vendor allowlist.** Lock per-tier vendor allowlist (especially TTS) before onboarding any healthcare-adjacent tenant.
3. **Disclosure rules.** Call-recording disclosure and outbound rules vary by jurisdiction. Treat as tenant policy objects, not hard-coded defaults.

## Grok Voice API Consideration

- Grok Voice appears attractive because of realtime voice-agent capability, potential tool use, and aggressive per-minute pricing.
- May fit ResponseOS for voice experiments, website/app assistants, and sales qualification pilots.
- Should not change the core architecture.
- ResponseOS should remain provider-agnostic.
- Grok belongs in the experimental provider lane until field-tested.

## How this report maps into our docs

- `product-spec.md` — RECOVER operational mapping, buy-vs-build, MVP scope, 30-day plan, roadmap.
- `architecture.md` — event-ledger-first design, three deployment lanes, QuoteIQ posture, provider adapter pattern.
- `data-schema.md` — v0.1 11 models (current); v0.2 expansion to canonical event-ledger model.
- `api-spec.md` — rate limits, error envelope, webhook signatures, idempotency.
- `automation-flows.md` — five RECOVER playbooks.
- `deployment.md` — three lanes, Terraform, GitHub OIDC, OpenTelemetry, SLOs.
- `security.md` — vendor BAA matrix, signature validation, RBAC, retention modes, incident response.
- `client-facing-offer.md` — three pricing tiers, outcome-fee structure, SLA defaults, sample contract clause.

For deeper context on any specific decision, the original report has the vendor-doc citations.
