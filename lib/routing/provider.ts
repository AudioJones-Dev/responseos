import type { Inquiry, Plan, ObjectType } from "./frlPlan";
export interface RoutingProvider {
  readonly mode: "simulated" | "hubspot";
  findContact(inquiry: Inquiry): Promise<string | null>;
  createContact(inquiry: Inquiry): Promise<string>;
  findInquiry(plan: Plan): Promise<string | null>;
  createInquiry(plan: Plan): Promise<string>;
  associate(plan: Plan, inquiryId: string, contactId: string): Promise<void>;
  verifyAssociation(plan: Plan, inquiryId: string, contactId: string): Promise<boolean>;
  readCompany(id: string): Promise<boolean>;
  findActivity(plan: Plan, type: "notes" | "tasks"): Promise<string | null>;
  createActivity(plan: Plan, type: "notes" | "tasks"): Promise<string>;
  verifyActivity(plan: Plan, type: "notes" | "tasks", id: string): Promise<boolean>;
  associateObjects(from: ObjectType, id: string, to: ObjectType, target: string): Promise<void>;
  verifyObjectAssociation(from: ObjectType, id: string, to: ObjectType, target: string): Promise<boolean>;
}
export class ProviderFailure extends Error {
  constructor(readonly code: string, readonly disposition: "rejected" | "uncertain" | "retry") { super(code); }
}
