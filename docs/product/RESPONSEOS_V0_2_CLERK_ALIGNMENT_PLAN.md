# v0.2 Closeout Step 2.4 — Clerk Auth Alignment Implementation Plan

**Owner:** AJ Digital LLC / Audio Jones
**Status:** Planning only. **No code, schema, migration, generated-client, runtime, deploy, UI, KMS/Vault, object-storage, or live-provider changes ship with this artifact.**
**Anchored by:** ADR-0001 (mock-first), ADR-0002 (event-ledger-first), ADR-0004 (compliance lanes), ADR-0005 (Clerk for Standard-lane auth), ADR-0009 (webhook signature validation), ADR-0019 (closeout-first), ADR-0020 (provider credential encryption).
**Tracks:** issue #27 (roadmap checkpoint). Per ADR-0019 step 2.4.
**Read first:** [`docs/DECISIONS.md` ADR-0005](../DECISIONS.md#adr-0005--clerk-for-authentication-standard-lane); [`lib/auth/session.ts`](../../lib/auth/session.ts); [`lib/data/session-helpers.ts`](../../lib/data/session-helpers.ts); [`docs/architecture/RESPONSEOS_DATA_MODEL.md`](../architecture/RESPONSEOS_DATA_MODEL.md); [`AGENTS.md`](../../AGENTS.md) tenant-isolation rule.

> This artifact specifies how Clerk auth replaces the v0.2 placeholder session (`lib/auth/session.ts`) **without changing the public session contract that every consumer in `lib/data/*`, `lib/auth/session-helpers.ts`, page components, and API routes calls today.** The five public exports stay; only the internals change. The operator must explicitly authorize each implementation PR before any code lands.

---

## 1. Current State

After step 2.3 (PRs #33–#37), `master` is at `7c9e005b`. The auth-relevant surface today:

| Surface | Today |
|---|---|
| Session contract | `lib/auth/session.ts` — placeholder. Reads `RESPONSEOS_DEV_SESSION` env var, returns one of four hard-coded `DevSessionConfig` records (`aj_admin`, `operator`, `client_admin@org_mock_1`, `client_viewer@org_mock_1`). Throws `DevSessionInProductionError` when the env var is set under `NODE_ENV=production`. |
| Public exports | `getCurrentSession`, `getCurrentUser`, `getCurrentAccount`, `requireRole`, `requireTenantScope`, `resolveTenantScope` — plus types `Session`, `SessionUser`, `SessionAccount` and errors `TenantScopeError`, `RoleDeniedError`, `DevSessionInProductionError`. |
| Tenant-scope helper | `lib/data/session-helpers.ts` — `withTenantScope` (used by every `lib/data/*` accessor), `assertRowInScope`, `isCrossTenantRole`. Imports `Session` from `lib/auth/session`. |
| Roles | `UserRole = "aj_admin" | "operator" | "client_admin" | "client_viewer"` (defined in `types/user.ts`). `aj_admin` + `operator` bypass tenant scope per spec §3 + §4. |
| `Account` row | `Account` model has `id`, `name`, `slug`, `industry`, `website_url`, `primary_phone`, `timezone`, `status`. No external-auth columns. |
| `User` row | `User` model has `id`, `account_id?`, `role`, `name`, `email` (unique), `phone`. `account_id null` indicates AJ-internal staff per ADR-0005 / spec §3. No external-auth columns. |
| Provisioning | All users are seeded via `prisma/seed.ts`. No sign-up surface. No invites. |
| Route protection | None. Pages and API routes call `getCurrentSession()` and rely on the placeholder to return a session. PR #14 (draft, deferred) adds `proxy.ts` with HTTP basic auth as a deploy-only edge gate. |
| Tests | 69/69 unit + 85/85 integration green. Many tests call `setDevSession(...)` to flip the placeholder session and assert role/tenant behavior. |
| Env vars used today | `RESPONSEOS_DEV_SESSION` (placeholder), `BASIC_AUTH_USER`/`BASIC_AUTH_PASS` (PR #14 only — not on master), `DATABASE_URL`/`DIRECT_URL` (Prisma), `RESPONSEOS_PROVIDER_KEY` (ADR-0020 encryption module). |

Step 2.4 (this artifact) plans the swap. Step 2.5 (UI rebuild) is the next milestone after 2.4; v0.3 demo deploy unlocks after 2.5.

---

## 2. The Unchanging Public Contract

The single most important guardrail in this entire plan: **the public surface of `lib/auth/session.ts` does not change.**

```ts
// Public exports — must not change shape or behavior contract
export interface SessionUser { id; email; name; role: UserRole; }
export interface SessionAccount { id; slug; name; }
export interface Session { user: SessionUser; account: SessionAccount | null; expires_at: string; }

export async function getCurrentSession(): Promise<Session | null>
export async function getCurrentUser(): Promise<SessionUser | null>
export async function getCurrentAccount(): Promise<SessionAccount | null>
export async function requireRole(role: UserRole | UserRole[]): Promise<Session>
export async function requireTenantScope(accountId: string): Promise<void>
export async function resolveTenantScope(callerSuppliedId?: string): Promise<string | undefined>

export { TenantScopeError, RoleDeniedError, DevSessionInProductionError }
```

Every existing consumer — `lib/data/*` (16 accessors), `lib/data/session-helpers.ts`, page components in `app/(admin)/*` and `app/(client)/*`, API route handlers, and 24+ test files — continues to work without code changes. The Clerk integration replaces only the *internals* that resolve `getCurrentSession()` from `process.env.RESPONSEOS_DEV_SESSION` to `Clerk.auth()`.

**Behavior preservation rules under Clerk:**

| Rule | Source | Preserved by |
|---|---|---|
| Session is `null` only for unauthenticated requests | placeholder contract | Clerk's `auth().userId === null` → return `null`. |
| `aj_admin` / `operator` bypass tenant scope | spec §3 + ADR-0005 | Role derivation from Clerk metadata (see §4.4). |
| Caller-supplied `accountId` mismatches a tenant user's session → throw `TenantScopeError` | `session-helpers.ts` defense-in-depth | Unchanged; tests already exercise this. |
| `RESPONSEOS_DEV_SESSION` under `NODE_ENV=production` throws `DevSessionInProductionError` | placeholder hard guard | Preserved (see §4.7 — dev-session takes priority in non-production environments, but production still throws). |
| Mock-fallback when no auth backend is configured | ADR-0001 | When `CLERK_SECRET_KEY` is absent and `NODE_ENV !== "production"`, fall back to the existing dev-session logic. App boots with zero Clerk credentials. |

---

## 3. Conventions (inherited)

- **Tenant isolation is non-negotiable.** Every read/write filters by `accountId` derived from the session, never from client input (AGENTS.md security rule + ADR-0019).
- **Mock-first** (ADR-0001). The app boots and runs without Clerk credentials. The placeholder dev-session continues to work in non-production environments when Clerk env vars are absent.
- **Event-ledger-first** (ADR-0002). User/org/membership webhook events from Clerk land in the ledger (eventually — see §4.9) before any business mutation.
- **Signed webhooks** (ADR-0009). The Clerk webhook handler validates signatures before any business mutation. Aligns with the `webhook_events` substrate already in place.
- **Provider-adapter pattern** (ADR-0005 closing line: "lock-in is bounded because the integration is one module: `lib/auth/*`"). The Clerk-specific code lives behind the existing public contract; swapping Clerk for Cognito (HIPAA lane) means rewriting only `lib/auth/*` internals.
- **Compliance lanes** (ADR-0004). Clerk is the Standard-lane auth provider. Privacy-hardened uses Clerk too. HIPAA-ready (v0.3+) will swap for a BAA-eligible provider; **step 2.4 does NOT introduce the HIPAA-ready path.**

---

## 4. Clerk Integration Design

### 4.1 Provider setup

Clerk is the auth provider for the Standard lane per ADR-0005. Step 2.4 wires:

- The Clerk Node SDK (`@clerk/clerk-sdk-node`) for server-side `auth()` calls.
- The Clerk Next.js SDK (`@clerk/nextjs`) for server-component / page integration and the Next.js 16 `proxy.ts` middleware.
- Clerk Dashboard configuration (sign-in, sign-up, organization invite flows, allowed origins) — operator-managed; not in the codebase.

**Standard lane only.** HIPAA-ready lane swap is deferred to a future ADR + PR.

### 4.2 ResponseOS ↔ Clerk identity mapping

Two questions: *do Clerk user IDs become ResponseOS User IDs?* and *who is the system of record?*

**Decision:** ResponseOS keeps its own `User` row as the system of record (so seeded test data remains stable and the existing `user_*_1` ids in mocks/integration tests survive). Clerk's `user.id` is the **external identity** stored as a new nullable column on `User`.

```prisma
model User {
  id            String   @id @default(cuid())  // unchanged — internal SoR id
  account_id    String?
  role          UserRole
  name          String
  email         String   @unique
  phone         String?
  clerk_user_id String?  @unique               // NEW (additive, nullable)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  @@index([account_id])
}
```

**Why nullable + unique:** seeded fixture users (`user_aj_admin_1`, `user_acme_owner_1`, etc.) have no Clerk identity yet — they are placeholders for parity tests. The first time the linked Clerk user signs in, the webhook (or just-in-time provisioning per Open Q1) sets `clerk_user_id`. Unrelated rows whose `clerk_user_id` is null cannot sign in via Clerk — they're test-only data.

### 4.3 ResponseOS ↔ Clerk organization mapping

Clerk's **Organizations** primitive maps cleanly to our `Account`. Adding `clerk_org_id` to `Account`:

```prisma
model Account {
  id            String          @id @default(cuid())
  // …existing columns unchanged…
  clerk_org_id  String?         @unique         // NEW (additive, nullable)
  // …
  @@index([clerk_org_id])                       // NEW
}
```

**Two special tenants:**

1. **The AJ Digital cross-tenant org.** AJ Digital staff (`aj_admin`, `operator`) belong to a *single* Clerk Organization — the "AJ Digital" org. This is the one Clerk org whose `account_id` mapping is `null` from the session's perspective (i.e., `Session.account = null`). Its Clerk org id is held in an env var (Open Q3).
2. **Per-tenant client orgs.** Each ResponseOS `Account` corresponds to one Clerk Organization. `Account.clerk_org_id` holds the mapping. `Account` rows with `clerk_org_id = null` are tests/seeds and not sign-in-able.

### 4.4 Role resolution

ResponseOS has four roles: `aj_admin`, `operator`, `client_admin`, `client_viewer`. Clerk's per-org roles are operator-defined; the mapping is:

| Clerk Organization | Clerk role | ResponseOS `UserRole` |
|---|---|---|
| AJ Digital | `aj_admin` | `aj_admin` |
| AJ Digital | `operator` (or `member`) | `operator` |
| Per-tenant client org | `admin` | `client_admin` |
| Per-tenant client org | `member` (or `viewer`) | `client_viewer` |

The `requireRole` / `resolveTenantScope` semantics are unchanged. The mapping happens at the seam between Clerk's session shape and our `Session` shape inside `lib/auth/clerk-session.ts` (or wherever the resolver lives).

**Source of truth for role per session:** Clerk's *active organization* + the caller's role within it. A user belonging to multiple orgs picks one via Clerk's organization-switcher; the active org drives the session. AJ Digital staff who never switch into a client org always see `Session.account = null` and operate cross-tenant.

### 4.5 Session derivation

The internal implementation `lib/auth/session.ts` becomes a thin dispatcher:

```ts
// pseudocode — not the final code, illustrative only
export async function getCurrentSession(): Promise<Session | null> {
  // 1. Dev override: in non-production, RESPONSEOS_DEV_SESSION wins.
  //    Production guard still throws (preserved from today).
  const devSession = resolveDevSession();      // existing logic
  if (devSession) return buildSessionFromDevConfig(devSession);

  // 2. Clerk path: when CLERK_SECRET_KEY is set, read auth() from Clerk.
  if (process.env.CLERK_SECRET_KEY) {
    return buildSessionFromClerk();             // NEW
  }

  // 3. Mock fallback: no auth backend configured (ADR-0001).
  return null;  // no session — same as unauthenticated
}
```

`buildSessionFromClerk()` calls Clerk's server-side `auth()`, then:

1. Resolves the Clerk `userId`, `orgId`, `orgRole`.
2. Looks up the ResponseOS `User` row by `clerk_user_id = userId`.
3. Looks up the `Account` row by `clerk_org_id = orgId`. (If the active Clerk org is AJ Digital, `Account = null`.)
4. Resolves `UserRole` per §4.4.
5. Returns a `Session` object.

If the lookup fails (Clerk user not linked to a ResponseOS row), behavior is governed by Open Q1.

### 4.6 Route protection

Today there is no route protection — every page and API route assumes `getCurrentSession()` returns a session. Under Clerk:

- **Next.js 16 `proxy.ts`** (the same file PR #14 introduced as a basic-auth gate) becomes the Clerk middleware seam. Clerk's `clerkMiddleware()` runs at the edge, enforces sign-in on protected matchers, and forwards the auth context to the request.
- **Protected matchers:** `/admin/*`, `/client/*`, `/api/admin/*`, `/api/client/*`, plus the existing per-resource API routes. Public matchers: `/`, `/sign-in/*`, `/sign-up/*`, `/api/health`, `/api/webhooks/*` (webhooks self-validate per ADR-0009), and the marketing/industries/pricing pages.
- **Sign-in / sign-up UI** lives at `/sign-in/*` and `/sign-up/*`, both Clerk-managed routes. Step 2.5 (UI rebuild) may restyle them; step 2.4 ships the default Clerk UI.

The deploy-only basic-auth edge gate from PR #14 is **superseded by Clerk middleware** when step 2.4 lands. PR #14 may be closed at that point or rebased to a thinner shape (Open Q11).

### 4.7 Tests / mock fallback

The single most important test-design decision: **`RESPONSEOS_DEV_SESSION` stays as the test bypass** even after Clerk is wired. Reasons:

1. ADR-0001 mock-first: tests must run with no Clerk credentials. Operator setup of Clerk for CI would be expensive and brittle.
2. The existing 69 unit + 85 integration tests already use `setDevSession(...)` to flip identity. Rewriting them against a Clerk test SDK would be a large diff in a security-sensitive area.
3. Dispatch order in §4.5 makes `RESPONSEOS_DEV_SESSION` priority 1 in non-production. CI never has `CLERK_SECRET_KEY` set; tests stay deterministic.
4. The production hard guard (`DevSessionInProductionError`) is unchanged: setting `RESPONSEOS_DEV_SESSION` under `NODE_ENV=production` still throws.

**Test additions in the implementation PRs (sketch):**

| Test | What it asserts |
|---|---|
| Dispatch order: `RESPONSEOS_DEV_SESSION` priority in non-prod | Existing tests already cover this implicitly; one new unit test makes it explicit. |
| Clerk path returns `null` when `CLERK_SECRET_KEY` is set but Clerk's `auth()` returns no `userId` | Unit-level mock of Clerk's SDK. |
| Clerk path resolves a known seeded `User` by `clerk_user_id` | Integration test against local Postgres with a row that has `clerk_user_id` pre-set. |
| Clerk path resolves Clerk org → `Account` mapping | Integration. |
| Role mapping (`aj_admin` org-role → `aj_admin` `UserRole`, client org `admin` → `client_admin`, etc.) | Unit. |
| Production hard guard preserved | Existing test; verify it still passes. |
| Clerk webhook signature validation (`ADR-0009`) | Integration. |

### 4.8 Sync — Clerk webhook + just-in-time provisioning

Two paths keep the ResponseOS `User` and `Account` rows in sync with Clerk's state:

**Path A: Clerk webhook (signed per ADR-0009).** Handler at `/api/webhooks/clerk/route.ts`:

| Event | Action |
|---|---|
| `user.created` | Create `User` row with `clerk_user_id`, `email`, `name`. Role and `account_id` are filled when the user gets an org membership (see below). |
| `user.updated` | Patch matching `User` row's `email` / `name`. |
| `user.deleted` | Soft-delete or null-out `clerk_user_id` (operator policy — Open Q5). |
| `organization.created` | Create `Account` row with `clerk_org_id`, `name`, `slug`. Other fields default; operator fills via admin UI. |
| `organization.updated` | Patch matching `Account` row's name / slug. |
| `organizationMembership.created` | Update the `User`'s `account_id` (for tenant users) and `role` per §4.4 mapping. |
| `organizationMembership.deleted` | Detach the `User` from the `Account` (set `account_id = null` and `role = "client_viewer"` as the safe default — Open Q6). |
| `organizationMembership.updated` | Re-run the role mapping. |

The handler:
1. Validates the Clerk webhook signature (env var `CLERK_WEBHOOK_SECRET`) before parsing the body — ADR-0009.
2. Writes a `webhook_events` row (using the existing `WebhookEvent` substrate from v0.1) keyed on Clerk's event id for replay-safety.
3. Performs the reconciliation as an idempotent upsert.

**Path B: Just-in-time provisioning on first sign-in.** A Clerk user signs in before the webhook has delivered `user.created`. The Clerk-session resolver finds no matching `User` row. Two options:

- **B1 (permissive — default):** Create the `User` row on the fly. Safe because the Clerk session already attests the user is authenticated and has a real Clerk identity.
- **B2 (strict):** Refuse the session — return `null`. The webhook must arrive first. More conservative; risks a few-seconds sign-in failure window.

Operator decides; see Open Q1.

### 4.9 Event ledger alignment

Clerk webhook events should also emit canonical events to the future event ledger per ADR-0002:

- `auth.user_signed_in`, `auth.user_signed_out`, `auth.session_revoked` — from Clerk's session events.
- `crm.org_synced` (or similar) — when org/user state changes propagate.

The `events` ledger table itself is **not** in step 2.4 scope (it's a v0.2 expansion item beyond 2.3). Step 2.4 wires only the `webhook_events`-row write per existing v0.1 substrate; the ledger emission lands when the ledger table lands.

---

## 5. Schema Changes Summary

| Table | Change | Nullability | Backfill needed |
|---|---|---|---|
| `User` | `+ clerk_user_id String? @unique` | nullable | no |
| `Account` | `+ clerk_org_id String? @unique` | nullable | no |
| `Account` | `+ @@index([clerk_org_id])` | — | no |

**Migration `0008_clerk_identity_columns`** — purely additive: two `ALTER TABLE … ADD COLUMN`, two unique indexes, one secondary index. **Zero data movement.** All existing seeded `User` and `Account` rows remain valid; both new columns read back `null` until a webhook (or admin tooling — out of scope) wires them.

The `User`, `Account`, and related accessors get type extensions matching the new columns. The session contract in `lib/auth/session.ts` does **not** change; only the dispatcher internals change.

---

## 6. Env Contract

| Env var | Required? | Used by |
|---|---|---|
| `CLERK_SECRET_KEY` | Production yes; preview optional; dev/test no | Server-side `auth()` calls; gates the Clerk dispatch path |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production yes; preview optional; dev/test no | Client-side sign-in UI components |
| `CLERK_WEBHOOK_SECRET` | Production yes (with webhook handler); preview optional | Signing/verification of `/api/webhooks/clerk/*` per ADR-0009 |
| `AJ_DIGITAL_CLERK_ORG_ID` | Production yes; preview optional | Mapping the cross-tenant AJ Digital Clerk org → `Session.account = null` (Open Q3) |
| `RESPONSEOS_DEV_SESSION` | Optional, dev/test only | Test bypass (preserved); production guard throws if set |
| `RESPONSEOS_PROVIDER_KEY` | Optional, ADR-0020 | Unchanged; unrelated to auth |

`.env.example` updates ship in 32A: document each new var, never include secrets. ADR-0001 mock-fallback rule continues to hold: with no Clerk env vars, the app boots and runs (placeholder dev-session in non-prod; `null` session in prod).

---

## 7. Recommended PR Split

### 7.1 Recommendation: **three scoped PRs**

| PR | Scope | Migration | Risk | Order rationale |
|---|---|---|---|---|
| **32A — Clerk identity schema + dependencies** | Migration `0008_clerk_identity_columns` (additive: `User.clerk_user_id`, `Account.clerk_org_id` + indexes); add Clerk SDK to `package.json`; `.env.example` documentation; **no consumer of the columns yet**. | `0008` | Very low. Pure schema + dependency add. | First because every subsequent PR depends on the columns and the SDK. Forward-compatible if 32B is delayed. |
| **32B — Clerk session derivation + role mapping** | Replace `lib/auth/session.ts` internals with the dispatch order in §4.5. Public contract unchanged. Add `lib/auth/clerk-session.ts` that calls Clerk's server-side `auth()` and maps to our `Session`. Add unit + integration tests for dispatch order, role mapping, and the production guard. Update existing tests if any new code paths affect them (expect zero changes if dispatch order is correct). | none | Medium. The auth seam is security-sensitive. Tests must prove behavior preservation. | Second because it activates Clerk-mode while keeping the placeholder fallback in non-production. CI continues to run on `RESPONSEOS_DEV_SESSION`. |
| **32C — Clerk webhook handler + route protection** | `/api/webhooks/clerk/route.ts` with signature validation (ADR-0009) and the event handlers in §4.8; `webhook_events` row writes for replay-safety. `proxy.ts` (or Next.js middleware) protects `/admin/*`, `/client/*`, `/api/admin/*`, `/api/client/*` matchers. Public matchers list per §4.6. Integration tests for webhook signing + protected-route deny/allow. | none | Medium. Webhook + route enforcement is security-sensitive. Tests must prove signature validation + matcher behavior. | Last because it requires §4.5 dispatch (32B) to already resolve Clerk sessions. |

### 7.2 Why this split

- **31A pattern.** Same shape as step 2.3's 31A → 31B → 31C → 31D: schema substrate first, then the seam that uses it, then the protective surface.
- **Reviewability.** Each PR has one clear concern: data, derivation, enforcement. A single mega-PR would mix all three security-sensitive surfaces.
- **Risk isolation.** If 32B's session-derivation has a subtle bug under load, 32A's columns are already present and 32C's webhook hasn't activated yet — rollback is simpler.
- **Forward compatibility.** Each PR's master after merge runs without breakage. 32A's columns are unused but harmless. 32B's Clerk path is dormant when env vars are absent. 32C wires the production posture.

### 7.3 What ships per PR (substrate vs. consumers)

| Surface | 32A | 32B | 32C |
|---|---|---|---|
| Migration | ✅ `0008` | — | — |
| `package.json` Clerk SDK | ✅ | — | — |
| `.env.example` | ✅ | — | additions if needed |
| `User` / `Account` Prisma model changes | ✅ | — | — |
| `lib/auth/session.ts` dispatcher | — | ✅ | — |
| `lib/auth/clerk-session.ts` (new) | — | ✅ | — |
| Role mapping | — | ✅ | — |
| `/api/webhooks/clerk/route.ts` | — | — | ✅ |
| `proxy.ts` route protection | — | — | ✅ |
| `WebhookEvent` ledger row writes | — | — | ✅ |
| Mock-fallback preserved | ✅ (no consumer of columns yet) | ✅ (priority dispatch) | ✅ (no Clerk env → public matchers behave as today) |
| Unit + integration tests | minimal (schema-shape) | dispatch + role mapping | signature + matchers |
| CHANGELOG entry | ✅ | ✅ | ✅ |

### 7.4 Migration numbering

`0008_clerk_identity_columns` (32A). 32B and 32C are migration-free.

---

## 8. Open Questions

Numbered as referenced above. Each is a question that needs an explicit operator decision before the corresponding implementation PR opens.

| # | Question | Default if uncontested | Lives in PR |
|---|---|---|---|
| **Q1** | **JIT provisioning policy.** When a Clerk user signs in before the `user.created` webhook has reconciled (option B1 vs B2 in §4.8): create the `User` row on the fly (permissive), or refuse the session and return `null` (strict)? | B1 (permissive) — Clerk's session already authenticates the user, and the webhook lag is typically seconds; strict mode risks user-visible failures. | 32B |
| **Q2** | **Test bypass retention.** Keep `RESPONSEOS_DEV_SESSION` as the priority dispatch in non-production (CI / local dev), or remove it once Clerk is wired? | Keep it (recommended, §4.7). Removing it forces every test file to set up Clerk mocks, which is fragile and security-sensitive to author. | 32B |
| **Q3** | **AJ Digital org id.** Where does the magic Clerk org id for AJ Digital cross-tenant staff live? Env var (`AJ_DIGITAL_CLERK_ORG_ID`), hard-coded constant, or a single seeded row in a new `auth_config` table? | Env var (`AJ_DIGITAL_CLERK_ORG_ID`) per-environment. Simpler and matches ADR-0020's env-managed-key pattern. No new table. | 32A + 32B |
| **Q4** | **Clerk org role names for client tenants.** Clerk's default org roles are `admin` / `member`. Use custom roles (`client_admin`, `client_viewer`) created via Clerk dashboard, or stick with defaults and map (`admin → client_admin`, `member → client_viewer`)? | Stick with defaults. Custom roles are operator-managed in Clerk and introduce coupling. Mapping happens in our resolver. | 32B |
| **Q5** | **`user.deleted` policy.** When Clerk fires `user.deleted` (a Clerk user is removed), what happens to the ResponseOS `User` row? Hard delete, soft delete (set `clerk_user_id = null`), or audit-log-and-keep? | Set `clerk_user_id = null` and write an `audit_logs` row with `category = "security"`. ResponseOS keeps the row for historical reference (lead/contact/audit history). | 32C |
| **Q6** | **`organizationMembership.deleted` role default.** When a Clerk user loses their org membership, what role should the ResponseOS `User.role` reset to? | `client_viewer` (safest) AND set `account_id = null` AND write an `audit_logs` row with `category = "security"`. The user is effectively orphaned; they should be unable to read tenant data until re-invited. | 32C |
| **Q7** | **Cross-tenant impersonation / break-glass.** Should `aj_admin` be able to "act as" a client_admin to debug tenant issues? This is the closest cousin to the deferred break-glass transcript read. | Out of scope for step 2.4. Defer to the post-31D privileged-read PR; that PR can use the `audit_logs.category = "break_glass"` substrate to log every impersonation event. | future |
| **Q8** | **Sign-up / invite flows.** Should clients self-sign-up via Clerk? Or invite-only? | Invite-only. ResponseOS clients onboard via assisted setup, not self-service. Clerk's invite-only mode is set in the dashboard; no codebase change. | future / operator |
| **Q9** | **2FA / MFA enforcement.** Required for `aj_admin`? For `client_admin`? Or off by default? | Off by default in step 2.4. Enforcement is a Clerk dashboard policy and an Open Q for v0.3. | future / operator |
| **Q10** | **HIPAA-ready lane.** Clerk per ADR-0005 covers Standard + Privacy-hardened; HIPAA-ready needs Cognito (or equivalent BAA-eligible auth). Does step 2.4 introduce the HIPAA lane swap stub? | No. HIPAA lane is v0.3+ and gets its own ADR + PR; step 2.4 is Clerk-only. | future |
| **Q11** | **PR #14 deferred-deploy basic-auth gate disposition.** Step 2.4's Clerk middleware supersedes PR #14's basic-auth gate. Should PR #14 be (a) closed and replaced, (b) rebased to a thinner shape (e.g., keep the runbook, drop `proxy.ts`), or (c) left as-is until step 2.5 closeout? | Close and replace once 32C lands. The runbook content can fold into a future v0.3-deploy ADR/runbook. | post-32C |
| **Q12** | **Webhook secret rotation.** Stored as a plain env var (`CLERK_WEBHOOK_SECRET`) or wrapped under ADR-0020's encryption module? | Plain env var. The webhook secret is not a per-tenant credential; ADR-0020's substrate is for tenant-specific encrypted blobs. | 32C |
| **Q13** | **Seeded fixture users — Clerk linking.** The 4 seeded users (`user_aj_admin_1`, `user_acme_owner_1`, etc.) have `clerk_user_id = null` and cannot sign in. Should step 2.4 seed any "test" Clerk identities, or are seeded users strictly test-only? | Strictly test-only. Real Clerk users are operator-provisioned via the dashboard / webhook. Seeded users continue to exist for parity tests. | 32A |
| **Q14** | **Server-side session caching.** Clerk's `auth()` returns the session from a JWT; per-request DB lookups for `User` + `Account` add latency. Should the resolver cache the lookup per-request? | Yes — cache for the request lifetime only (Next.js's per-request `cache()` helper). Cache key is `clerk_user_id`. No cross-request caching in step 2.4. | 32B |
| **Q15** | **`existsInAccount` vs `belongsToAccount` distinction.** When a `client_admin` is invited to a second tenant org in Clerk (rare but possible), how does our session resolve `Session.account`? | Use Clerk's *active organization* as the seam. The user picks one via Clerk's org switcher. If active org is the AJ Digital org, `Session.account = null` (cross-tenant). | 32B |
| **Q16** | **Doc impact.** Which active docs need cross-reference updates? | `docs/SECURITY.md` (tenant-isolation rule pointer to Clerk), `docs/architecture/RESPONSEOS_BACKEND_SPEC.md` (auth section), `AGENTS.md` if the security-rule wording changes. Active-docs-only; no narrative sweeps. | 32B and 32C |

---

## 9. Non-Goals (Explicit Confirmation)

Per the operator authorization for step 2.4 planning:

| Excluded surface | Confirmation |
|---|---|
| **Privileged raw-transcript read accessor** | Still deferred per ADR-0019 + planning §3.5 Q7 + step-2.3-31D guidance. Even though 31D shipped the `break_glass` audit substrate, the raw-transcript read accessor lands AFTER step 2.4 so it can use real `aj_admin` role enforcement, not the placeholder. |
| **Break-glass transcript retrieval flow** | Same as above. |
| **Object-storage integration (R2 / S3)** | Not in this PR set. Per ADR-0006 / ADR-0019 v0.3 territory. |
| **Live provider wiring** | Twilio / HubSpot / Grok / OpenAI / n8n / Stripe webhook handlers stay out per ADR-0001 + ADR-0019. |
| **KMS / Vault integration** | ADR-0020 keeps `RESPONSEOS_PROVIDER_KEY` env-managed for v0.2. Clerk's webhook secret is the same posture. |
| **Deploy work** | PR #14 stays draft. Operator decides Q11 after 32C lands. |
| **UI rebuild against `DESIGN.md` tokens** | Step 2.5 territory. Step 2.4 ships the default Clerk sign-in/sign-up UI; restyling happens in 2.5. |
| **Marketing / pricing / brand page changes** | None. Public matchers in §4.6 leave those pages unprotected, unchanged. |
| **HIPAA-ready lane (Cognito swap)** | Q10 — deferred. |
| **`events` ledger table** | Not in 2.4 scope. See §4.9. |
| **Doc sweeps unrelated to the auth contract** | None. Only the active-docs cross-references in Q16. |
| **Seed-idempotency cleanup (#26)** | Stays P2; not touched. |
| **Opportunistic refactors** | None. |
| **Removal of `RESPONSEOS_DEV_SESSION`** | Explicitly kept per Q2 (recommended). |

---

## 10. Next Gate

This plan is **draft + advisory**. No implementation PR opens without explicit operator authorization.

**Required approval before 32A begins:**

1. Operator confirms the **three-PR split recommendation** in §7, OR specifies an alternative split.
2. Operator resolves the **16 open questions** in §8 (or batches them per-PR — Q3, Q13 before 32A; Q1, Q2, Q4, Q14, Q15 before 32B; Q5, Q6, Q11, Q12 before 32C; Q7–Q10, Q16 standing or post-step-2.4).
3. Operator confirms the **non-goals** in §9 still hold.
4. Operator authorizes **32A specifically** with a per-PR scope checklist (matching the #29/#30/#33/#34/#36/#37 pattern).

After the 3 implementation PRs land:

| Milestone | Status |
|---|---|
| Step 2.4 Clerk auth alignment | ⏳ Will be complete |
| Privileged raw-transcript read accessor | ⏳ Unblocked — can ship as its own scoped PR using real `aj_admin` enforcement + `audit_logs.category = "break_glass"` |
| Step 2.5 UI rebuild against `DESIGN.md` tokens | ⏳ Next milestone |
| v0.3 demo deploy | ⏳ Unlocks after step 2.5 |

---

*ResponseOS v0.2 closeout step 2.4 planning artifact — AJ Digital LLC / Audio Jones. Documentation phase only.*
