# ResponseOS — Security & Compliance

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Canonical (go-forward). Extends [`../SECURITY.md`](../SECURITY.md) — the BAA matrix, retention modes, disclosure posture, and signature rules there are inherited; this doc adds the go-forward providers (Grok/OpenAI/HubSpot/Redis), PII handling for the realtime plane, OAuth/secret strategy, RBAC, rollback, and DR.
**Anchored by:** ADR-0004 (lanes) · ADR-0009 (signatures) · ADR-0012 (voice providers) · ADR-0014 (Redis) · ADR-0015 (HubSpot)

> **ResponseOS is NOT HIPAA-certified.** Compliance is a per-deployment property (the lane), never a product property. Never represent the platform as HIPAA-compliant in copy, comments, contracts, or commits.

---

## 1. Hard rules (always)

- **No hardcoded secrets.** `.env.example` is placeholders only. Platform secrets in env/Secrets Manager; tenant credentials encrypted in the DB.
- **Webhook signatures verified before any business mutation** (ADR-0009).
- **Tenant isolation** at every read/write — `organization_id` from session, never client input.
- **Payment boundary:** never store card data; Stripe hosted pages / Payment Intents only (v0.5).
- **Audit logging** on every admin action, profile change, break-glass, and data export.
- **No Firebase.** **Not HIPAA-certified.**

---

## 2. PII handling (realtime plane included)

| Data | Where | Protection |
|---|---|---|
| Live audio | Twilio ↔ gateway ↔ provider | TLS in transit; not persisted by the gateway |
| Ephemeral session state | Redis | TTL'd; org-namespaced keys; not durable; lost = degrade only |
| Raw transcript/recording | Object storage `org_id/raw/...` | Restricted to `aj_admin` break-glass; per-lane retention |
| Redacted transcript | Object storage `org_id/redacted/...` | QA/operator; per lane |
| Canonical PII (contact) | Postgres, tenant-scoped | RBAC; mirrored to HubSpot per tenant |
| Analytics | PostHog | `organization_id` + metrics only; **no raw PII** (ADR-0018) |

**Voice-provider PII rule:** Grok Voice and OpenAI Realtime receive call audio/text in real time. Before any **regulated-lane** tenant uses them, each provider's retention + training-data + BAA posture must be verified (ADR-0012). On the Standard lane (non-PHI home services), use is permitted with disclosure + consent; the data-processing posture is still documented and reviewed.

---

## 3. Compliance lanes (per tenant, ADR-0004)

| Lane | Voice providers | Recordings | Transcripts |
|---|---|---|---|
| **Standard** (default, MVP) | Grok (primary) / OpenAI (fallback) permitted with disclosure + consent | Stored, configurable retention | Full + redacted |
| **Privacy-hardened** | Permitted only with PII scrubbing + short retention; review per provider | 30d default | Redacted only; structured facts kept |
| **HIPAA-ready** (pattern only) | **Blocked** until BAA/retention/training posture verified per provider | KMS-encrypted, lifecycle | per BAA |

The lane is a per-tenant property honored by provider adapters (storage mode, retention) and the policy engine. Onboarding a regulated-adjacent tenant requires lock-in of the vendor allowlist + storage policy before go-live (see `../SECURITY.md` BAA matrix).

---

## 4. Webhook signature validation (go-forward)

Inherited (Twilio, Stripe, HighLevel, n8n) from `../SECURITY.md` plus the go-forward providers:

| Provider | Header / scheme | Rule |
|---|---|---|
| Twilio | `X-Twilio-Signature` | HMAC-SHA1, full URL + sorted params, raw body |
| Grok Voice (xAI) | provider HMAC (raw body) | verify signature + freshness window; reject stale |
| OpenAI Realtime | provider signature scheme | verify per provider docs at integration time |
| HubSpot | v3 signature (client secret + method + URI + body) | constant-time compare; reject mismatch |
| n8n | shared secret header | constant-time vs `N8N_WEBHOOK_SECRET` |
| Stripe (v0.5) | `Stripe-Signature` | `constructEvent`; IP allowlist |

Invalid signature → **401, no body parse, no business mutation, log to security stream.** Each new provider ships its rule here + a passing integration test before go-live (the exact Grok/OpenAI schemes are confirmed at the v0.3 readiness gate).

---

## 5. Secret management

| Secret class | Storage | Rotation |
|---|---|---|
| Platform provider keys (Grok, OpenAI, Twilio, Resend, observability) | Vercel env / AWS Secrets Manager | quarterly / on config change |
| Webhook signing secrets | Secret store | with provider config change |
| Tenant OAuth tokens (HubSpot, Google) | **DB, encrypted at rest**, decrypted at request time | provider refresh flow |
| DB credentials | Secret store | per policy |
| Internal gateway↔core service token / mTLS | Secret store | per policy |

Never in the repo, ever. `NEXT_PUBLIC_*` vars are treated as public; tenant-specific keys never use that prefix and live in the DB (`../env-spec.md`).

---

## 6. OAuth strategy

- HubSpot + Google use OAuth 2.0; tokens encrypted in `provider_connections` scoped to `organization_id`.
- Scopes are least-privilege (only what the connector needs).
- Token expiry → mark `expired`, prompt re-connect, queue dependent jobs (no silent failures).
- Disconnect revokes + marks disconnected; offboarding clears tenant credentials.

---

## 7. RBAC

| Role | Scope |
|---|---|
| `aj_admin` | Full cross-tenant; AJ staff; only role with break-glass to raw artifacts |
| `operator` | Cross-tenant operational read/write; AJ staff |
| `client_admin` | Full access to own workspace; cannot cross workspaces |
| `client_viewer` | Read-only own workspace |

Enforced at the data layer (server-side) AND hidden in the UI (defense in depth). **Break-glass** into a tenant: logged with reason, time-boxed, notifies the tenant `client_admin`; all actions marked in the audit log.

---

## 8. Audit trails

`audit_logs` + `audit.*` events capture admin actions, profile/prompt changes, break-glass, and exports — `actor` (user + role), `action`, `target`, `reason`, before/after refs, timestamp. Immutable; retained ≥ 1 year (incident evidence). See [`../architecture/RESPONSEOS_EVENT_SCHEMA.md`](../architecture/RESPONSEOS_EVENT_SCHEMA.md) § 7.

---

## 9. Consent & disclosure

- Recording + AI disclosure on every call; **tenant policy objects**, jurisdiction-aware (not hardcoded). Per-state/per-country variants in v0.3.
- `consent_records` per contact (recording, AI handling, marketing) with jurisdiction + timestamp.
- Outbound campaigns: consent + jurisdiction validated before dispatch (TCPA-aware); opt-out honored immediately.

---

## 10. Compliance considerations

| Area | Posture |
|---|---|
| TCPA / call-recording consent | Tenant policy objects; consent-gated outbound; disclosure on every call |
| PII minimization | Store only what's needed for service/QA/billing; redaction per lane before persistence |
| Vendor chain | BAAs/DPAs where regulated data is possible (`../SECURITY.md` matrix); voice providers reviewed before regulated use |
| Data residency | Standard lane assumptions documented; HIPAA lane is AWS-hosted pattern |
| Data subject rights | Tenant-scoped export + deletion workflows (offboarding) |

---

## 11. Rollback strategy

Per `../DEPLOYMENT.md`, extended for the gateway:

1. Revert prompt/policy/routing **profile** to last-known-good version (immutable history makes this instant).
2. Disable self-schedule / a failing tool for the affected tenant.
3. Route inbound calls to human backup (transfer rule) or fail over voice provider.
4. Roll back the offending service deploy (gateway and app deploy independently).
5. Replay the event ledger into a corrected derived state.
6. Publish an incident timeline in the operator portal.

---

## 12. Disaster recovery

| Asset | DR posture |
|---|---|
| Event ledger (Postgres) | Backups + PITR; the ledger is the recoverable truth (everything recomputes from it) |
| Object storage | Versioning + lifecycle (R2 Standard; S3+KMS HIPAA) |
| Redis | Ephemeral — no DR needed; loss degrades in-flight calls only |
| Tenant credentials | Encrypted; restore with DB |
| n8n definitions | In Git (Git is upstream of n8n) |
| RTO/RPO targets | Defined per lane in `../DEPLOYMENT.md`; ledger PITR enables low RPO |

DR drills are part of the quarterly review (Observability & Governance § B4).

---

## 13. Incident response (summary)

Severity matrix inherited from `../SECURITY.md` (P0 data breach → page immediately, freeze writes if needed; P1 customer-impacting/validation failures → page + 15-min update; P2 single-tenant; P3 cosmetic). Evidence retained ≥ 1 year. Customer notification per contract + jurisdiction. Procedures in [`RESPONSEOS_RUNBOOK.md`](./RESPONSEOS_RUNBOOK.md).

---

## 14. Assumptions & open questions

**Assumptions:** Grok/OpenAI expose validatable webhook signatures and acceptable Standard-lane data-processing terms; HubSpot OAuth + v3 webhook signatures meet needs; Redis on the Standard lane needs no DR.

**Open questions:** (1) confirmed retention + training-data posture for Grok Voice and OpenAI Realtime (blocks regulated-lane use); (2) whether Standard-lane tenants need a documented DPA with the voice providers; (3) RTO/RPO targets per lane.

---

*ResponseOS Security & Compliance — AJ Digital LLC / Audio Jones. Documentation phase only. ResponseOS is not HIPAA-certified.*
