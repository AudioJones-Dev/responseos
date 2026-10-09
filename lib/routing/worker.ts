import "@/lib/serverOnlyGuard";
import type { PrismaClient } from "@prisma/client";
import { providerConfigurationHash, routeInquiry } from "./frlManifest";
import { createHash } from "node:crypto";
import { z } from "zod";
import { claimDelivery, saveCheckpoint, settleDelivery, type Checkpoint, type Delivery } from "./ledger";
import { ProviderFailure, type RoutingProvider } from "./provider";
import { inquirySchema } from "./frlPlan";

export async function executeClaim(db: PrismaClient, delivery: Delivery, provider: RoutingProvider) {
  if (provider.mode !== delivery.mode || provider.mode !== "simulated") throw new Error("live_execution_disabled");
  if (!["test", "preview"].includes(delivery.environment)) throw new Error("environment_invalid");
  const checked = z.object({planFingerprint: z.string().regex(/^[a-f0-9]{64}$/), manifestHash: z.string().regex(/^[a-f0-9]{64}$/), contactId: z.string().regex(/^\d+$/).optional(), inquiryId: z.string().regex(/^\d+$/).optional(), associated: z.boolean().optional(), reviewRequired: z.boolean().optional(), inFlight: z.enum(["contact", "inquiry", "association"]).optional()}).strict().safeParse(delivery.checkpoint_json);
  if (!checked.success || checked.data.manifestHash !== providerConfigurationHash) return settleDelivery(db, delivery, "uncertain", "checkpoint_or_manifest_invalid");
  // PostgreSQL jsonb does not preserve object-key order; reparse to canonical schema order.
  const canonical = {schemaVersion: 1, inquiry: inquirySchema.parse(delivery.request_json.inquiry)};
  if (createHash("sha256").update(JSON.stringify(canonical)).digest("hex") !== delivery.payload_hash) return settleDelivery(db, delivery, "uncertain", "payload_integrity_failed");
  const plan = routeInquiry(delivery.request_json.inquiry, delivery.environment as "test" | "preview");
  if (checked.data.planFingerprint !== plan.fingerprint) return settleDelivery(db, delivery, "uncertain", "routing_plan_changed");
  if (plan.accountId !== delivery.account_id) throw new Error("tenant_mismatch");
  let checkpoint: Checkpoint = { ...checked.data };
  if (checkpoint.inFlight) return settleDelivery(db, delivery, "uncertain", "unresolved_checkpoint");
  const save = async (next: Checkpoint) => { await saveCheckpoint(db, delivery, next); checkpoint = next; };
  try {
    if (!checkpoint.contactId) {
      const match = await provider.findContact(plan.inquiry);
      if (match) await save({ ...checkpoint, contactId: match });
      else {
        if (!plan.inquiry.contact.email) throw new ProviderFailure("new_contact_requires_email_review", "rejected");
        await save({ ...checkpoint, inFlight: "contact" });
        const contactId = await provider.createContact(plan.inquiry);
        await save({ ...checkpoint, contactId, inFlight: undefined });
      }
    }
    if (plan.objectType) {
      if (!checkpoint.inquiryId) {
        const match = await provider.findInquiry(plan);
        if (match) await save({ ...checkpoint, inquiryId: match });
        else {
          await save({ ...checkpoint, inFlight: "inquiry" });
          const inquiryId = await provider.createInquiry(plan);
          await save({ ...checkpoint, inquiryId, inFlight: undefined });
        }
      }
      if (!checkpoint.associated) {
        await save({ ...checkpoint, inFlight: "association" });
        await provider.associate(plan, checkpoint.inquiryId!, checkpoint.contactId!);
        try {
          if (!await provider.verifyAssociation(plan, checkpoint.inquiryId!, checkpoint.contactId!)) throw new Error("association_missing");
        } catch { throw new ProviderFailure("association_readback_failed", "uncertain"); }
        await save({ ...checkpoint, associated: true, inFlight: undefined });
      }
    }
    if (!plan.objectType) await save({...checkpoint, reviewRequired: true});
    return await settleDelivery(db, delivery, "confirmed", plan.objectType ? "simulated_delivery_confirmed" : "operator_review_required");
  } catch (error) {
    const failure = error instanceof ProviderFailure ? error : new ProviderFailure(checkpoint.inFlight ? "external_operation_uncertain" : "read_or_checkpoint_failed", checkpoint.inFlight ? "uncertain" : "retry");
    if (failure.disposition !== "uncertain") {
      try { await save({ ...checkpoint, inFlight: undefined }); } catch { return "uncertain"; }
    }
    try { return await settleDelivery(db, delivery, failure.disposition, failure.code); }
    catch { return "uncertain"; }
  }
}
export async function runWorkerBatch(db: PrismaClient, accountId: string, environment: "test" | "preview", provider: RoutingProvider, concurrency = 2) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4 || provider.mode !== "simulated") throw new Error("worker_configuration_invalid");
  return Promise.all(Array.from({ length: concurrency }, async () => {
    const claim = await claimDelivery(db, accountId, environment);
    return claim ? executeClaim(db, claim, provider) : "idle";
  }));
}
