# ResponseOS Demo Assets

These assets provide mock content for the first ResponseOS demo flow.
They are documentation/mock-data only and are not used by the production app.

The assets model the full revenue recovery loop:

1. After-hours inbound call
2. AI receptionist qualification
3. Transcript and structured summary
4. HubSpot commercial sync
5. Phase-1 Business Memory event-ledger capture
6. Founder Intelligence summary

Source context: [`../responseos-demo-narrative-and-asset-plan.md`](../responseos-demo-narrative-and-asset-plan.md)
(scenes + screens) and [`../responseos-communications-stack.md`](../responseos-communications-stack.md)
(Telnyx/Vapi/HubSpot canon). Anchor scenario: a **South Florida accessibility / mobility equipment
service business** (ramp, lift, and accessibility equipment contractor) receiving a **high-intent,
after-hours** call.

## Files

| File | Purpose |
|---|---|
| [`demo-call-script.md`](./demo-call-script.md) | Script for the simulated AI receptionist call |
| [`mock-transcript.md`](./mock-transcript.md) | Demo transcript for the Call Intelligence screen |
| [`lead-qualification-output.json`](./lead-qualification-output.json) | Structured lead qualification payload |
| [`business-memory-event.json`](./business-memory-event.json) | Phase-1 Business Memory event-ledger payload |
| [`hubspot-sync-event.json`](./hubspot-sync-event.json) | Mock HubSpot sync payload |
| [`founder-intelligence-summary.md`](./founder-intelligence-summary.md) | Founder-facing daily insight summary |

## ⚠️ Non-production warning

> These files contain **mock data only**. They must **not** be treated as production seed data,
> customer records, or provider integration fixtures. All names, numbers, addresses, and IDs are
> fictional demo-safe placeholders — no real customer/PII data. Every JSON payload carries
> `"demo_only": true`.

## Canon notes

- **Vendors are invisible infrastructure** in client-facing narrative; provider names (Telnyx, Vapi,
  HubSpot) appear here only in the technical mock payloads, not as the product story.
- **Phase-1 Business Memory = event-ledger capture, not RAG/vector** (ADR-0034). The Business Memory
  payload carries explicit `gates` showing RAG / vector / per-tenant-knowledge are **disabled**. These
  assets do not imply any v0.4 knowledge feature is active.
- **Brand 2.0** (Signal-Yellow + Syne + true-black/glass) governs how screens fed by these assets look
  (ADR-0021) — these are the *content*, not the UI.
