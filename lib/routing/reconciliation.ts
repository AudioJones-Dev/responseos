import "@/lib/serverOnlyGuard";
import { createHash } from "node:crypto";
import { inquirySchema } from "./frlPlan";
import { providerConfigurationHash, routeInquiry } from "./frlManifest";
import type { Delivery } from "./ledger";
import type { HubspotRoutingAdapter } from "./hubspotAdapter";
import { resolveCompanyBinding, type CompanyBinding } from "./companyPolicy";

/** Read-only proof preparation. Never settles a receipt or authorizes a resend. */
export async function inspectUncertainHubspotDelivery(delivery: Delivery, adapter: HubspotRoutingAdapter, companyBindings: CompanyBinding[] = []) {
  if (delivery.mode !== "hubspot" || delivery.status !== "uncertain" || !["test", "preview"].includes(delivery.environment)) throw new Error("reconciliation_scope_refused");
  const inquiry = inquirySchema.parse(delivery.request_json.inquiry);
  if (inquiry.accountId !== delivery.account_id || delivery.checkpoint_json.manifestHash !== providerConfigurationHash ||
      createHash("sha256").update(JSON.stringify({schemaVersion: 1, inquiry})).digest("hex") !== delivery.payload_hash) throw new Error("reconciliation_integrity_refused");
  const plan = routeInquiry(inquiry, delivery.environment as "test" | "preview");
  if (delivery.checkpoint_json.planFingerprint !== plan.fingerprint) throw new Error("reconciliation_plan_refused");
  try {
    const contactId = await adapter.findContact(inquiry);
    if (!contactId || delivery.checkpoint_json.contactId && contactId !== delivery.checkpoint_json.contactId) return {status: "inconclusive" as const, code: "contact_proof_missing"};
    // Contact-only work lacks an immutable inquiry marker and cannot prove creation.
    if (!plan.objectType) return {status: "inconclusive" as const, code: "contact_only_requires_review"};
    const inquiryId = await adapter.findInquiry(plan);
    if (!inquiryId || delivery.checkpoint_json.inquiryId && inquiryId !== delivery.checkpoint_json.inquiryId ||
        !await adapter.verifyAssociation(plan, inquiryId, contactId)) return {status: "inconclusive" as const, code: "inquiry_or_association_proof_missing"};
    const company = resolveCompanyBinding(inquiry, delivery.environment, plan.portalId, companyBindings);
    if (company && (!await adapter.readCompany(company.companyId) || !await adapter.verifyObjectAssociation("contacts", contactId, "companies", company.companyId) || !await adapter.verifyObjectAssociation(plan.objectType, inquiryId, "companies", company.companyId))) return {status: "inconclusive" as const, code: "company_proof_missing"};
    for (const type of ["notes", "tasks"] as const) {
      const activityId = await adapter.findActivity(plan, type);
      const expected = delivery.checkpoint_json[type === "notes" ? "noteId" : "taskId"];
      if (!activityId || expected && expected !== activityId || !await adapter.verifyActivity(plan, type, activityId) ||
          !await adapter.verifyObjectAssociation(type, activityId, "contacts", contactId) || !await adapter.verifyObjectAssociation(type, activityId, plan.objectType, inquiryId) ||
          company && !await adapter.verifyObjectAssociation(type, activityId, "companies", company.companyId)) return {status: "inconclusive" as const, code: "activity_proof_missing"};
    }
    return {status: "ready_for_human_review" as const, portalId: plan.portalId, contactId, inquiryId, objectType: plan.objectType, manifestHash: providerConfigurationHash};
  } catch { return {status: "inconclusive" as const, code: "provider_proof_unavailable"}; }
}
