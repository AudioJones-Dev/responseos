import "@/lib/serverOnlyGuard";
import type { Inquiry, Plan, Properties } from "./frlPlan";
import { ProviderFailure, type RoutingProvider } from "./provider";
import { routeInquiry } from "./frlManifest";

type ObjectRecord = {id: string; properties: Properties};
export type HubspotRequest = (method: "GET" | "POST" | "PUT", path: string, body?: unknown) => Promise<{status: number; body: unknown}>;
export class HubspotRoutingAdapter implements RoutingProvider {
  readonly mode = "hubspot" as const;
  readonly version = "frl-hubspot.v1";
  constructor(private readonly request: HubspotRequest) {}
  private async call(method: "GET" | "POST" | "PUT", path: string, body?: unknown, mutation = false) {
    let response;
    try { response = await this.request(method, path, body); }
    catch { throw new ProviderFailure("hubspot_transport_failure", mutation ? "uncertain" : "retry"); }
    if (response.status < 200 || response.status >= 300) {
      const definitive = [400, 401, 403, 404, 422, 429].includes(response.status);
      throw new ProviderFailure(`hubspot_http_${response.status}`, mutation && !definitive ? "uncertain" : response.status === 429 || !mutation ? "retry" : "rejected");
    }
    return response.body;
  }
  private async search(type: string, property: string, value: string, properties: string[]) {
    const body = await this.call("POST", `/crm/v3/objects/${type}/search`, { filterGroups: [{filters: [{propertyName: property, operator: "EQ", value}]}], properties, limit: 2 }) as {total: number; results: ObjectRecord[]};
    if (!Number.isInteger(body?.total) || !Array.isArray(body.results) || body.total !== body.results.length || body.total > 1 || body.results.some(r => !/^\d+$/.test(r.id) || !r.properties)) throw new ProviderFailure("hubspot_ambiguous_search", "rejected");
    return body.results[0] ?? null;
  }
  async findContact(inquiry: Inquiry) {
    const email = inquiry.contact.email ? await this.search("contacts", "email", inquiry.contact.email, ["email", "phone"]) : null;
    const phone = inquiry.contact.phone ? await this.search("contacts", "phone", inquiry.contact.phone, ["email", "phone"]) : null;
    if (email && phone && email.id !== phone.id || phone?.properties.email && inquiry.contact.email && phone.properties.email.toLowerCase() !== inquiry.contact.email) throw new ProviderFailure("contact_identity_collision", "rejected");
    return email?.id ?? phone?.id ?? null;
  }
  private async create(type: string, properties: Properties) {
    const result = await this.call("POST", `/crm/v3/objects/${type}`, {properties}, true) as ObjectRecord;
    if (!/^\d+$/.test(result?.id ?? "")) throw new ProviderFailure("hubspot_create_ack_ambiguous", "uncertain");
    let row: ObjectRecord;
    try { row = await this.call("GET", `/crm/v3/objects/${type}/${result.id}?properties=${encodeURIComponent(Object.keys(properties).join(","))}`) as ObjectRecord; }
    catch { throw new ProviderFailure("created_object_readback_uncertain", "uncertain"); }
    if (row?.id !== result.id || !row.properties || Object.keys(properties).some(name => name === "frl_next_action_at" ? Number(row.properties[name]) !== Date.parse(properties[name]) && Date.parse(row.properties[name]) !== Date.parse(properties[name]) : row.properties[name] !== properties[name])) throw new ProviderFailure("created_object_readback_uncertain", "uncertain");
    return result.id;
  }
  async createContact(inquiry: Inquiry) {
    if (!inquiry.contact.email) throw new ProviderFailure("new_contact_requires_email_review", "rejected");
    const plan = routeInquiry(inquiry);
    const attribution = Object.fromEntries(Object.entries(plan.properties).filter(([name]) => ["frl_source_page", "frl_landing_page", "frl_referrer_host", "frl_utm_source", "frl_utm_medium", "frl_utm_campaign", "frl_utm_term", "frl_utm_content"].includes(name)));
    return this.create("contacts", { email: inquiry.contact.email, firstname: inquiry.contact.firstName, hubspot_owner_id: plan.primaryOwnerId, ...attribution, ...(inquiry.contact.preferredMethod ? {frl_preferred_contact: inquiry.contact.preferredMethod} : {}), ...(inquiry.contact.lastName ? {lastname: inquiry.contact.lastName} : {}), ...(inquiry.contact.phone ? {phone: inquiry.contact.phone} : {}) });
  }
  async findInquiry(plan: Plan) {
    if (!plan.objectType) return null;
    const names = Object.keys(plan.properties);
    const row = await this.search(plan.objectType, "frl_inquiry_id", plan.key, names);
    if (row && names.some(name => {
      if (name === "frl_next_action_at") return Date.parse(row.properties[name]) !== Date.parse(plan.properties[name]) && Number(row.properties[name]) !== Date.parse(plan.properties[name]);
      return row.properties[name] !== plan.properties[name];
    })) throw new ProviderFailure("inquiry_readback_mismatch", "rejected");
    return row?.id ?? null;
  }
  async createInquiry(plan: Plan) {
    if (!plan.objectType || "amount" in plan.properties) throw new ProviderFailure("invalid_inquiry_plan", "rejected");
    return this.create(plan.objectType, plan.properties);
  }
  async associate(plan: Plan, inquiryId: string, contactId: string) {
    await this.call("PUT", `/crm/v4/objects/${plan.objectType}/${encodeURIComponent(inquiryId)}/associations/default/contacts/${encodeURIComponent(contactId)}`, undefined, true);
  }
  async verifyAssociation(plan: Plan, inquiryId: string, contactId: string) {
    let after: string | undefined; const seen = new Set<string>();
    do {
      const body = await this.call("GET", `/crm/v4/objects/${plan.objectType}/${encodeURIComponent(inquiryId)}/associations/contacts?limit=500${after ? `&after=${encodeURIComponent(after)}` : ""}`) as {results: {toObjectId: string | number}[]; paging?: {next?: {after: string}}};
      if (!Array.isArray(body?.results)) throw new ProviderFailure("association_response_invalid", "uncertain");
      if (body.results.some(r => String(r.toObjectId) === contactId)) return true;
      after = body.paging?.next?.after;
      if (after && seen.has(after)) throw new ProviderFailure("association_pagination_loop", "uncertain");
      if (after) seen.add(after);
    } while (after);
    return false;
  }
}
