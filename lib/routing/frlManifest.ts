import manifest from "@/docs/routing/frl-hubspot-manifest.json";
import readback from "@/docs/routing/frl-provider-readback.json";
import commissioning from "@/docs/routing/frl-commissioning-readback.json";
import activities from "@/docs/routing/frl-activity-readback.json";
import { planInquiry, pathways, type Inquiry } from "./frlPlan";
import { createHash } from "node:crypto";
export const providerConfigurationHash = createHash("sha256").update(JSON.stringify({manifest, readback, commissioning, activities})).digest("hex");

export function routeInquiry(inquiry: Inquiry, environment: "test" | "preview" = "test") {
  if (manifest.schemaVersion !== "frl-hubspot.v1" || manifest.portalId !== "247150421" ||
      pathways.some(p => !manifest.pathways.includes(p))) throw new Error("provider_manifest_invalid");
  const deals = commissioning.dealPipelines.pipelineResults.results;
  const tickets = commissioning.ticketPipelines.pipelineResults.results;
  for (const [route, pipelines] of [[manifest.sales, deals], [manifest.repair, tickets], [manifest.acquisition, deals]] as const) {
    const pipeline = pipelines.find(p => p.id === route.pipelineId);
    if (!pipeline?.stages.some(s => s.id === route.stageId)) throw new Error("provider_pipeline_inconsistent");
  }
  if (!deals.find(p => p.id === manifest.acquisition.pipelineId)?.stages.some(s => s.id === manifest.acquisition.offerExpiredStageId) ||
      [manifest.primaryOwnerId, manifest.backupOwnerId].some(id => !commissioning.owners.owners.some(o => String(o.ownerId) === id && o.isActive))) throw new Error("provider_assignment_inconsistent");
  for (const type of ["contacts", "deals", "tickets"] as const) {
    const definitions = type === "contacts" ? commissioning.contacts : readback[type];
    if (definitions.propertiesNotFound.length || manifest.requiredCustomProperties[type].some(name => !definitions.results.some(p => p.name === name))) throw new Error("provider_properties_inconsistent");
  }
  const plan = planInquiry(inquiry, { ...manifest, accountId: inquiry.accountId, environment });
  for (const [type, properties] of [["tasks", plan.task], ["notes", plan.note]] as const) {
    for (const [name, value] of Object.entries(properties)) {
      const definition = activities[type].results.find(p => p.name === name);
      if (!definition || definition.type === "enumeration" && !definition.options.some(o => o.value === value)) throw new Error("activity_manifest_inconsistent");
    }
  }
  if (plan.objectType) {
    const definitions = readback[plan.objectType].results;
    for (const [name, value] of Object.entries(plan.properties)) {
      if (!name.startsWith("frl_")) continue;
      const definition = definitions.find(p => p.name === name);
      if (!definition || (["enumeration", "bool"].includes(definition.type) && !definition.options.some(o => o.value === value))) throw new Error("provider_manifest_inconsistent");
    }
  }
  return plan;
}
