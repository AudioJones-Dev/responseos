# Security

The compliance posture is chosen **per tenant tier**, not hard-coded globally. Standard mode runs on the planning-baseline communications stack — **Telnyx** primary carrier (**Twilio** failover), **Vapi** primary AI voice orchestration (**Retell** secondary; **OpenAI** preferred in-Vapi brain, per ADR-0031/0032/0036), Postgres (Neon, ADR-0026), and Vercel; **live provider wiring is v0.3-gated** (ADR-0019). HIPAA-ready mode runs on AWS-hosted primitives with BAAs in place across the vendor chain.

## Hard rules (always)

- **No hardcoded secrets** anywhere in the repo. `.env.example` is placeholders only.
- **Webhook signatures verified** before any business mutation (v0.3 wires; v0.1 marks TODO).
- **Tenant isolation** enforced at every read/write — `account_id` derived from session, never trusted from client input.
- **Payment boundary:** never store card data. Stripe hosted pages or Payment Intents only.
- **Audit logging** on every admin action, prompt change, and data export.

## Compliance checklist

| Control area | Requirement |
|---|---|
| Vendor chain | Signed BAAs or DPAs everywhere regulated data is possible |
| Consent + disclosure | Opening AI/recording disclosure on every call; jurisdiction-aware |
| Data minimization | Store only what's necessary for service, QA, and billing |
| Storage policy | Per-tenant retention mode: full, PII-scrubbed, or metadata-only |
| Encryption | TLS in transit; encrypted storage + backups (KMS in HIPAA lane) |
| Access control | Tenant RBAC; least privilege; admin break-glass policy |
| Auditability | Immutable event ledger (v0.2); admin action logs; prompt/version history |
| Webhook security | Signature validation on Telnyx, Vapi, Twilio, Retell, Stripe, HighLevel (Telnyx/Vapi wire in v0.3) |
| Payment boundary | Never store cards; hosted pages / Payment Intents only |
| Deletion + export | Tenant-scoped delete/export workflows |
| QA governance | Separate raw artifacts from redacted review copies |
| Incident response | Severity matrix, paging, evidence retention, customer notification |

## Vendor BAA matrix

| Vendor | BAA available | Required in HIPAA lane | Notes |
|---|---|---|---|
| Twilio | Yes | Yes (HIPAA-eligible account) | Enable HIPAA features per Twilio docs |
| Retell AI | Yes (self-sign BAA/DPA) | Yes | Use BAA + storage policy `Basic Attributes Only`; private deployment optional |
| Supabase | Yes (paid plan) | No — replace with RDS in HIPAA lane | Supabase BAA covers Standard mode |
| AWS | Yes | Yes — only HIPAA-eligible services | RDS, S3, KMS, ECS/Fargate, CloudFront, Route 53, Secrets Manager |
| Stripe | N/A (not PHI) | N/A | Cards only; never PHI |
| ElevenLabs | Enterprise BAA only | Restricted | Avoid in HIPAA lane unless on enterprise BAA |
| Deepgram / AssemblyAI | BAA path available | Allowed only with BAA | Use only for QA/redaction where policy permits |
| HighLevel | Limited | Restricted | Treat as non-PHI sync target |
| HubSpot | Limited | Restricted | Same |
| Resend | No (transactional email) | Restricted | Avoid PHI in email bodies; subject lines must not leak diagnosis/condition |
| Vercel | No | Excluded | Replace with AWS-hosted frontend (CloudFront + Route 53) in HIPAA lane |
| OpenAI / generic LLM | Enterprise BAA available on some products | Verify per product + plan | Do not send PHI to general consumer LLM endpoints; route through BAA-covered endpoints only |

> **Must verify before production.** Every BAA in this matrix must be re-confirmed against current vendor terms at the time a HIPAA-lane tenant is onboarded. ResponseOS itself is **not** HIPAA-certified or HIPAA-compliant out of the box; the HIPAA-ready lane is the architectural and operational pattern that makes a compliant deployment possible. Compliance is a per-deployment property, not a product property.

Maintain an explicit **vendor allowlist per compliance tier**. Onboarding a healthcare-adjacent client requires lock-in of allowlist + storage policy before go-live.

### Grok Voice / xAI — pre-production review

- Grok Voice / xAI must be reviewed before production use.
- BAA / compliance eligibility must be verified directly before regulated workflows.
- Do NOT use for HIPAA, medical, legal, or sensitive workflows until compliance review is complete.
- Review covers: data retention, transcript storage, recording access, model training / data usage policy, webhook security, provider incident response.
- Treat as experimental until vendor documentation is stable and tested.

## Webhook signature validation

| Provider | Header | Validation |
|---|---|---|
| Telnyx _(primary carrier; wires v0.3, ADR-0031)_ | `telnyx-signature-ed25519` + `telnyx-timestamp` | Ed25519 public-key verify over `timestamp\|raw-body` against the Telnyx public key; reject stale timestamps (replay) |
| Vapi _(primary orchestration; wires v0.3, ADR-0032)_ | Configured HMAC signature header, e.g. `X-Vapi-Signature`, plus optional timestamp header | Verify HMAC-SHA256 over the raw inbound webhook request body (the Vapi server-message payload) with the configured secret; constant-time compare; reject stale timestamps when configured |
| Twilio | `X-Twilio-Signature` | HMAC-SHA1 using auth token + full URL + sorted form params; preserve raw body |
| Retell | `x-retell-signature` | Raw-body HMAC; reject events older than 5 minutes (replay protection) |
| Stripe | `Stripe-Signature` | `stripe.webhooks.constructEvent` — includes timestamp; IP allowlist Stripe ranges |
| HighLevel | `X-GHL-Signature` (legacy `X-WH-Signature` deprecates 2026-07-01) | HMAC; use HighLevel SDK middleware |
| n8n | shared secret header | Compare against `N8N_WEBHOOK_SECRET` constant-time |
| Clerk | `svix-id` / `svix-timestamp` / `svix-signature` | Svix HMAC-SHA256 over `id.timestamp.body` keyed by `CLERK_WEBHOOK_SECRET`; constant-time compare; reject timestamps outside a 5-minute window (replay protection) |

Invalid signature → 401, no body parse, no business mutation, log to security stream.

### Route protection (`proxy.ts`)

When `CLERK_SECRET_KEY` is set, `proxy.ts` runs `clerkMiddleware` and enforces sign-in on every route except the public set (`lib/auth/route-protection.ts`): `/`, `/pricing`, `/demo`, `/api/health`, `/sign-in/*`, `/sign-up/*`, `/industries/*`, and `/api/webhooks/*` (webhooks self-validate signatures). When Clerk is absent the proxy is a pass-through and the app runs on the placeholder dev-session (ADR-0001 mock-first).

## Tenant RBAC

Roles:
- `aj_admin` — full cross-tenant access; AJ Digital staff only.
- `operator` — cross-tenant operational read/write; AJ Digital staff only.
- `client_admin` — full access to own workspace; cannot cross workspaces.
- `client_viewer` — read-only access to own workspace.

Break-glass procedure for AJ admin access into a tenant workspace: logged with reason, time-boxed, notified to tenant `client_admin`. All actions during break-glass mode marked in the audit log.

## Storage + retention modes

Per-tenant retention mode applies to call recordings, transcripts, and PII-bearing payloads.

| Mode | Recordings | Transcripts | Notes |
|---|---|---|---|
| Full | Stored, configurable retention | Full text + redacted variant | Default for non-regulated tenants |
| PII-scrubbed | Short retention (30d default) | Redacted only; structured facts kept | Default for privacy-hardened tenants |
| Metadata-only | Not stored | Not stored | Outcome metrics only; for compliance-strict tenants |

Raw artifacts and redacted review copies live in **separate** storage paths/policies. QA reviewers see redacted; only `aj_admin` with break-glass sees raw.

## Incident response

Severity matrix:
| Severity | Definition | First response |
|---|---|---|
| P0 | Data breach, unauthorized access, regulated data exposure | Page on-call immediately; freeze writes if needed |
| P1 | Customer-impacting outage, signature validation failures across tenants | Page on-call; status update within 15 min |
| P2 | Single-tenant impact, degraded automation flow | Ticket + working-hours response |
| P3 | Cosmetic, non-blocking | Backlog |

Evidence retention: incident artifacts retained 1 year minimum (events, logs, decisions). Customer notification follows tenant contract terms + jurisdiction (HIPAA breach: 60 days; GDPR: 72 hours; etc.).

## Operational SOPs

- **Daily:** review failed webhooks, booking conflicts, payment failures, low QA scores.
- **Weekly:** audit 20–30 sampled calls per tenant; compare QA drift by prompt version; verify ROI report integrity.
- **Before each prompt release:** run golden-call regression pack.
- **Escalation triggers:** transfer failure, hallucinated pricing, calendar collision, repeated invalid SMS responses, payment-event mismatch.

## Disclosure language

Call-recording disclosure and automated-calling rules vary by jurisdiction. Treat disclosure scripts, recording toggles, and outbound campaign permissions as **tenant policy objects**, not hard-coded defaults. Per-state (US) and per-country variants ship in v0.3.
