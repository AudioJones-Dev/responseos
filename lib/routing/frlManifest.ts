import manifest from "@/docs/routing/frl-hubspot-manifest.json";
import readback from "@/docs/routing/frl-provider-readback.json";
import { planInquiry, pathways, type Inquiry } from "./frlPlan";
import { createHash } from "node:crypto";
export const providerConfigurationHash = createHash("sha256").update(JSON.stringify({ schemaVersion: manifest.schemaVersion, portalId: manifest.portalId, primaryOwnerId: manifest.primaryOwnerId, backupOwnerId: manifest.backupOwnerId, sales: manifest.sales, repair: manifest.repair, acquisition: manifest.acquisition, readback })).digest("hex");

export function routeInquiry(inquiry: Inquiry, environment: "test" | "preview" = "test") {
  if (manifest.schemaVersion !== "frl-hubspot.v1" || manifest.portalId !== "247150421" ||
      pathways.some(p => !manifest.pathways.includes(p))) throw new Error("provider_manifest_invalid");
  const plan = planInquiry(inquiry, { ...manifest, accountId: inquiry.accountId, environment });
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
