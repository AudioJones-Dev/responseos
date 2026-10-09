import type { Inquiry, Plan } from "./frlPlan";
export interface RoutingProvider {
  readonly mode: "simulated" | "hubspot";
  findContact(inquiry: Inquiry): Promise<string | null>;
  createContact(inquiry: Inquiry): Promise<string>;
  findInquiry(plan: Plan): Promise<string | null>;
  createInquiry(plan: Plan): Promise<string>;
  associate(plan: Plan, inquiryId: string, contactId: string): Promise<void>;
  verifyAssociation(plan: Plan, inquiryId: string, contactId: string): Promise<boolean>;
}
export class ProviderFailure extends Error {
  constructor(readonly code: string, readonly disposition: "rejected" | "uncertain" | "retry") { super(code); }
}
