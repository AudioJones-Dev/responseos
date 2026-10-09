import "@/lib/serverOnlyGuard"
import { createHash } from "node:crypto"
import { z } from "zod"
import { sanitizeCrmText } from "@/lib/crm/sanitization"

export const pathways = ["residential", "builder", "architect", "commercial", "repair", "equipment_acquisition"] as const
const reference = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_.:-]+$/)
const text = z.string().max(2000)
export const inquirySchema = z.object({
  inquiryId: z.uuid(), accountId: reference, sourceEventId: reference,
  pathway: z.enum(pathways), sourceChannel: z.enum(["form", "call", "email"]),
  occurredAt: z.iso.datetime(), nextActionAt: z.iso.datetime(),
  contact: z.object({ email: z.email().transform(v => v.trim().toLowerCase()).optional(), phone: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(), firstName: text, lastName: text.optional(), preferredMethod: z.enum(["email", "phone"]).optional() }).strict(),
  company: z.object({ id: z.string().regex(/^\d+$/), verified: z.literal(true) }).strict().optional(),
  qualification: z.enum(["qualified", "pending", "review_required", "unqualified"]),
  qualificationReason: text.min(1),
  disposition: z.enum(["continue", "manual_review", "declined", "referral"]),
  decisionReference: reference, service: z.enum(["platform_lift", "stair_lift", "ramp", "vehicle_lift", "ceiling_lift", "undecided"]),
  jobType: z.enum(["sales_installation", "installation", "planning", "repair", "acquisition"]),
  city: text.min(1), zip: z.string().max(12).optional(), manufacturer: text.optional(), model: text.optional(),
  urgency: z.enum(["routine", "time_sensitive", "equipment_unavailable", "unknown"]),
  contactPermission: z.boolean(), paymentArrangement: z.enum(["self_pay", "third_party", "unknown"]), vetaccessRequest: z.boolean(),
  summary: text, nextAction: text.min(1),
  source: z.object({ page: text.optional(), landingPage: text.optional(), referrerHost: text.optional(), utmSource: text.optional(), utmMedium: text.optional(), utmCampaign: text.optional(), utmTerm: text.optional(), utmContent: text.optional() }).strict(),
  acquisition: z.object({ finalDecision: z.enum(["pending", "accept_candidate", "decline"]), operatorReference: reference.optional(), sellerAuthorityConfirmed: z.boolean(), equipmentCategory: z.enum(["stair_lift", "platform_lift", "modular_ramp", "other"]) }).strict().optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.contact.email && !value.contact.phone) ctx.addIssue({ code: "custom", message: "identity_required", path: ["contact"] })
  if ((value.pathway === "repair") !== (value.jobType === "repair")) ctx.addIssue({ code: "custom", message: "repair_precedence" })
  if ((value.pathway === "equipment_acquisition") !== (value.jobType === "acquisition")) ctx.addIssue({ code: "custom", message: "acquisition_job_mismatch" })
  if ((value.pathway === "equipment_acquisition") !== Boolean(value.acquisition)) ctx.addIssue({ code: "custom", message: "acquisition_context_required" })
  if (value.qualification === "qualified" && value.disposition !== "continue") ctx.addIssue({ code: "custom", message: "qualification_disposition_conflict" })
  if (value.qualification === "qualified" && value.acquisition && (value.acquisition.finalDecision !== "accept_candidate" || !value.acquisition.operatorReference || !value.acquisition.sellerAuthorityConfirmed)) ctx.addIssue({ code: "custom", message: "acquisition_operator_acceptance_required" })
})
export type Inquiry = z.infer<typeof inquirySchema>
export type ObjectType = "contacts" | "companies" | "deals" | "tickets" | "notes" | "tasks"
export type Properties = Record<string, string>
export type CrmObject = { id: string; properties: Properties }
export type PortalMapping = {
  environment?: "test" | "preview"
  accountId: string; portalId: string; primaryOwnerId: string; backupOwnerId: string | null
  sales: { pipelineId: string; stageId: string }
  repair: { pipelineId: string; stageId: string }
  acquisition: { pipelineId: string; stageId: string; offerExpiredStageId: string } | null
}
export type Plan = { mode: "dry-run"; accountId: string; portalId: string; key: string; fingerprint: string; inquiry: Inquiry; primaryOwnerId: string; backupOwnerId: string; objectType: "deals" | "tickets" | null; properties: Properties; task: Properties; note: Properties; notificationEligible: false }
export type ExistingPlanTest = Omit<Plan, "mode"> & { mode: "existing-plan-test" }

const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex")
const richText = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;")
function safePath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return ""
  return value.split(/[?#]/)[0].replace(/[^/a-zA-Z0-9_-]/g, "").slice(0,200)
}
function attribution(input: Inquiry["source"]): Properties {
  const out: Properties = {}
  const names = { page: "source_page", landingPage: "landing_page", referrerHost: "referrer_host", utmSource: "utm_source", utmMedium: "utm_medium", utmCampaign: "utm_campaign", utmTerm: "utm_term", utmContent: "utm_content" }
  for (const [key, value] of Object.entries(input)) {
    if (!value) continue
    const name = names[key as keyof typeof names]
    const clean = key === "page" || key === "landingPage" ? safePath(value) : key === "referrerHost" ? (/^[a-z0-9.-]+$/i.test(value) ? value.toLowerCase() : "") : (/^[a-zA-Z0-9 _-]{1,100}$/.test(value) ? value : "")
    if (clean && sanitizeCrmText(clean) === clean) out[`frl_${name}`] = clean
  }
  return out
}

export function planInquiry(raw: unknown, mapping: PortalMapping): Plan {
  const inquiry = inquirySchema.parse(raw)
  if (inquiry.accountId !== mapping.accountId) throw new Error("tenant_mismatch")
  if (!/^\d+$/.test(mapping.portalId) || !/^\d+$/.test(mapping.primaryOwnerId) || !mapping.backupOwnerId || !/^\d+$/.test(mapping.backupOwnerId) || mapping.primaryOwnerId === mapping.backupOwnerId) throw new Error("owner_mapping_incomplete")
  const acquisition = inquiry.pathway === "equipment_acquisition"
  const repair = inquiry.pathway === "repair"
  const qualified = inquiry.qualification === "qualified" && inquiry.disposition === "continue"
  const objectType: Plan["objectType"] = repair ? "tickets" : acquisition || qualified ? "deals" : null
  const route = repair ? mapping.repair : acquisition ? mapping.acquisition : mapping.sales
  if (objectType && (!route?.pipelineId || !route.stageId || (acquisition && !mapping.acquisition?.offerExpiredStageId))) throw new Error("pipeline_mapping_incomplete")
  if (acquisition && mapping.acquisition?.pipelineId === mapping.sales.pipelineId) throw new Error("acquisition_pipeline_must_be_separate")
  const key = `frl:${digest([mapping.accountId, mapping.environment ?? "test", inquiry.inquiryId])}`
  const summary = sanitizeCrmText(inquiry.summary)
  const nextAction = sanitizeCrmText(inquiry.nextAction)
  const properties: Properties = {
    frl_inquiry_id: key, frl_tenant_reference: mapping.accountId, frl_source_event_id: inquiry.sourceEventId,
    frl_correlation_id: inquiry.inquiryId, frl_last_event_id: inquiry.sourceEventId,
    frl_pathway: inquiry.pathway, frl_source_channel: inquiry.sourceChannel,
    frl_service: inquiry.service, frl_job_type: inquiry.jobType, frl_site_city: sanitizeCrmText(inquiry.city),
    frl_urgency: inquiry.urgency, frl_priority: "normal", frl_qualification_status: inquiry.qualification,
    frl_disposition: inquiry.disposition, frl_decision_reference: inquiry.decisionReference,
    frl_qualification_reason: sanitizeCrmText(inquiry.qualificationReason), frl_project_details: summary, frl_next_action: nextAction, frl_next_action_at: inquiry.nextActionAt,
    frl_contact_permission: String(inquiry.contactPermission), frl_payment_arrangement: inquiry.paymentArrangement,
    frl_vetaccess_request: String(inquiry.vetaccessRequest),
    hubspot_owner_id: mapping.primaryOwnerId, frl_backup_owner_id: mapping.backupOwnerId,
    frl_notification_state: "not_requested", ...attribution(inquiry.source),
  }
  if (inquiry.zip) properties.frl_site_zip = inquiry.zip
  if (inquiry.manufacturer) properties.frl_manufacturer = sanitizeCrmText(inquiry.manufacturer)
  if (inquiry.model) properties.frl_model = sanitizeCrmText(inquiry.model)
  if (objectType === "tickets") Object.assign(properties, { subject: key, hs_pipeline: route!.pipelineId, hs_pipeline_stage: route!.stageId })
  if (objectType === "deals") Object.assign(properties, { dealname: key, pipeline: route!.pipelineId, dealstage: route!.stageId })
  if (inquiry.acquisition) Object.assign(properties, { frl_program_type: "equipment_acquisition", frl_financial_direction: "frl_pays_seller", frl_final_operator_decision: inquiry.acquisition.finalDecision, frl_seller_authority_confirmed: String(inquiry.acquisition.sellerAuthorityConfirmed), frl_equipment_category: inquiry.acquisition.equipmentCategory, ...(inquiry.acquisition.operatorReference ? { frl_operator_reference: inquiry.acquisition.operatorReference } : {}) })
  const plan = { mode: "dry-run" as const, accountId: mapping.accountId, portalId: mapping.portalId, key, inquiry, primaryOwnerId: mapping.primaryOwnerId, backupOwnerId: mapping.backupOwnerId, objectType, properties,
    task: { hs_task_subject: key, hs_task_body: richText(`${summary}\nNext action: ${nextAction}`), hs_task_status: "NOT_STARTED", hs_task_priority: "NORMAL", hs_timestamp: inquiry.nextActionAt, hubspot_owner_id: mapping.primaryOwnerId },
    note: { hs_note_body: richText(`${key}\n${summary}\nQualification: ${inquiry.qualification}\nDisposition: ${inquiry.disposition}\nDecision: ${inquiry.decisionReference}`), hs_timestamp: inquiry.occurredAt }, notificationEligible: false as const }
  return { ...plan, fingerprint: digest(plan) }
}
