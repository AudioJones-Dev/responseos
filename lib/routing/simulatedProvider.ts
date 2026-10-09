import { createHash } from "node:crypto";
import type { Inquiry, Plan } from "./frlPlan";
import type { RoutingProvider } from "./provider";
const id = (key: string) => BigInt(`0x${createHash("sha256").update(key).digest("hex").slice(0, 12)}`).toString();
export class SimulatedRoutingProvider implements RoutingProvider {
  readonly mode = "simulated" as const;
  async findContact() { return null; }
  async createContact(inquiry: Inquiry) { return id(`${inquiry.accountId}:contact:${inquiry.contact.email}`); }
  async findInquiry() { return null; }
  async createInquiry(plan: Plan) { return id(`${plan.accountId}:inquiry:${plan.key}`); }
  async associate() {}
  async verifyAssociation() { return true; }
  async readCompany() { return true; }
  async findActivity() { return null; }
  async createActivity(plan: Plan, type: "notes" | "tasks") { return id(`${plan.accountId}:${type}:${plan.key}`); }
  async verifyActivity() { return true; }
  async associateObjects() {}
  async verifyObjectAssociation() { return true; }
}
