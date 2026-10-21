# FRL live supervised pilot — operator runbook (ADR-0082)

Status: repository implementation, in review. Not deployed, not commissioned, no real call taken. This runbook lists what has to happen before Sam answers a real Florida Ramp & Lift caller, and how each pilot call is run.

## What a pilot call does

1. A caller dials the routed FRL number. If an in-force `carrier-pilot` contract names the tenant and its `active` assignment, the call is admitted as a pilot capture.
2. The carrier plays Sam's pilot greeting, then the standard AI/transcription disclosure, then "press 1 to continue, press 2 to decline". Declining or no clear answer ends the call with nothing captured.
3. On press 1 the operator records the witnessed **grant** in `/admin/demo-operations` and starts Sam. Only then does audio reach xAI.
4. Sam collects the caller's details. The operator watches the live transcript on the capture card. **On any stop request, end the call immediately.** A spoken stop does not end it by itself.
5. When the call ends, a review draft appears with the transcript and the caller's number. If it doesn't, press **Draft review from transcript**.
6. The operator corrects the structured fields (name, callback, product, city, outcome, next action), approves, then dispatches. Dispatch writes the HubSpot contact, call and task, then emails the FRL recipient. Email status "accepted" means Resend accepted it, not that it reached the inbox.

## Before the first real call

- [ ] Owner review and merge of this change. Independent review must come from someone other than the builder.
- [ ] Apply migration 0029 to the hosted database.
- [ ] FRL tenant: a `customer` account, an enabled supervised profile resolving to `SUPERVISED_PILOT`, an approved operating snapshot with `notification.completed_interaction.recipient` set to the FRL team address, and an `active` assignment for the routed number.
- [ ] Environment, owner-installed: `RESPONSEOS_PILOT_ACTIVATION=ENABLED`, `RESPONSEOS_LIVE_HUBSPOT_ENABLED=true` with the HubSpot private-app token, `RESPONSEOS_LIVE_EMAIL_ENABLED=true` with the Resend key and sender, `RESPONSEOS_AUTHORIZED_EXECUTION_GATES` including the live-communications gate, and `RESPONSEOS_REQUIRE_AUTH=true`.
- [ ] Knowledge packet with `agentProfile: "frl-sam-ara-pilot-v1"` and the seven approved facts, plus a signed `carrier-pilot` contract (`crm`/`email`/`transcript` true, `transcriptRetentionDays: 30`, `maxDurationMs` ≤ 900000). Both expire within one hour, so re-issue them per operating session.
- [ ] Commissioning tooling: `validate-qualification-env` and `qualification-deployment` still assume effects-off and need a pilot path, or a manual checklist the owner accepts.
- [ ] Owner sign-off on the pilot greeting and script (`lib/grok/samProfile.ts`).
- [ ] Retention: decide how `npm run retention:purge -- --apply` runs against the hosted database. ADR-0064 refuses `NODE_ENV=production`. Transcripts must be purged by day 30.
- [ ] Two internal rehearsals on the pilot authority. For each, confirm: caller and Sam turns appear live (this is the first check of xAI's transcript events), withdrawal stops capture, the draft review appears after hangup, the HubSpot records land in the right portal, and the email arrives.

## Known limitations

- If supervision or watchdog proof is lost, the call is cut off without warning (owner decision 2026-10-20). Disclose this, and follow up manually with any caller who was cut off.
- No recording, transfer, booking, SMS or outbound calling.
- One call at a time, and only while an operator holds a fresh contract.
- ResponseOS is not HIPAA-certified. The script avoids health details, but callers may volunteer them, so treat transcripts accordingly.
