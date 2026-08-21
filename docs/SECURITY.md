# Security

The compliance posture is chosen **per tenant tier**, not hard-coded globally. Standard mode runs on the planning-baseline communications stack — **Telnyx** primary carrier (**Twilio** failover), **Vapi** primary AI voice orchestration (**Retell** secondary; **OpenAI** preferred in-Vapi brain, per ADR-0031/0032/0036), Postgres (Neon, ADR-0026), and Vercel; **live provider wiring is v0.3-gated** (ADR-0019). HIPAA-ready mode runs on AWS-hosted primitives with BAAs in place across the vendor chain.

## Hard rules (always)

- **No hardcoded secrets** anywhere in the repo. `.env.example` is placeholders only.
- **Webhook signatures verified** before any business mutation. Clerk and the flag-gated Telnyx post-call route implement this; remaining provider stubs are not live integrations.
- **Tenant isolation** enforced at every read/write — `account_id` derived from session, never trusted from client input.
- **Payment boundary:** never store card data. Stripe hosted pages or Payment Intents only.
- **Audit logging** on every admin action, prompt change, and data export.

## Secrets management

Local and runtime secrets are injected with **Doppler** as an **opt-in** layer (ADR-0038). It does not change any hard rule above and does not relax the mock-first / v0.3 live-wiring gates (ADR-0001, ADR-0019): with no secrets present the app still boots on mock adapters. Injecting a real key only activates that key's already-existing adapter path (e.g. `CLERK_SECRET_KEY`) — it authorizes no new live provider integration.

- `doppler.yaml` is committed and pins the Doppler **project/config mapping only** — never secret values, exactly like `.env.example`.
- Secrets are pulled at runtime via `doppler run` (the `*:doppler` npm scripts); the `.env.local` flow remains fully supported.
- Doppler local state and fallback caches are gitignored (`.doppler/`, `*.doppler.fallback.json`) — decrypted secrets must never reach the repo.
- CI is unchanged: the `validate` / `integration` jobs inject their own env (Postgres for integration) and do not depend on Doppler.

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
| Webhook security | Implemented on Clerk and flag-gated Telnyx post-call ingest; required but not yet implemented on the remaining provider stubs |
| Payment boundary | Never store cards; hosted pages / Payment Intents only |
| Deletion + export | Tenant-scoped delete/export workflows |
| QA governance | Separate raw artifacts from redacted review copies |
| Incident response | Severity matrix, paging, evidence retention, customer notification |

## Vendor BAA matrix

| Vendor | BAA available | Required in HIPAA lane | Notes |
|---|---|---|---|
| Telnyx | Confirm at cutover | Restricted until verified | Primary Standard-lane carrier (ADR-0031); BAA/DPA posture must be re-confirmed before any regulated workflow |
| Twilio | Yes | Yes (HIPAA-eligible account) | Failover / HIPAA-eligible path; enable HIPAA features per Twilio docs |
| Vapi | Confirm at cutover | Restricted until verified | Primary Standard-lane orchestration (ADR-0032); confirm data-retention / subprocessors before regulated use |
| Retell AI | Yes (self-sign BAA/DPA) | Yes | Secondary voice; use BAA + storage policy `Basic Attributes Only`; private deployment optional |
| Neon | Confirm current terms | No — replace with RDS in HIPAA lane | Standard-lane Postgres target (ADR-0026); not a substitute for HIPAA-lane RDS |
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
| Telnyx post-call demo ingest _(repository implementation; live activation separately gated, ADR-0047)_ | `telnyx-signature-ed25519` + `telnyx-timestamp` | Ed25519 public-key verify over `timestamp\|raw-body` against the Telnyx public key; reject timestamps outside five minutes before parsing or mutation |
| Telnyx assistant initialization _(personalized bootstrap; repository implementation only, ADR-0048)_ | `telnyx-signature-ed25519` + `telnyx-timestamp` | Same raw-body Ed25519/freshness validation; signed target resolves through the temporal number-assignment ledger before any tenant context is returned |
| Vapi _(primary orchestration; wires v0.3, ADR-0032)_ | Configured HMAC signature header, e.g. `X-Vapi-Signature`, plus optional timestamp header | Verify HMAC-SHA256 over the raw inbound webhook request body (the Vapi server-message payload) with the configured secret; constant-time compare; reject stale timestamps when configured |
| Twilio | `X-Twilio-Signature` | HMAC-SHA1 using auth token + full URL + sorted form params; preserve raw body |
| Retell | `x-retell-signature` | Raw-body HMAC; reject events older than 5 minutes (replay protection) |
| Stripe | `Stripe-Signature` | `stripe.webhooks.constructEvent` — includes timestamp; IP allowlist Stripe ranges |
| HighLevel | `X-GHL-Signature` (legacy `X-WH-Signature` deprecates 2026-07-01) | HMAC; use HighLevel SDK middleware |
| n8n | shared secret header | Compare against `N8N_WEBHOOK_SECRET` constant-time |
| Clerk | `svix-id` / `svix-timestamp` / `svix-signature` | Svix HMAC-SHA256 over `id.timestamp.body` keyed by `CLERK_WEBHOOK_SECRET`; constant-time compare; reject timestamps outside a 5-minute window (replay protection) |

Invalid signature → 401, no body parse, no business mutation, log to security stream.

### Route protection (`proxy.ts`)

When `CLERK_SECRET_KEY` is set, `proxy.ts` runs `clerkMiddleware` and enforces sign-in on every route except the public set (`lib/auth/route-protection.ts`): `/`, `/pricing`, `/audit`, `/trust`, `/demo`, `/api/health`, `/sign-in/*`, `/sign-up/*`, `/industries/*`, and `/api/webhooks/*` (webhooks self-validate signatures). When Clerk is absent and `RESPONSEOS_REQUIRE_AUTH` is unset, the proxy is a pass-through and the app runs on the placeholder dev-session (ADR-0001 mock-first). Hosted staging must set `RESPONSEOS_REQUIRE_AUTH`; without Clerk configuration, that combination fails closed at both the proxy and session layers. The staging workflow verifies the auth flag before migration and rejects anonymous `200` responses from protected routes after deploy.

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

### Personalized prospect bootstrap controls

- Acquisition accepts only public HTTPS URLs, enforces robots decisions, denies private/reserved ranges on every redirect, and pins the TLS connection to the validated public address to prevent DNS rebinding. It fetches only the canonical page plus manually approved same-origin HTML/plain-text URLs and caps each run at 20 pages, two MiB per page, and ten seconds per request.
- Retrieved page text is untrusted evidence. Scripts, forms, and markup are removed; extraction is schema-bounded and cannot invoke tools. Only reviewed facts enter the immutable assistant snapshot.
- Source-backed operator corrections require an exact excerpt from an acquired source and remain unapproved until a separate fact-review action. Approved snapshot facts retain source URL/content hashes, evidence-excerpt hashes, retrieval time, confidence, and reviewer identity/time; raw excerpts never enter assistant context.
- Draft, ingestion, review, approved, provisioning, and failed states expire after a renewable seven-day review window. Ready/active and post-demo states use the separate 14-day demo TTL; expiry starts the 30-day cleanup clock so abandoned workspaces cannot persist indefinitely.
- Source content, personalized transcript text, and raw personalized webhook payloads expire after 30 days. Redacted metadata-only audit tombstones retain no source text, transcript, prompt, caller number, or credential value.
- Number assignment is exclusive and temporal. Event-time resolution requires an activated interval and advances `last_inbound_at` monotonically; ambiguity, pre-activation events, or missing trustworthy time produce no tenant business mutation. Reuse requires a sliding 14-day quarantine and operator approval.
- Number registration and activation require a fresh Ed25519-signed provider-readback attestation bound to the Telnyx number and assistant safety configuration. The signing key and provider credential remain outside the application runtime.
- Activation requires a second explicit operator acknowledgment after the final assigned number, current attestation, approved snapshot, instructions, and action boundaries are visible; snapshot approval alone cannot activate a demo.
- `RESPONSEOS_PROSPECT_BOOTSTRAP_ENABLED=true` is required in addition to signed Telnyx ingest configuration. Provider key presence alone never enables personalized context.
- Promotion import is separately default-denied by `RESPONSEOS_PROMOTION_IMPORT_ENABLED`. It validates both manifest and source-snapshot hashes, creates a new disabled tenant ID, and cannot copy demo calls, callers, transcripts, recordings, raw webhooks, provider records, credentials, or audit history.
- Import does not mutate the source export automatically. A second operator-only acknowledgment must match the exported manifest hash and identify the imported disabled account before the sandbox lifecycle becomes `converted`.

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
