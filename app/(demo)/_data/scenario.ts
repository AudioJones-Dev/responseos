/**
 * In-app demo data for the clickable demo walkthrough.
 *
 * DEMO-ONLY, mock data. Mirrors the approved demo-content assets in
 * `docs/product/demo-assets/*` (Maria Santos / DemoLift accessibility scenario)
 * WITHOUT importing them — the docs assets stay the spec source-of-truth. This
 * file is now the no-database fallback for the persisted sandbox walkthrough.
 * No real customer/PII data or provider calls. Money is in whole USD.
 */

export const DEMO_ONLY = true as const;

export const business = {
  id: "demo_account_demolift",
  name: "DemoLift Accessibility Services",
  vertical: "Home services — accessibility / mobility equipment",
  region: "Pembroke Pines, FL",
} as const;

export const overview = {
  period: "This month",
  revenueProtected: 0,
  revenueProtectedDelta: "Static illustrative scenario — not measured",
  recoveredCalls: 0,
  qualifiedLeads: 1,
  appointments: 1,
  followUpsDue: 1,
  missedCallRecoveryRate: 0,
  atRiskCount: 0,
} as const;

export const founderBriefing = {
  whatChanged:
    "One fictional high-intent call is represented in this static fallback.",
  revenueProtectedLine: "$1,500–$4,500 illustrative opportunity; no verified or recovered revenue.",
  topNextAction: "Review the fictional assessment record; do not contact a real person.",
  points: [
    "After-hours demand — historically the most-leaked window for service businesses.",
    "Time-sensitive + safety-critical; the follow-up queue has it flagged urgent.",
    "No other unresolved opportunities are aging in this window.",
  ],
} as const;

export type TranscriptLine = { t: string; speaker: "AI" | "Caller"; text: string };

export const call = {
  id: "demo_call_8F3K29",
  channel: "Static simulated inbound voice · no live provider",
  startedAt: "2026-05-31 21:47 (local)",
  duration: "2m 38s",
  disposition: "Qualified — urgent on-site assessment requested",
  urgency: "high" as const,
  revenueRange: { min: 1500, max: 4500 },
  caller: "Maria Santos",
  consent: { sms: true, call: true },
  qualificationScore: 88,
  intent: "Urgent on-site assessment",
  serviceRequested: "Wheelchair ramp — repair / replacement (safety)",
  appointmentStatus: "Seeded fixture — no calendar write",
  summary:
    "After-hours, high-intent caller needs an urgent wheelchair-ramp safety assessment for her father in Pembroke Pines within 48 hours. Decision-maker confirmed; call + SMS consent granted.",
  nextAction: {
    label: "Call back to confirm urgent assessment window",
    owner: "On-call accessibility specialist",
    dueAt: "by 9:00 AM tomorrow",
  },
  crmSyncStatus: "Not synced — static fallback",
  memoryStatus: "Static fallback only",
  transcript: [
    { t: "00:00", speaker: "AI", text: "Thank you for calling DemoLift Accessibility Services — this is the after-hours line. I can help you get an urgent accessibility issue handled. May I ask what's going on?" },
    { t: "00:07", speaker: "Caller", text: "My father just came home from the hospital today and he's in a wheelchair now. The ramp at his front door isn't safe — too steep, and one side is loose. We can't get him in and out." },
    { t: "00:21", speaker: "AI", text: "I'm sorry to hear that, and I understand how urgent this is. I can get this in front of our team right away and arrange an assessment. Can I start with your name?" },
    { t: "00:34", speaker: "Caller", text: "Maria Santos. It's for my father's home." },
    { t: "00:52", speaker: "Caller", text: "Pembroke Pines." },
    { t: "01:06", speaker: "Caller", text: "I think it might need to be replaced — it's old. But honestly I just need someone to look at it fast and make it safe." },
    { t: "01:24", speaker: "Caller", text: "As soon as possible. Definitely within the next day or two." },
    { t: "01:54", speaker: "AI", text: "Is it okay if we call and text you at this number with the appointment confirmation and any updates?" },
    { t: "01:59", speaker: "Caller", text: "Yes, that's fine." },
    { t: "02:03", speaker: "AI", text: "To confirm: an urgent wheelchair-ramp assessment at a home in Pembroke Pines, within 48 hours, and you're approved to call and text for confirmation. Our specialist will reach out shortly to lock in the time. Take care." },
  ] satisfies TranscriptLine[],
} as const;

export const lead = {
  id: "demo_lead_a1b2c3",
  name: "Maria Santos",
  region: "Pembroke Pines, FL",
  serviceCategory: "Wheelchair ramp",
  workType: "Repair / replacement",
  estimatedValue: { min: 1500, max: 4500 },
  qualificationScore: 88,
  qualificationBand: "Qualified",
  urgency: "high" as const,
  dealStage: "Seeded qualification fixture",
  hubspotDealId: "No live HubSpot record",
  crmSyncStatus: "Not synced",
  followUpOwner: "On-call accessibility specialist",
  appointmentIntent: "Urgent on-site assessment",
  sourceAttribution: "Static fictional fallback",
  relatedCallId: call.id,
  relatedMemoryId: "bm_evt_demo_77c310",
} as const;

export const memory = {
  id: "bm_evt_demo_77c310",
  capturedAt: "2026-05-31 21:49 (local)",
  model: "Static fallback — no persisted event-ledger read",
  sourceEvent: { type: "call.qualified", callId: call.id, channel: call.channel },
  entities: [
    { label: "Contact", value: "Maria Santos" },
    { label: "Household", value: "Santos residence (demo placeholder)" },
    { label: "Business", value: business.name },
  ],
  summary: "Urgent after-hours wheelchair-ramp safety assessment requested.",
  operationalContext:
    "Safety-critical: caller's father just discharged from hospital; ramp unsafe. Route to nearest accessibility crew; confirm same-day or next-morning window.",
  commercialContext: "Estimated opportunity $1,500–$4,500 · CRM: HubSpot.",
  nextActions: [
    { label: "Callback to confirm assessment window", owner: "On-call accessibility specialist", dueAt: "by 9:00 AM tomorrow" },
  ],
  trail: [
    { t: "21:47", event: "Static call displayed", detail: "Fictional fallback; no provider event." },
    { t: "21:49", event: "Seeded qualification displayed", detail: "Illustrative score 88; no runtime model execution." },
    { t: "21:50", event: "Fallback disclosure", detail: "No database or live provider data is represented." },
  ],
  // Phase-1 gates — these MUST render as disabled/not-active (ADR-0034).
  gates: {
    rag_enabled: false,
    vector_memory_enabled: false,
    per_tenant_knowledge_enabled: false,
  },
} as const;

export const followUps = [
  {
    id: "demo_task_22087",
    lead: "Maria Santos",
    reason: "Confirm urgent ramp assessment window",
    urgency: "high" as const,
    dueAt: "by 9:00 AM tomorrow",
    owner: "On-call accessibility specialist",
    estimatedValue: { min: 1500, max: 4500 },
    crmStatus: "Synced",
    suggestedAction: "Call (consent on file) to lock same-day / next-morning window",
    riskIfIgnored: "Lost service/install job; safety-critical caller likely to call a competitor.",
  },
] as const;

export type IntegrationState = "synced" | "mock" | "disabled" | "captured";

export const integrations: { name: string; state: IntegrationState; detail: string }[] = [
  { name: "HubSpot CRM sync", state: "mock", detail: "Mock sync — contact / activity / deal / task created in the demo (no live HubSpot)." },
  { name: "Telephony event delivery", state: "mock", detail: "Mock inbound event (no live Telnyx/Twilio in the demo)." },
  { name: "Calendar / scheduling", state: "disabled", detail: "Placeholder — not connected in the demo." },
  { name: "Business Memory capture", state: "captured", detail: "Phase-1 event-ledger capture active (mock data)." },
  { name: "Event bus", state: "mock", detail: "Mock event relay (no live providers)." },
];

// Ordered walkthrough steps for the stepper navigation.
export const steps = [
  { slug: "", label: "Overview", href: "/demo/walkthrough" },
  { slug: "operator-console", label: "Operator", href: "/demo/operator-console" },
  { slug: "client-dashboard", label: "Client", href: "/demo/client-dashboard" },
  { slug: "call", label: "Call", href: "/demo/walkthrough/call" },
  { slug: "lead", label: "Lead", href: "/demo/walkthrough/lead" },
  { slug: "memory", label: "Memory", href: "/demo/walkthrough/memory" },
  { slug: "follow-up", label: "Follow-up", href: "/demo/walkthrough/follow-up" },
  { slug: "integrations", label: "Integrations", href: "/demo/walkthrough/integrations" },
] as const;

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const usdRange = (r: { min: number; max: number }) => `${usd(r.min)}–${usd(r.max)}`;
