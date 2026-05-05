# Automation Flows

The seven flows below are the v0.1/v0.2 RECOVER playbooks, mapped to the canonical RECOVER stages (Respond → Evaluate → Capture → Offer → Verify → Escalate → Report). Each flow names a trigger, the actions in order, and the resulting state transition. v0.1 ships with mock provider adapters; v0.3 wires real Twilio/Retell/Stripe/GHL calls.

| # | Flow | RECOVER stage(s) |
|---|---|---|
| 1 | Missed Call Recovery | Respond + Capture |
| 2 | AI Inbound Answering | Respond + Evaluate |
| 3 | Quote Request | Capture + Offer |
| 4 | Booking | Verify |
| 5 | Outbound Recovery Campaign | Escalate + Report |
| 6 | Human Escalation | Escalate |
| 7 | Monthly ROI Reporting | Report |


## 1. Missed Call Recovery

**Trigger:** Twilio voice webhook reports inbound call with `status=missed` (or after-hours/no-answer outcome).

**Actions:**
1. Emit `missed_call` event into the ledger; create `Call` (status `missed`) and `LeadEvent` (event_type `missed_call`).
2. Wait 15–60 seconds (configurable per tenant).
3. Send missed-call SMS via Twilio with intent options ("schedule", "quote", "callback").
4. If no reply within the retry window, queue a follow-up SMS and create a task for the office.
5. If customer replies, run AI SMS qualification → either generate self-schedule link, collect quote fields, or open a callback queue. Update `LeadEvent.status` accordingly.

**Outcome:** Recovered conversation logged with attribution back to the original missed call.

## 2. AI Inbound Answering (Respond + Evaluate)

**Trigger:** Twilio voice webhook for an inbound call routed to a Retell/Vapi agent.

**Actions:**
1. Lookup tenant, route, business hours, caller history. Reject obvious spam (high `spam_score`).
2. Create provisional `Contact` (or match existing) and `Call` (status `answered`).
3. Connect call to Retell agent via SIP/Twilio handoff.
4. Agent greets and discloses (recording + AI disclosure per state).
5. Agent qualifies: service type, location, urgency, budget, decision-maker.
6. Run `leadQualificationScore` on extracted facts; persist `LeadQualification`.
7. If high-value or edge case → warm-transfer or create escalation task.
8. If routine → complete call with SMS recap and self-schedule link.
9. Persist transcript via Retell `call-ended` webhook; extract entities; update CRM connector.

**Outcome:** A scored, captured lead with a transcript, ready to convert.

## 3. Quote Request Flow (Capture + Offer)

**Trigger:** A qualified `LeadEvent` arrives with intent to quote (from inbound AI call, web form, or SMS).

**Actions:**
1. Run pricing rules + service-package engine (per-tenant config).
2. Generate `QuoteRequest` (header) with line items.
3. Deliver quote by SMS / email / link (Resend + Twilio).
4. If no approval, run reminder cadence + optional outbound AI follow-up.
5. On approval, offer deposit or financing (Stripe).
6. If payment captured or terms accepted, advance to scheduling.
7. If no payment, save pending payment intent and notify office.
8. Update `LeadEvent.status` → `quoted` → `won` once accepted.

**Outcome:** Quote sent, accepted, optionally pre-paid; `quotes_sent` and `jobs_won` increment for the period.

## 4. Booking Flow (Verify)

**Trigger:** A qualified lead reaches the booking step (from quote acceptance, AI call self-schedule, or operator action).

**Actions:**
1. Compute allowed slots from tenant service hours, blocked windows, and current calendar load.
2. Read provider availability (Google `freeBusy` or Cal.com).
3. Present slot options (SMS link, web widget, or live during call).
4. Customer selects slot → create `Booking` (status `scheduled`).
5. Sync to calendar provider via `POST /api/bookings/sync/google` or `/calcom`; capture `external_event_id`.
6. Send confirmation SMS + email.
7. Schedule reminder cadence (24h, 2h pre-appointment).
8. On day-of, mark `confirmed`; after visit, mark `completed` or `no_show`.

**Outcome:** A confirmed appointment with full reminder sequence; no-show rate measurable per tenant.

## 5. Outbound Recovery Campaign (Escalate + Report)

**Trigger:** A `LeadEvent` has gone stale (`follow_up_needed` for >N days, or scheduled outbound campaign).

**Actions:**
1. Build the recovery list: stale leads scoped to one tenant, segmented by service type / urgency / value.
2. Validate consent + jurisdiction rules per tenant.
3. Dispatch outbound AI calls (Retell/Vapi) or SMS sequences via Twilio.
4. Capture the response: pickup / voicemail / SMS reply / opt-out.
5. Re-qualify replies; route hot responses to live operators or self-schedule.
6. Update `LeadEvent.recovered_value` for jobs that close from this campaign.
7. Generate per-campaign report — calls placed, contacts reached, leads recovered, revenue attributed — and append to `RevenueMetrics`.

**Outcome:** Stale demand reactivated; verified recovered revenue traceable to the campaign.

---

## 6. Human Escalation (Escalate)

**Trigger:** A `LeadEvent` matches an escalation rule — high estimated value, edge-case service request, regulated context (e.g. medical), repeated AI failure, or explicit customer ask for a human.

**Actions:**
1. Detect the trigger in real time during a call (Retell/Vapi tool-call) or post-event from a `LeadEvent` evaluator.
2. Mark `LeadEvent.event_type = follow_up_needed` and increment urgency.
3. Choose route: warm transfer (during live call) or notification + task (asynchronous).
4. Warm transfer path: Twilio dial-out to on-call operator; bridge call; record handoff context (transcript so far, qualification snapshot).
5. Async path: dispatch high-priority `Notification` (Slack to ops, SMS to operator on-call, email summary) with deep-link to the lead event.
6. Open an escalation task with SLA timer; persist `escalation_reason`, `escalated_by` (system or user), `routed_to`.
7. On resolution, close the task with outcome (resolved / customer_unreachable / converted / declined) and write back to the lead event.
8. QA tag the call: escalations are sampled at a higher rate than baseline calls in the weekly review.

**Outcome:** No edge case sits in an AI loop; high-value or compliance-sensitive leads get a human within the SLA.

## 7. Monthly ROI Reporting (Report)

**Trigger:** Scheduled job at end-of-month (per tenant timezone) plus on-demand "generate now" via admin UI.

**Actions:**
1. Aggregate the period's events into per-tenant `RevenueMetrics` — total_calls, missed_calls, qualified_leads, appointments_booked, quotes_sent, jobs_won, estimated_recovered_revenue, verified_recovered_revenue, response_time_avg_seconds, admin_hours_saved.
2. Compute `roi_multiple` via `lib/revenue/calculateRoiMultiple.ts` (recovered revenue / monthly system cost; null when cost is zero).
3. Apply attribution rules: only count outcomes where the lead path traces back to a ResponseOS-handled event.
4. Render the report in three formats: client portal page, PDF export, email summary.
5. Push to client portal at `/client/revenue` and `/client/reports`; queue email for `client_admin` recipients.
6. Update `usage_meters` (v0.2) for the billing period.
7. If outcome-fee contract is active: calculate performance fee on **verified** outcomes only; draft an invoice with evidence links (call IDs, booking IDs, payment IDs); finance review before send.
8. Archive the period's report alongside the immutable event ledger so the numbers are reproducible on audit.

**Outcome:** A shippable monthly proof artifact tying recovered revenue to specific captured events — the foundation of outcome-based pricing.

---

## Cross-cutting

Every flow:
- Lands raw vendor traffic in the event ledger first (v0.2 `events` table).
- Validates webhook signatures (Twilio / Retell / Stripe / GHL) before mutating business objects.
- Increments `RevenueMetrics` counters at the appropriate stage so weekly reports stay accurate.
- Respects tenant compliance mode: in HIPAA-ready mode, transcripts are PII-scrubbed before storage and recordings have short retention.

## Weekly ROI report job

A scheduled job aggregates the period's events into per-tenant `RevenueMetrics`, produces a PDF/dashboard, pushes it to the client portal, updates usage meters, and (if outcome-fee contract is active) drafts an invoice with evidence links.
