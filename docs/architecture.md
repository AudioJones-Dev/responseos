# Architecture

## Stack

- Next.js (App Router, route groups for marketing / admin / client).
- TypeScript, strict mode.
- Tailwind CSS v4.
- Postgres via Prisma (`prisma/schema.prisma` plus migrations under `prisma/migrations/`).
- Mock provider adapters in `lib/providers/*` until real keys land.
- Auth via Clerk in the Standard lane (`lib/auth/*` session, webhook sync, and route-protection helpers).
- Hosted Standard-lane database target: Neon Postgres per ADR-0026. Local dev and CI use plain Postgres 16.
- Object storage target: Cloudflare R2 for call recordings, quote photos, and exports.

## Design principle: event-ledger-first

ResponseOS is a **multi-tenant, event-led platform** with adapters at the edges and a normalized operational core in the middle. Every inbound call, outbound call, SMS, quote, schedule change, approval, payment event, and webhook lands first in a canonical event ledger. From there, the RECOVER orchestration runs, the tenant record model updates, downstream systems (QuoteIQ, GHL, HubSpot) receive normalized writes, and ROI facts are recomputed.

Why: the canonical ledger means we can replay events, audit any outcome, and recompute ROI even if a client swaps CRMs. v0.2 ships the Postgres foundation, webhook-event persistence, audit-log expansion, and related call / conversation / workflow substrate. Any future ledger expansion must reconcile `data-schema.md`, `prisma/schema.prisma`, and accepted ADRs.

## Top-level layout

```
app/                     ← App Router top-level (no src/)
  (marketing)/           ← public landing surface
  (admin)/               ← AJ Digital operator console
  (client)/              ← per-workspace client portal
  api/                   ← REST + webhook routes
components/              ← shared UI
lib/
  auth/                  ← Clerk session, webhook sync, route protection
  db/                    ← Prisma client wrapper
  providers/             ← Twilio, Retell, Vapi, GHL, HubSpot, Stripe, Resend, Bland, n8n
  automations/           ← internal workflow runners + dispatchers
  scoring/               ← lead qualification scoring
  revenue/               ← recovered-revenue + ROI math
  notifications/         ← outbound dispatch (sms/email/in_app/slack)
  mock/                  ← seeded fixture data
prisma/                  ← schema.prisma + migrations/
types/                   ← TS contracts mirrored in Prisma + API responses
docs/                    ← this folder
tests/                   ← unit / integration / e2e
```

## Data flow (happy path, RECOVER mapping)

1. **Respond.** Inbound call hits Twilio number → `POST /api/webhooks/twilio/call-status`. AI-answered calls land via Retell or Vapi → `call-ended` webhooks. Web forms POST directly. SMS replies hit `POST /api/webhooks/twilio/sms`. Each ingest creates a `Call` row and a `LeadEvent`.
2. **Evaluate.** `lib/scoring/leadQualificationScore.ts` produces a 0–100 score from service-area match, urgency, decision-maker, budget timeline, known service. A `LeadQualification` row is attached to the `LeadEvent`.
3. **Capture.** Normalized customer + job + transcript + attribution data lands in `Contact`, `Call`, and `LeadEvent`. The v0.2 expansion adds `events`, `call_segments`, and `call_transcripts` for replay + audit.
4. **Offer.** Trigger-based automations dispatch SMS / email / Slack via `lib/notifications/*`. `QuoteRequest` rows track service type, photos, estimated value.
5. **Verify.** `Appointment` rows confirm appointment, consent, routing. Sync to Google Calendar or Cal.com via `POST /api/appointments/sync/*`.
6. **Escalate.** High-value or edge-case lead events flag `follow_up_needed` and notify operators. v0.3 wires warm-transfer rules.
7. **Report.** `lib/revenue/calculateRecoveredRevenue.ts` and `calculateRoiMultiple.ts` aggregate into `RevenueMetrics` rows per period per workspace. Admin and client surfaces read from these.

## Multi-tenancy

Every per-workspace row carries `account_id`. All read/write paths filter by `account_id` derived from the authenticated session. Operator (AJ Digital `aj_admin` / `operator`) roles can cross workspaces; client roles (`client_admin` / `client_viewer`) cannot.

For larger or regulated tenants, the platform supports per-tenant database isolation (own DB, own VPC). Smaller tenants share the main cluster with strict tenant scoping.

## Provider adapter pattern

Each provider folder under `lib/providers/` exposes a stable interface (e.g. `sendSms(params)`, `transcribeCall(params)`). The mock implementation returns deterministic fixtures. The real implementation lazy-reads env vars and falls back to mock when missing — so the app boots and runs without secrets.

## Three deployment lanes

ResponseOS is designed to ship in three compliance lanes selectable per tenant. The default is Standard mode; Privacy-hardened and HIPAA-ready are upgrade paths.

### Standard mode (default)
**Vercel + Neon Postgres + Clerk + Cloudflare R2** for the web, data, auth, and object-storage posture. v0.3 communications are planned around Telnyx primary carrier, Twilio failover, Vapi primary orchestration, Retell secondary, HubSpot CRM sync, and Calendly scheduling per ADR-0031/0032/0033/0036/0037. Live providers remain gated until v0.3 is explicitly authorized.

### Privacy-hardened mode
Standard-lane infrastructure with stricter retention, redaction, and client-facing visibility controls. Recordings are on short retention; call analysis is processed into structured facts; raw transcripts are hidden from client-facing roles by default.

### HIPAA-ready mode
**AWS-hosted (CloudFront + Route 53 + ECS/Fargate + RDS + S3 + KMS) + Twilio HIPAA account + Retell BAA + BAA-backed database.** Vendor allowlist enforced per compliance tier. Avoid non-BAA TTS/STT options.

The compliance posture is chosen **per tenant tier**, not hard-coded globally. See `SECURITY.md` for the full vendor BAA matrix and `DEPLOYMENT.md` for infrastructure topology per lane.

## QuoteIQ posture

Reference + connector, not system-of-record. Public integration surface is outbound webhook events (estimate/schedule) plus Zapier-mediated Google Calendar sync. Architect so QuoteIQ, GHL, HubSpot, or CSV import can all act as downstream systems. Until deeper private API access is confirmed, do not assume bidirectional QuoteIQ writes.

## Voice provider lanes (future)

Carrier layer:
- Telnyx primary
- Twilio failover

AI voice orchestration layer:
- Vapi primary
- Retell secondary

Legacy / reference providers:
- Bland remains a provider-adapter placeholder/reference, not the v0.3 default.

Experimental voice layer:
- Grok Voice API remains research/reference only unless a later ADR promotes it.

Workflow layer:
- ResponseOS

Optional sandboxed agent gateway:
- OpenClaw

Architecture note: Grok Voice must be treated as an experimental provider until:
- direct xAI docs/pricing are verified
- telephony integration path is confirmed
- webhook behavior is tested
- session limits and concurrency are tested
- transcript/recording handling is reviewed
- escalation/handoff behavior is validated
- compliance posture is reviewed

Until those gates are met, Grok Voice stays behind the same provider abstraction the primary lane uses, and is selectable only for non-regulated experiments (website/app voice assistants, internal operator copilot, sales qualification pilots). The v0.3 planning baseline remains Telnyx / Twilio failover for carrier behavior and Vapi / Retell for AI voice orchestration. No live provider wiring is authorized by this architecture document.

## Future Knowledge Layer / Agent Grounding Layer (v0.4+)

ResponseOS may later add a client-specific **knowledge layer** that grounds AI voice, SMS, booking, quote, and support workflows in approved business knowledge instead of free-form generation. This is a **roadmap target for v0.4 or later**. It is not implemented now, not part of v0.2, and not part of the current database/auth foundation.

### Architectural placement

The future knowledge layer sits **behind** ResponseOS workflows as a grounding layer — never as a free-standing chat product:

```
Voice / SMS / Web lead
   → ResponseOS workflow engine
   → Client knowledge layer (grounding)
   → grounded response / qualification / booking / escalation
   → ROI reporting
```

The workflow engine remains the system of record. The knowledge layer is consulted by the engine, scoped to the tenant's approved sources, and never bypasses the existing tenant-isolation, audit, and retention controls described elsewhere in this document.

### Product distinction

ResponseOS is **not** a generic second-brain or personal-knowledge app. The knowledge layer exists only to improve revenue-recovery workflows: better qualification, fewer hallucinations on pricing or service areas, better escalation, better booking accuracy, and more defensible AI-assisted answers. Knowledge that does not serve those workflows does not belong in the layer.

### Out of scope for current versions

Until the v0.4 work is explicitly scheduled, the architecture must not assume:

- a vector index, embeddings store, or RAG runtime
- a file-upload pipeline for client documents
- an Obsidian (or similar) personal-KB integration
- a knowledge-authoring UI
- any new provider SDKs or secrets dedicated to knowledge

Provider adapters under `lib/providers/*` and the event-ledger design above remain unchanged by this roadmap entry.

### Cross-references

- Roadmap placement and required gates: `docs/ROADMAP.md` (and historical detail in `docs/archive/v0.2-planning-spec.md` § Future Knowledge Layer).
- Future data model candidates (planning only): `docs/data-schema.md` § Future Knowledge Layer.
- Product positioning and security gates: `docs/research-report.md` § Future Knowledge Layer.
