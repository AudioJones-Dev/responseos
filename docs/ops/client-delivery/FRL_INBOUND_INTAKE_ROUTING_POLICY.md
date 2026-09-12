# Florida Ramp & Lift — Inbound Intake & Routing Policy

**Status:** `DOCUMENTED_ONLY`. Nothing in this document is built. It describes the intended
behaviour of the FRL supervised-pilot receptionist so that schemas, call state, CRM mapping, and
test fixtures can be designed against one source instead of placeholders.
**Owner:** AJ Digital LLC / Audio Jones
**Applies to:** the Florida Ramp & Lift tenant only, in `SUPERVISED_PILOT`.
**Governing decisions:** ADR-0051 and its 2026-09-10 / 2026-09-11 amendments; ADR-0048;
[`RESPONSEOS_CLIENT_OPERATING_CONFIGURATION_STANDARD.md`](./RESPONSEOS_CLIENT_OPERATING_CONFIGURATION_STANDARD.md)
(the "configuration standard" below).

Status tokens are the doctrine §2.1 vocabulary.

---

## 1. What this document is, and what it is not

It **is** the approved description of how an FRL inbound call should be screened, qualified, and
routed, plus the vocabulary — fact keys, qualification outcomes, escalation states — that the
implementation should use.

It is **not**:

- an authorisation to activate anything. Readiness is not activation (configuration standard §5).
- a source of operating configuration. No fact in §3 is created by this file. Facts enter through
  the operating-configuration write path, which is `ROADMAP` (configuration standard §7).
- a statement of law. See §9.
- approved caller-facing copy. See §13.

### Provenance

The behavioural content originates in an operator-supplied intake specification dated 2026-09-12.
That specification's regulatory citations were retrieved by a third-party assistant and are **not
independently verified**; they are deliberately not carried into this document as facts (§9). Where
it conflicts with a decision already recorded in this repository, the recorded decision governs and
the conflict is registered in §14.

---

## 2. The routing spine

Every inbound call resolves four questions, in order. The agent asks the fewest questions needed to
reach the next correct business action — a GC with drawings does not get a homeowner script, and a
returning service caller does not get a sales qualification interview.

```
WHO IS CALLING?        → identity, and whether the record is confirmed
NEW OR EXISTING?       → CRM relationship resolved before any history is discussed
WHY ARE THEY CALLING?  → interaction type
WHAT PRODUCT?          → product path, or "needs consultation"
```

Then:

```
Inbound call
  → identity resolution (§4)
  → caller role          : owner | builder_gc | commercial | other
  → interaction type     : new_sales | existing_customer_new_sale | new_service
                         | existing_service | project_coordination | administrative
  → product path         : vpl | vehicle_lift | ceiling_lift | ramp | unknown (§5–§8)
  → qualification
  → compliance / feasibility screen (§9)
  → outcome (§10)
```

---

## 3. Approved operating facts

These are the values the operator has supplied for FRL. They are recorded here as **keys and
shapes**, not values, because several are client operational data. Values enter through the write
path and live on the tenant's `BusinessMemorySnapshot`; they must not be written into source,
tests, seeds, PR bodies, or the dashboard.

| Fact key | Content | Value recorded here? |
|---|---|---|
| `operating_hours.weekly` | Inbound answering is 24/7 | Yes — 24/7 |
| `operating_hours.holidays` | Holiday handling | Yes — 24/7, no holiday closure |
| `service_area.coverage` | South and Central Florida. **No county or ZIP inference** — the agent must not derive coverage from a city name | Yes, as stated |
| `contact.escalation.primary` | Named human escalation target, name + phone | **No — client operational data** |
| `notification.completed_interaction.recipient` | Callback / completed-interaction notification mailbox | **No — client operational data** |
| `quote.photo_submission.email` | Photo intake mailbox (temporary) | **No — client operational data** |
| `policy.consent` | Recording and disclosure posture | Shape open (§13) |

### Distinctions that are load-bearing

- **24/7 answering is not 24/7 human availability.** The agent answers at any hour. A live transfer
  is attempted only when the escalation workflow determines the target is available; otherwise the
  call resolves to a callback (§11).
- **Phone-number recognition is not identity confirmation.** See §4.
- Service area is stated at the region level. Narrowing it to an approved county/ZIP territory is an
  open item (§15).

### Products

Four product paths, each with its own qualification tree: **vertical platform lift**, **vehicle
lift**, **ceiling lift**, **ramp**. "Vehicle lift" means mobility-device lifts for scooters and
power wheelchairs, not automotive service lifts.

---

## 4. Identity resolution and the disclosure gate

On every inbound call the caller's number is normalised and the CRM is queried.

**Unknown number.** Treat as a prospective new contact and collect: first and last name, callback
number, email, project or service address, city, ZIP, caller role, and company where applicable.
Create or reconcile the CRM contact.

**Recognised number.** A phone match retrieves the record but **does not authorise disclosure of
customer history**. Before the agent discusses a previous installation, service event, or open deal,
it requires:

> phone match **and** caller confirms name **and** caller confirms service/property address or ZIP.

This separates *record matched* from *identity sufficiently confirmed*. Only after confirmation may
the agent read back bounded context: existing contact, associated company, previous product or
install, open deal, open service ticket, recent relevant interaction, scheduled appointment,
assigned owner.

An unconfirmed caller on a recognised number is handled as a new caller for disclosure purposes,
while still being reconciled to the existing record on the write side.

---

## 5. Vertical platform lift

**Usage** — residence or commercial/public property; who will use it; wheelchair, power chair,
scooter, or standing passenger; approximate combined user + device weight if known.

**Site** — indoor or outdoor; what area needs connecting; approximate steps or feet of vertical
travel; one upper landing or multiple stops; garage, porch, deck, interior floor, commercial
entrance.

**Dimensions** — approximate vertical rise; approximate available footprint; door and gate
locations; landing size; entry/exit orientation. The agent translates rather than assuming
vocabulary: ask *"would you enter and exit on the same side, opposite sides, or around a corner?"*,
not "straight-through or 90-degree exit".

**Infrastructure** — concrete slab or pad present; nearby electrical service; weather exposure;
existing lift being replaced.

**Documentation** — photos; plans or drawings; GC or architect involved; permit application
underway.

**Outcome.** The agent does not determine final model compatibility. It determines *potential VPL
project → site evaluation required*.

---

## 6. Vehicle lift

**Vehicle** — year, make, model, body type; existing trailer hitch; hitch class if known.

**Mobility device** — scooter, power chair, or manual chair; manufacturer; model; approximate
weight; width; length or wheelbase.

**Use case** — does the person remain seated in the device during loading, or is only the device
transported; interior or exterior/hitch-mounted; does the user operate the equipment independently;
is a caregiver available.

**Outcome.** The agent may say *"we can check compatibility."* It must **not** say *"that lift will
fit your vehicle."* Compatibility against manufacturer specifications is a human product-selection
gate, and the call resolves to `PRODUCT_COMPATIBILITY_REVIEW` when compatibility is the open
question.

---

## 7. Ceiling lift

Ceiling lifts need a transfer-path and structural assessment, not a weight question.

**User and use** — residential, commercial, or care facility; approximate user weight;
caregiver-assisted or independent. Collect the functional need only; **do not solicit diagnosis or
other unnecessary medical detail**.

**Transfer path** — *"where does the person need to move from and to?"* — bed → wheelchair, bed →
bathroom, bed → shower, chair → toilet, or multiple rooms.

**Coverage** — single transfer point, straight-line track, multiple locations, whole-room, or
multiple rooms.

**Environment** — ceiling height; ceiling type if known; access above; exposed beam, drywall, or
concrete; room dimensions; doorway or header between rooms; photos.

**Equipment** — fixed or portable motor preference; sling selected; therapist/OT recommendation
available; existing lift or track.

**Outcome.** Always *qualified for assessment — structural and track-layout review required*. The
agent never declares a ceiling structurally adequate.

---

## 8. Ramp

**Location** — residential or commercial; permanent, modular, or temporary; which entrance;
interior or exterior.

**Accessibility problem** — number of steps; approximate total vertical rise; doorway threshold;
wheelchair, scooter, or walker.

**Site** — available straight-line distance; pathway width; upper landing or porch dimensions;
lower landing area; surface (concrete, asphalt, soil, pavers, deck); turns or obstacles; door swing;
drainage.

**Photos requested** — straight-on entrance; side view; approach path; top landing and door; wide
shot showing available space.

**Commercial additions** — part of an accessible route; public accommodation; plans available;
architect or GC involved; existing accessibility complaint.

**Outcome.** The agent may observe that space *may* be constrained and that the evaluation will
settle it:

> "Based on the height you described, the ramp may need more space than you have available. A site
> evaluation will determine whether a ramp or a platform lift is the better fit."

It does not certify compliance or state a required slope, width, or landing dimension (§9).

---

## 9. Compliance screening — behavioural rules only

This section deliberately encodes **agent behaviour**, not legal thresholds.

The originating specification cited Florida Chapter 399, an ASME platform-lift standard, contracted
elevator jurisdictions, ADA ramp geometry, FMVSS occupant-lift requirements, and Florida two-party
recording consent. Those citations are unverified third-party lookups. Writing them into this
document would make them repository facts and would create claims the platform cannot support
(doctrine §20). They are therefore **out of scope here** and must not be embedded in prompts,
schemas, or agent copy. Any jurisdictional rule the product needs must be sourced, approved, and
recorded through the normal evidence path before use.

What the agent does instead:

1. **Classify property type** — private single-family residence, versus commercial / public /
   multi-user. The classification routes the call; it does not resolve the requirement.
2. **Never state that a permit is not required.** Never state that one is. The approved response is
   that requirements depend on the property and the jurisdiction and the team confirms them during
   the evaluation.
3. **Never declare code compliance, engineering feasibility, structural adequacy, or final product
   compatibility** over the phone.
4. Where the caller raises a permitting, inspection, or regulatory question beyond the approved
   script, the call resolves to `PERMIT_COMPLIANCE_REVIEW` and escalates (§11).

Approved phrasing for (2):

> "Permit and inspection requirements depend on the property and the jurisdiction. Our team will
> confirm those requirements as part of the evaluation."

---

## 10. Qualification outcomes

Every inbound interaction terminates in exactly one canonical outcome. This replaces a
qualified/not-qualified boolean.

| Outcome | Meaning |
|---|---|
| `QUALIFIED_FREE_EVALUATION` | Fits an evaluation; schedule or hand off |
| `QUALIFIED_QUOTE_REVIEW` | Enough detail for a quote to be prepared |
| `BUILDER_GC_PROJECT_REVIEW` | Live project or bid; estimator path |
| `COMMERCIAL_PROJECT_REVIEW` | Commercial/facility procurement path |
| `EXISTING_CUSTOMER_SERVICE` | Service event on an existing relationship |
| `EXISTING_PROJECT_FOLLOW_UP` | Coordination on an in-flight project |
| `HUMAN_REVIEW_REQUIRED` | Agent confidence below threshold, or explicit request |
| `OUTSIDE_APPROVED_SERVICE_AREA` | Outside approved coverage |
| `PRODUCT_COMPATIBILITY_REVIEW` | Blocked on manufacturer compatibility |
| `PERMIT_COMPLIANCE_REVIEW` | Blocked on jurisdictional requirements |
| `UNSUPPORTED_REQUEST` | Out of scope for FRL |

---

## 11. Escalation and callback

Escalate to the configured `contact.escalation.primary` when: the caller asks for a human; pricing
authority is needed; a builder/GC has an active project or bid; a commercial project is high value;
technical feasibility is uncertain; a safety-sensitive issue is raised; there is a complaint or an
existing installation failure; a regulatory question exceeds the script; an install or project issue
is urgent; or agent confidence is below the approved threshold.

**Live transfer** is attempted once. The agent does **not** retry a transfer repeatedly.

**On unavailable or failed transfer:**

1. Offer a callback.
2. Collect the preferred callback window.
3. Create the CRM follow-up task.
4. Persist the escalation in the ResponseOS ledger.
5. Send the completed-interaction notification (§12).

---

## 12. Notification

Recipient is `notification.completed_interaction.recipient`. Delivery is operational, never
marketing, and **a failed notification must never fail the call**.

Subject shape:

```
FRL CALLBACK REQUIRED — {Caller Name} — {Product or Reason} — {City}
```

Body carries: caller name and contact details, caller type, customer status (new/existing),
location, product or service, interaction type, qualification outcome, urgency, preferred callback
window, a short project summary, the compliance/review flags raised, the agent outcome, a concise
conversation summary, a reference to the ResponseOS transcript, and the CRM reference.

The body carries **no unnecessary sensitive detail** — no medical detail beyond the functional need,
and no transcript inline where a reference will do.

---

## 13. Recording and consent — `DOCUMENTED_ONLY`, draft copy

**Recording is off, and this document does not turn it on.** ADR-0051 keeps recording `false` at
every supervision tier and states that no ratified decision authorises it. No amendment changing
that is present in [`../../DECISIONS.md`](../../DECISIONS.md); the only ADR-0051 amendment on record
is dated 2026-09-10 and concerns fact authority.

The operator decided on 2026-09-11 that recording should become tenant-configurable, defaulting to
`false`, with FRL `true` by explicit configuration and authorisation. **That decision is not yet
ratified.** Ratifying it as an ADR amendment is a prerequisite (G-11), not a description of current
state. Until it lands, an FRL call is not recorded, and the disclosure must match the posture the
tenant actually resolves to — not the posture this section anticipates.

The following greeting is a **draft for the owner**, not approved copy. Caller-facing wording is the
owner's to set, and it must be reviewed for legal sufficiency before any real call is recorded.

> *Draft.* "Thanks for calling Florida Ramp & Lift. I'm Sam, the virtual assistant. I can help with
> an evaluation, a quote request, a service question, or an existing project. This call may be
> recorded and transcribed so our team can assist you. Do I have your permission to continue?"

**On refusal**, the agent disables recording and transcription where technically supported, or
routes to an approved human/manual path. It does not proceed to record silently.

Two gaps are recorded in the in-flight closure change: recording begins at answer, before the
disclosure; and stopping an in-progress recording on refusal is not implemented. **Together these
make the refusal path above unenforceable.** Approving the wording (G-4) does not make it safe —
a call recorded under that wording would still violate the refusal rule, because the runtime cannot
honour a refusal it has already recorded past. G-12 tracks that separately for exactly this reason.

---

## 14. Conflicts with recorded decisions

Registered, not resolved. Each needs an operator decision.

| # | Conflict | Recorded position governs |
|---|---|---|
| C-1 | The source specification spells the notification mailbox local-part differently from the address recorded twice in the operator's own 2026-09-11 decisions. A wrong address loses every notification. | The 2026-09-11 recorded address is the default. **Operator to confirm the spelling before any live send.** |
| C-2 | The source specification creates HubSpot **Notes** and **Tickets**, and Deals/Companies across three role paths. The binding closure scope is contact + call activity with an enriched `hs_call_body`, a HIGH follow-up task, and **explicitly no Note**. | Closure scope governs. The broader CRM projection is `ROADMAP` (§15) and must not enter the in-flight closure change. |
| C-3 | The source specification lists operating hours and geography as unresolved. They are already decided: 24/7 including holidays; South and Central Florida with no county inference. | The recorded decisions govern. |

---

## 15. Activation gates — open items

None of these blocks schema or state-machine design. Each blocks activation of the behaviour that
depends on it.

| # | Open item | Blocks |
|---|---|---|
| G-1 | Approved installation territory by county/ZIP | `OUTSIDE_APPROVED_SERVICE_AREA` |
| G-2 | Escalation-target live-transfer availability windows | §11 transfer attempt |
| G-3 | Callback SLA | §11 task due date |
| G-4 | Final recording and AI-disclosure wording | §13, any live call |
| G-11 | A ratified ADR amendment making recording tenant-configurable. ADR-0051 currently keeps it `false` at every tier | Any FRL recording at all — this gate precedes G-4 and G-12 |
| G-12 | Disclosure before audio capture begins, **or** verified stop-on-refusal in the runtime | Recording on a call where the caller may refuse. Independent of G-4: approved wording does not make an unenforceable refusal path safe |
| G-5 | CRM pipeline names and stages | §16 projection |
| G-6 | Qualification confidence thresholds | `HUMAN_REVIEW_REQUIRED` |
| G-7 | Whether evaluation is phone, video, or on-site, per product | `QUALIFIED_FREE_EVALUATION` |
| G-8 | Photo/image upload mechanism | §5–§8 documentation intake |
| G-9 | Manufacturer product-compatibility rules | `PRODUCT_COMPATIBILITY_REVIEW` |
| G-10 | Notification mailbox spelling (C-1) | §12 live send |

---

## 16. CRM projection — scope split

**In the supervised-pilot closure scope:** contact create/reconcile; call activity with a structured
summary block in `hs_call_body`; a HIGH-priority follow-up task on escalation. No Note.

**`ROADMAP`, post-closure:** Company association for builder/GC and commercial callers; Deal
creation once a qualification threshold is met; Ticket creation and update for service events;
role-specific project fields; the existing-customer branches that route to a new Deal rather than a
new Contact.

ResponseOS remains the detailed evidence layer; the CRM receives the operational projection.

---

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-09-12 | Initial policy, from the operator-supplied intake specification of the same date | Claude Opus 5, for Audio |
