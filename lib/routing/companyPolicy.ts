import { z } from "zod";
import type { Inquiry } from "./frlPlan";
import { ProviderFailure } from "./provider";
const reference = z.string().regex(/^[a-zA-Z0-9_.:-]{1,120}$/);
const binding = z.object({accountId: reference, environment: z.enum(["test", "preview"]), portalId: z.string().regex(/^\d+$/), companyId: z.string().regex(/^\d+$/), approvalReference: reference}).strict();
export type CompanyBinding = z.infer<typeof binding>;
export function parseCompanyBindings(raw = "[]") {
  const bindings = z.array(binding).max(100).parse(JSON.parse(raw));
  if (new Set(bindings.map(b => `${b.accountId}:${b.environment}:${b.portalId}:${b.companyId}`)).size !== bindings.length) throw new Error("company_policy_ambiguous");
  return bindings;
}
export function resolveCompanyBinding(inquiry: Inquiry, environment: string, portalId: string, bindings: CompanyBinding[]) {
  if (!inquiry.company) return null;
  const approved = bindings.filter(b => b.accountId === inquiry.accountId && b.environment === environment && b.portalId === portalId && b.companyId === inquiry.company?.id);
  if (approved.length !== 1) throw new ProviderFailure("company_binding_requires_approval", "rejected");
  return approved[0];
}
