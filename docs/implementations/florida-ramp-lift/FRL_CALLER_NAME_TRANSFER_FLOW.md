# FRL — Caller greeting, consent, name, transfer and transcript

**Status:** MOCK_ONLY / NOT LIVE. Feature-branch implementation target, subject to reviewed legal copy and explicit live-integration approval. No carrier routing or Telnyx configuration changes.
**Architecture:** Draft PR #240. **Implementation:** draft PR #241.

## Required call experience

1. Inbound call reaches the separately authorized Telnyx number and remains outside recording, transcription, streaming and agent listening.
2. Play: **"Thank you for calling Florida Ramp & Lift."**
3. Continue with a counsel-approved notice, currently proposed for mock only: **"With your permission, this call will be recorded and transcribed to document your request and coordinate follow-up. Press 1 to agree, or press 2 to continue without recording or transcription."**
4. Record the DTMF *consent choice*, without a recording/transcript of pre-consent speech. Check independently established founder consent. In the initial design, no reply, failure, or ambiguous reply means **not consented**.
5. If both parties consent, request **"Thank you. May I have your first and last name, please?"** Enable *minimal approved speech capture* only in the consented interval, transcribe the caller's spoken response, and normalize the name as a **caller-supplied unverified label**. Do not overwrite CRM legal name or auto-merge records without independent identity checks.
6. If the caller supplies no name or name recognition fails, proceed with transfer anyway. No fabricated name. The caller should not be trapped in a repeated name loop.
7. Say **"Thank you. Please hold while I connect your call."** Initiate Telnyx bridge/transfer to a **separate founder endpoint** so the mobile-line forwarding does not loop.
8. Continue authorized capture after the legs connect; associate transcript segments with time, call ID, call-leg identity, speaker uncertainty, disclosure and consent events. Only after validated evidence and contact resolution may a governed HubSpot activity and memory proposal be created.
9. If the caller declines or consent times out, say **"No problem. We will connect you without recording or transcription. Please hold."** Transfer without name capture, recording, STT or transcript-derived CRM/memory. The founder can ask their name manually on the live call.
10. If an approved participant revokes, issue stop-capture commands and verify acknowledgments; later conversation content must not be processed. Authorized earlier content is subject to reviewed retention/deletion policy.

## Handoff data contract (proposal)

```json
{
  "call_id": "synthetic-call-id",
  "caller_display_name": "Example Caller",
  "caller_name_verified": false,
  "consent": {
    "status": "accepted",
    "disclosure_version": "approved-version-required",
    "participants": ["caller", "founder"]
  },
  "transfer": {
    "requested": true,
    "destination_ref": "protected-founder-endpoint"
  },
  "transcript_capture": "consented_only",
  "crm_sync": "proposed_pending_validation"
}
```

In a declined call, `caller_display_name` must be null unless independently sourced from permitted CRM metadata; `transcript_capture` must be disabled; no AI-derived call summary is produced. Routing metadata may be retained only under the approved policy.

## Implementation seam and hard blockers

- Mock implementation: `lib/communications/consent/mock-intake.ts`, using `MockConsentCall` and pure consent transition contracts. Tests: `tests/unit/frl-intake-flow-mock.test.ts`.
- **These tests do not exercise live Telnyx text-to-speech, DTMF, STT, bridge, two-leg capture or persistent state.** Provider acknowledgments and race windows remain unimplemented.
- **Existing `app/api/webhooks/telnyx/calls/route.ts` currently records a verified webhook payload and `lib/providers/telnyx/normalize.ts` can persist transcript, insights and contact data without an FRL call-specific consent gate.** It must not be used for the founder main line until the guard exists **before raw-content persistence and downstream normalization**. Signed provider provenance is not consent.
- Approved disclosure and handling of interstate/multi-party calls, founder endpoint and mobile forwarding mode, verified caller ID, private tenant/account mapping, duration/retention, security boundaries, and manual transfer fallback must be resolved.
- Only scoped approved API/CRM authority permits HubSpot logging. Never auto-write an unverified spoken name into an authoritative contact field.
- No FRL phone number or real caller name is embedded in source, docs, fixtures, logs, or tests.

## Required validation before live usage

Mock test matrix: accept/accept, caller refusal, timeout, missing name, post-accept revocation, premature transcript blocked, no provider side effects.

Revocation during consent or name collection requests the no-capture transfer instead of leaving the caller waiting at an unusable prompt. Revocation during transfer or after connection preserves that stage and does not request a second transfer. Regression tests cover both participants and repeated revocation; capture cannot restart on the same mock call. This is a synchronous in-memory simulation, not evidence of a provider stop acknowledgment. Previously accepted synthetic content remains in memory; no retention policy is implemented by this fix.
Additional future integration tests: first audio capture event must follow validated full consent; consent for both bridged legs; no audio recording or STT for decline; name recognizer cannot run before consent; no transcript on rejection; masked logs; no forwarding loop; transfer on STT failure; duplicate/out-of-order events; failed recording stop; separate founder consent; caller-ID and contact resolution; CRM writes require proven source.

## 2026-11-06 mock completion audit

Inspected architecture PR #240 at `bfe950c35b95c29822f923df51a23f1e670d2251` and implementation PR #241 at `9e6af57c6f9c2acc8ce0dd75cec3f9804848847d`. Both were drafts with successful validation and PostgreSQL 16/17/18 integration checks; Vercel status was pending and CodeRabbit review skipped. The architecture proposal remains unratified. Implementation is based on current `master` `6f579cc4bca303c195a2f9ba833a3b389f52d850`, with no schema changes; migrations remain `0001` through `0013`. The unrelated occupied checkout was preserved.

Reused the existing consent transition contract, mock capture facade, greeting/name/transfer flow, and their tests. The increment fixes only early revocation trapping callers and adds eight regression cases. No runtime webhook, CRM, provider, schema, outbound dialer or memory implementation changes.

Local validation: four new regression cases failed before the fix; afterward lint, typecheck, all 779 unit tests across 64 files, and the mock build passed. Local Node/npm were 24.21.0/11.19.0 versus repository pins 24.18.0/11.16.0; CI uses the pinned Node version. Local PostgreSQL integration execution is blocked by the unresolved host Docker hold and absence of an assigned synthetic database. CI results for the final commit must be checked separately; prior-head CI is not evidence for the fix.

| Acceptance area | Evidence and remaining boundary |
| --- | --- |
| Two-party consent, refusal, timeout, skipped name, revocation | Mock unit coverage only; no audio or call control |
| Duplicate consent decision | Existing mock test; webhook persistence dedupe is a separate existing seam |
| Invalid webhook signature | Existing route verifies before ledger writes; this change adds no signed-ingest behavior |
| Delayed transcript / consent interval | Unimplemented: mock segments are untimed strings and check current consent only |
| Additional participants / call legs | Unimplemented: mock permits exactly founder and caller roles |
| Transfer failure / emergency fallback | Unimplemented: mock connection is synchronous; fallback and loop prevention need approved endpoints and tests |
| CRM ambiguity | Existing finalized-call sync marks multiple matches review_required; FRL mock is not connected to CRM |
| Missing credentials | Mock flow uses no credentials or provider commands |
| Cross-tenant rejection | No tenant-aware persistence in this mock; existing tenant controls do not prove future FRL leg mapping |

The existing HubSpot finalized-call sync already supplies account-scoped operation claims, phone/verified-email lookup, ambiguous-match review, evidence references and retry handling. Reuse that seam after consent and identity authority are established; the mock caller name is never sent to it. No claim of completed FRL CRM sync or business-memory retrieval is supported.

Before a separately approved test-number call: implement the FRL consent barrier before raw payload persistence and normalization; bind tenant, call and participant legs to auditable consent intervals; verify current Telnyx command capabilities and capture start/stop acknowledgments; reject late/out-of-scope content; test invalid signatures, duplicates, tenant spoofing, added participants and failed stops. Current provider command capabilities were not verified in this mock-only increment.

Production additionally requires approved legal disclosure, founder consent and retention/revocation policy; verified carrier forwarding mode and a distinct founder endpoint; caller-ID, voicemail, failure and rollback tests; explicit v0.3/provider, CRM-write, routing and deployment authorizations; reviewed mappings and field authority; monitoring, spending limits and a cutover owner. Outbound calling needs an authenticated controlled dialer and verified caller ID. Knowledge retrieval requires separate v0.4+ approval. No main-line routing, carrier changes, email access/sends or production activation occurred.
