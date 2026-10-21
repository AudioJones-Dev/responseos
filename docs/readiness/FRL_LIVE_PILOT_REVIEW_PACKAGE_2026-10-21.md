# FRL live pilot — review package and approval request (2026-10-21)

Scope approved by the owner on 2026-10-21: review and preparation only. Every live-call gate stays closed. Nothing in this package has been pushed, migrated, routed, credentialed or enabled. The only call window it asks for covers internal rehearsals with the owner present (§8).

## 1. Release base and PR strategy

Read-only `git fetch` on 2026-10-21. Graph:

```
origin/master 915051a ── 141 commits ──▶ 8bdd184  origin/accepted/grok-qualification-app-20261020 (published, accepted 2026-10-19)
                                            │      control: origin/accepted/grok-qualification-control-20261020 = 1ff5e37
                                            └─ 29 local-only commits ──▶ 31a58bd  work/frl-vercel-authority-files-20261020 (app)
                                                                           │      control: work/frl-vercel-authority-files-control-20261020 = 3fc4f5c (local only)
                                                                           └─ pilot commits (this work) ──▶ feat/frl-live-supervised-pilot-20261021
```

- `master` has not moved since the chain branched (`915051a`). The app chain is 170 commits ahead and 0 behind.
- **The pilot depends on the 29 local-only commits.** They introduce the Sam/Ara profile (`39a976b`, `e1ec486`, `34bfcf8`), the approved-knowledge binding (`fe18e57`, `211e449`), the cross-host and signed watchdog readiness (`8a9726c`…`35920b5`) and the runtime-authority packaging (`7b2b6dc`, `55402de`, `31a58bd`). Dropping them would remove the code the pilot modifies.
- Earlier reviewed pairs recorded in local readiness docs (`39a976b`/`040bed3`, `fc504ef`/`570f22b`) sit inside those 29 commits. None of the 29 is on GitHub, and none was CI-validated.
- The deployed Railway SHA could not be read: Railway's API and dashboard are down (§9), and no Railway CLI is installed on this machine.

**Recommended (needs separate approval to push):** two stacked draft PRs, neither against `master`.

1. **Successor PR**: base `accepted/grok-qualification-app-20261020` (`8bdd184`), head = the 29 commits to `31a58bd`. Codex's work, reviewed as Codex's.
2. **Pilot PR**: base = the successor branch, head = the pilot commits only. This is the change for independent review.

The 141 commits from `master` to `8bdd184` keep their own path to `master` and are not re-reviewed here. Alternative if pushing Codex's branch is unwanted: hand the pilot commits to Codex as a patch on `31a58bd`.

## 2. Review

**What this review is, and is not.** A fresh-context reviewer agent, the same model family as the builder, reviewed `c0fc7b1` and the inherited code it relies on, read-only. That is an adversarial pass, **not** the independent review you asked for. Under the roles you set (Codex builds, Claude reviews), Codex or a person should review the final pilot commits before any approval. Brief for that reviewer: the focus list in your message, this section, and `git diff 31a58bd f0beedd`.

| # | Finding | Status | Evidence |
|---|---|---|---|
| B1 | Pilot ignored the tenant's own consent policy, so transcripts were stored even with transcription off | **Fixed** `f0beedd` | Admission and every write require `policy.consent.transcription.enabled` true and recording off. Test: "a tenant whose consent policy turns transcription off stores no turns" |
| B2 | Transcript writes didn't serialize with withdrawal/drain, and the withdrawal review didn't list turns | **Fixed** `f0beedd` | Writes take the capture lock (the one drain takes) before the session row. `withdrawalActivity` lists `pilotTurns`, and the console stops showing a withdrawn call's transcript. Test: "a withdrawal stops transcript capture and blocks the review" |
| M1 | Tenant check used a second pool connection inside a locked transaction (pool starvation could stall the heartbeat past 3 s and drop the caller) | **Fixed** | `supervisedExecutionAuthorized(…, tx)` |
| M2 | Transcript writes held the session lock across contract and readiness reads | **Fixed** | Writes recheck only row state, under a 250 ms bounded lock. The 1 s heartbeat still enforces contract and readiness, so after readiness loss a turn can still be written for up to about 1 s before the heartbeat stops the session (documented) |
| M3 | Transcript can be incomplete or out of order: dropped writes are silent, interrupted Sam turns are stored, caller turns arrive late | **Open (mitigated)** | Every pilot draft now carries a "machine transcript; confirm with the caller" flag. A dropped-write counter and xAI item ordering are not built |
| M4 | "30-day" covers only local transcript copies | **Open (documented)** | §3 inventory lists what stays: payload summary, Contact/Call number, webhook bodies, HubSpot, email, xAI, backups |
| M5 | Admission mode and turn account were only app-enforced | **Fixed** | 0029 triggers: `admission_mode_is_immutable`, `transcript_turn_requires_pilot_session` (append-only, account must match a pilot session). Tested |
| M6 | Contract rotation or a late admission cuts a live caller | **Partly fixed** | Admission now refuses if the contract has less than one call's length left. Rotating the contract mid-call still ends the call; the runbook must forbid rotation with a call active |
| m1 | End call needs the assignment exactly `active`, so quarantine or release mid-call blocks it | **Open** | Recommend allowing End call on assignment id+account regardless of status. Needs care: it touches the inherited end-call contract |
| m2 | Consent tie-break order | **Fixed** | Uses `orderConsentEvents` |
| m3 | No `capture_ended_at` check on writes | **Fixed** | |
| m4 | A pilot capture could be started on the Telnyx assistant | **Fixed** | `pilot_requires_grok` |
| m5 | xAI echo not checked for transcription | **Fixed** | A pilot session fails before any audio if the echo lacks `grok-transcribe`. Tested. The caller then hears the abrupt cutoff, so this belongs in rehearsal checks |
| m6 | Limit inconsistency (15 vs 5 min) | **Fixed** | 5 min everywhere; 15 is your separate decision |
| m7 | Migration lock and scan | **Fixed** | `NOT VALID` + `VALIDATE`. The reservation constraint is no longer touched |
| m8 | Hangup-path draft can lose a lock race silently | **Open** | Console button is the fallback |
| m9 | One unverified hangup blocks all later handoffs (global slot) | **Open (inherited)** | Needs a runbook recovery step |

The reviewer also verified as sound, with evidence: no transcript before the grant; no writes after stop; lock order with no cycle; tenant isolation (no client-supplied account); admission matching; hangup authority after contract expiry; no duplicate HubSpot/email dispatch (hash-idempotent revisions, dispatch fences); no transcript text in HubSpot or email; atomic, audited purge.

**Inherited dependencies:** the 29 successor commits were read where the pilot touches them (Grok service, bridge, qualification, withdrawal, end-call, migrations 0026–0028) but **not reviewed as a whole**. They need their own review on the successor PR.

## 3. Retention and data inventory

**30-day transcript deletion is not operationally enforced.** The sweep exists in code, but ADR-0064 refuses `--apply` under `NODE_ENV=production` and runs only when an operator invokes it. Until a hosted purge path is approved, transcripts stay until someone runs the purge by hand.

| Where | What | Raw transcript? | Expires? | Notes |
|---|---|---|---|---|
| `WebhookEvent.raw_body` (Telnyx call-control) | Caller and dialled number, call IDs, keypad digits, timestamps | No (the Grok transcript never passes through Telnyx webhooks) | **No.** Call-control events are stored with `payload_expires_at: null`, and the 90-day demo sweep covers only the demo account | Gap: needs a pilot payload expiry |
| `Call` | from/to number, start/end, status, **`transcript` copy** | Yes (copy) | Transcript cleared by the pilot sweep. Number and times: **no** | Number kept for dedupe and CRM linkage |
| `Contact` | Caller phone; later name, city, ZIP from normalization | No | **No** | Created on `call.initiated`, before consent, even for callers who press 2 |
| `CallCaptureSession` | Snapshot, state machine, keypad decision | No | No | Operational evidence |
| `CallConsentEvent` | Grant/withdraw, operator ID, references | No | No (deliberately permanent evidence, ADR-0055) | |
| `GrokTranscriptTurn` | Every caller and Sam utterance after consent | **Yes (primary)** | `expires_at` = +30 days; deleted by the pilot sweep **when run** | |
| `CallReview.evidence_json` | Transcript copy and summary | Yes (copy) | Transcript nulled by the pilot sweep; summary kept | |
| `CallReview.payload_json` | Structured intake: name, phone, product, city, summary, next action | No (structured; an operator could paste excerpts into the summary) | **No** | The approved record |
| `CrmSyncOperation` | Provider IDs, redacted binding | No | No | Only local pointer to the HubSpot copy |
| HubSpot | Contact (name, phone), call activity (caller, relationship, service, location, sanitized summary), follow-up task | No | **Never by ResponseOS**; HubSpot's retention applies | Purge does not reach HubSpot |
| Email (Resend + FRL inbox) | Structured fields and summary, no transcript | No | Resend's retention; FRL's mailbox indefinitely | |
| `AuditLog` | IDs, hashes, counts; no utterances | No | Retention-sweep audit rows expire at 365 days; others vary | |
| Application logs | No `console.*` calls in grok/callReview/callControl/crm/email paths; framework request logs carry URL paths and IDs, not bodies | No | Host log retention (Railway/Vercel) | Not exhaustively verified on hosted platforms |
| xAI | Caller audio streamed after consent; xAI generates the transcription | Yes (provider side) | **Unknown**; xAI's API data-retention terms apply | Must be confirmed before real callers |
| Telnyx | Call signaling, media streaming, keypad detection | No transcript; recording is off | Telnyx call-detail retention; media is not stored when recording is off, per Telnyx documentation (unverified here) | |
| Neon backups | Whole database | Yes, until aged out | PITR history is currently 6 h. Proposed 30-day logical backups would retain purged transcripts up to 30 more days | `docs/database/architecture.md` |

**Proposed hosted purge path (no ADR-0064 bypass):** a separately approved ADR that keeps preview-then-apply, but lets a scoped job apply **only** the `pilot_transcripts` and webhook-payload sweeps for the pilot account in the hosted environment.

- **Schedule:** daily, from a dedicated runner with a least-privilege role allowed to touch only those tables.
- **Monitoring:** each run writes its audit row and posts its counts to the operator channel.
- **Failure alert:** an alert fires if no successful run is seen in 26 hours, or if any turn is older than `expires_at` + 24 h.
- **Deletion verification:** a weekly check that counts rows past expiry across `GrokTranscriptTurn`, `Call.transcript` and `CallReview.evidence_json.transcript` (expected 0), plus a sample check that backups older than the backup window are gone.

Not built; needs your decision.

## 4. Consent and script (exact text for approval)

Carrier-side, Telnyx basic female voice, before any AI. Played as one message:

> Thank you for calling Florida Ramp and Lift! I'm Sam, the virtual assistant. A team member supervises these calls and reviews every request before anyone follows up. To stop at any time, just hang up. **[tenant `policy.consent.aiDisclosure`]** To continue, press 1. To decline, press 2.

Then the keypad prompt: "Press 1 to continue, or press 2 to decline." It waits 10 seconds, one digit, one try.

- **Fallback disclosure (needs your attention):** if the tenant snapshot has no `aiDisclosure`, the code falls back to "This call is being handled by an automated assistant. This call may be transcribed. **I can connect you with a person at any time.**" The pilot cannot transfer calls, so the FRL snapshot **must** carry an approved disclosure without that promise. Proposed: "This call is answered by an automated assistant and is transcribed so our team can follow up."
- **Press 2:** the call moves to refused, and the operator acknowledges. The carrier says the configured refusal line (default "No problem. I won't collect any more details.") and hangs up. Nothing reaches xAI.
- **No answer or invalid key:** the carrier says "I did not receive clear permission, so I will not collect any details. Please contact the team directly for help." and hangs up.
- **Press 1:** the capture waits for the operator, who watches `/admin/demo-operations`, records **grant** with disclosure, evidence and jurisdiction references, then starts Sam. Only then does audio go to xAI and transcription begin.
- **Withdraw:** the operator presses withdraw or End Grok call. Admission closes, the AI side stops, and a carrier hangup is queued.

**Sam's first line after consent:** "Wonderful, thank you! How can I help you today—are you exploring a ramp or lift, or asking about service or repair?" Full script: `SAM_PILOT_INSTRUCTIONS` in `lib/grok/samProfile.ts`.

**Email.** Subject: `FRL CALLBACK REQUIRED — {caller} — {product or interaction} — {location}`. First line: "Supervised FRL pilot — live caller, operator-reviewed intake." It then lists the caller, callback number, interaction, product, location, qualification, outcome, urgency, callback window, summary, next action, review flags and the ResponseOS call reference, and ends: "CRM delivery status is tracked in ResponseOS; this message does not certify CRM synchronization."

**Correction to my earlier claim that "nothing is saved before consent":** that is not accurate as stated.

- **Before press 1 / grant:** caller and dialled numbers, timestamps and keypad digits are stored, as raw carrier webhooks plus `Call` and `Contact` rows. That happens for every call, including declined ones. Telnyx processes call audio carrier-side to play prompts and detect keys, as any phone carrier does.
- **After grant only:** audio is sent to xAI, xAI transcribes it, and ResponseOS persists transcript turns. What xAI retains is governed by xAI's terms (unknown here).

**When the caller says "stop":**

- Sam is instructed to stop talking at once, and the operator sees "stop" in the live transcript (2-second refresh).
- A spoken stop is **not** an enforced withdrawal. Transcript capture continues until the operator acts.
- If the operator misses it, the call continues until the caller hangs up or the 5-minute cap ends it. Everything said until then is stored and appears in the review draft.
- **Gap and proposal (not built):** an automatic stop. A caller turn matching a narrow stop/withdraw phrase list would trigger the same path as an operator withdrawal: admission closes, the AI stops, the carrier speaks a fixed confirmation and hangs up. The operator gets an alert. Missing the cue would then cost seconds, not the rest of the call. Needs your decision; false positives would end calls early.

## 5. Call limits and failure behaviour

| Limit | Demo qualification (before) | Pilot (as committed now) |
|---|---|---|
| Max call (`maxDurationMs`, DB CHECK) | ≤ 5 min | ≤ 5 min. The earlier 15-minute change was **reverted pending your decision** |
| Authority contract validity | ≤ 1 h | ≤ 1 h |
| Concurrent calls | 1 | 1 |
| Media authority staleness (local gate) | 3 s | 3 s |
| Session lease | 15 s, renewed by heartbeat | same |

How each stop path ends things:

| Trigger | AI side (xAI) | Carrier leg (Telnyx) | Caller hears |
|---|---|---|---|
| Timeout (deadline) | Heartbeat fails → bridge closes the xAI socket, session stopped, `xai_hangup` queued and sent | `telnyx_hangup` queued and sent; the watchdog re-drives a queued command | Nothing; abrupt hangup |
| Operator End call | Session stopped, `xai_hangup` sent | Exact-call Telnyx hangup reserved and sent under the capture lock | Nothing; abrupt hangup |
| Watchdog or readiness loss | Same as timeout, within the 3 s threshold | Same, if the app can still reach Telnyx | Nothing; abrupt hangup |
| Caller hangs up | Carrier stream stops → bridge stops | Already gone | — |

In every case, command acceptance and socket closure are **not** disconnection proof. Carrier disconnection counts as confirmed only from a fresh, authenticated exact-call `call.hangup` webhook (`call_disconnected_at`). The console shows "unconfirmed" until then.

**Your objection stands, and nothing here closes it.** Proposed before any customer traffic (not built):

1. **Planned stops speak first.** On timeout, operator End call or withdrawal, the carrier plays a fixed prerecorded line before hanging up: "I need to end this call now. A Florida Ramp and Lift team member has your number and will follow up." This needs carrier-side `speak`-then-hangup, independent of xAI.
2. **Unplanned loss (watchdog).** The AI stops immediately (unchanged). The carrier plays a different fixed line only where that path is independently verified safe: "We're having a technical problem. Please hold for a team member" if a human line is configured, otherwise "Please call back at [number]". No AI reconnection.
3. **Human fallback.** A separately authorized warm transfer to an FRL staff line during coverage hours. Transfer is disabled today.
4. **A warning before the cap.** At T−60 s the carrier says "We have about a minute left." Then Sam's closing.
5. **Coverage.** Pilot windows only when an operator and a named backup are present. Outside them the number routes to FRL's existing line or voicemail, not to Sam, with an owner-set maximum reaction time for stop requests.

## 6. Test evidence

Final candidate **`f0beeddf95751f670a7c83a3c9e39ed5e3a28162`** (pilot commits `c0fc7b1`, `7ed1ad8`, `f0beedd` on `31a58bd`).

Linux run: Docker `node:24.18.0-bookworm` (Node 24.18.0, npm 11.16.0, as in CI) plus `postgres:16`, x86_64. Built from `git archive` of the exact SHA, copied into the container's filesystem. Archive SHA-256 `3bdf4e1b147cf219851dafb64b7880570f0ddc4bcf3ea8ae32f81e72cd0e1c18`, identical on host and container. The kernel is Docker Desktop's WSL2 VM, not Railway's runtime.

| Gate | Result |
|---|---|
| `npm ci` | pass |
| lint | pass |
| typecheck | pass |
| unit (no DB env, as CI `validate`) | **1,282 / 1,282 passed**, 91 files |
| build | pass |
| `prisma migrate diff` (migrations ↔ schema) | no drift |
| `prisma migrate deploy` (all migrations incl. 0029) + seed | pass |
| integration (Postgres 16 on loopback) | **666 / 666 passed**, 33 files |
| `seed-determinism` (1 test) | **not run**. It calls `prisma migrate reset`, which Prisma's AI-agent guard blocks without your explicit consent. Excluded, not bypassed. CI runs it |

Harness corrections along the way, none affecting the code under test:
- Git Bash path rewriting broke the first run.
- Unit tests with a database URL set produced 3 false failures. CI's validate job has no database.
- Reaching the database by hostname tripped 9 loopback-only safety tests.

All are fixed in the harness, and the final run above is a single clean run on one SHA.

Not proven by these tests:
- Real HubSpot and Resend delivery. Mocks prove the sequence and idempotence, not that anything arrives.
- xAI's transcript event format. It needs a separately approved internal rehearsal.
- Telnyx carrier behaviour, hosted timing, and the hosted purge.

## 7. Deployment proposal (pilot-specific; not executed)

- **Artifacts:** the app built from the pilot PR's head SHA, packaged in the container filesystem with `npm ci --ignore-scripts` (Linux/glibc), hashes recorded on both sides. The control branch is pinned to the same SHA. A separate Railway service for the pilot: **the existing soft-demo agent, service and number are not touched.**
- **Migration:** apply 0029 to the pilot database only, after a branch/backup snapshot. It is additive: one new column with a default, one new table, three CHECKs. Existing rows default to `qualification` and satisfy the CHECK. Rollback: the app tolerates the extra column and table, so roll the app back first. Drop the table and column only with an owner decision, since that deletes transcripts.
- **Tenant/number:** create the FRL `customer` account, the `SUPERVISED_PILOT` profile and an approved snapshot (with the pilot disclosure, recipient and refusal line). Assign a **dedicated pilot number** as `active`. Do not reuse the demo number. Telnyx routes that number's Call Control webhooks to the pilot service.
- **Credentials (least privilege):**
  - HubSpot: a private app scoped to contacts, calls and tasks (read/write) on the FRL portal only. Verify `/account-info` matches the FRL portal ID before enabling.
  - Resend: a sending-only key restricted to the verified sender domain.
  - xAI: a project key for the pilot project.
  - Telnyx: a key scoped to the pilot connection where Telnyx supports it.
  - All installed by the owner via Doppler; their hashes go in the contract.
- **Recipient verification:** send one test message to the configured recipient and have Mike confirm receipt before the first rehearsal dispatch. The recipient is read from the frozen snapshot, never typed per call.
- **Rollback / kill switch:** set `RESPONSEOS_PILOT_ACTIVATION` to anything else, or let the hourly contract expire; new calls then fail closed. Re-point the number to FRL's line in Telnyx. Turn off `RESPONSEOS_LIVE_*` to block dispatch.
- **Cost limits:** one concurrent call and a 5-minute cap; xAI project and Telnyx account spend alerts set by the owner; a daily call-count ceiling (proposed: 20) checked at admission (not built).
- **Stop conditions:** any transcript stored before grant or after withdrawal; any unconfirmed disconnection after End call; a HubSpot write to the wrong portal; a duplicate email; an unexplained cutoff of a caller; a missed purge run. Any one halts the pilot until reviewed.

## 8. Consolidated approval request

Approve or decline each separately. Nothing below has been done.

1. **Independent review** of the pilot commits (`31a58bd..f0beedd`) by Codex or a person, plus a review of the 29 successor commits on their own PR.
2. **Publishing for review:** push `work/frl-vercel-authority-files-20261020` and `feat/frl-live-supervised-pilot-20261021`, and open two stacked draft PRs (successor → `accepted/grok-qualification-app-20261020`, pilot → successor). No PR against `master`.
3. **Decisions needed before any rehearsal:**
   - a. The FRL disclosure text, without "connect you with a person". Proposed text in §4.
   - b. Pilot greeting and script wording (§4, `lib/grok/samProfile.ts`).
   - c. Keep the 5-minute cap, or approve a longer one.
   - d. The hosted purge path design (§3), as its own ADR. It is not built, and until it exists 30-day deletion is not enforced.
   - e. Retention for the caller data that never expires today: carrier webhook bodies, the `Contact`/`Call` number, and the review payload.
   - f. Whether to build the automatic spoken-stop withdrawal (§4).
   - g. The caller-messaging fallbacks for planned and unplanned stops (§5, items 1–4).
4. **Build follow-ups** if you approve 3d–3g, plus open findings M3, m1 and m9 and the pilot path in the commissioning tooling. Same review cycle.
5. **Internal rehearsal window, only after 1–4 and the deployment proposal (§7):** you present and dialling; a dedicated pilot number; HubSpot pointed at a sandbox or test portal; email to your own address, not Mike's; each call confirmed disconnected (authenticated hangup in the console) before the next. Stop on any §7 stop condition.

**Not requested and not approved:** public callers, a Mike or client test window, the outbound agent, any change to the hosted soft-demo agent or number, credentials, hosted migration, number routing.

## 9. Railway status (checked 2026-10-21, 20:00 and 21:05 UTC)

Still a **major outage** at the 21:01 UTC update: builds paused, API and dashboard affected, no estimate for builds. Running compute, deployments and networking show no reported impact. Our services' own health could not be checked: there is no Railway CLI here, the Railway API is down, and the repo records no hosted URL. Do not plan any deploy, including rollback, through Railway until the incident closes.
