import "@/lib/serverOnlyGuard";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const callSchema = z.object({ call_control_id: z.string().min(1), call_leg_id: z.string().min(1), call_session_id: z.string().min(1), call_duration: z.number().int().nonnegative() });
export type WatchdogCall = z.infer<typeof callSchema>;
export type WatchdogTransport = { list: () => Promise<WatchdogCall[]>; hangup: (id: string, commandId: string) => Promise<void> };
type Diagnostic = { category: "http" | "timeout" | "transport" | "invalid_json" | "invalid_inventory" | "incomplete_pagination" | "hangup_unconfirmed" | "unknown"; operation: "inventory" | "hangup"; status?: number; field?: string; received?: string };
class WatchdogError extends Error {
  constructor(readonly diagnostic: Diagnostic) { super(`watchdog_${diagnostic.category}`); }
}
export function watchdogDiagnostic(error: unknown): Diagnostic {
  return error instanceof WatchdogError ? error.diagnostic : { category: "unknown", operation: "inventory" };
}
function invalidInventory(input: unknown, path: PropertyKey[]): WatchdogError {
  const allowed = new Set(["data", "meta", "cursors", "after", "call_control_id", "call_leg_id", "call_session_id", "call_duration"]);
  let value: unknown = input;
  for (const key of path) value = value && typeof value === "object" ? (value as Record<PropertyKey, unknown>)[key] : undefined;
  const field = path.map(key => typeof key === "number" ? "item" : allowed.has(String(key)) ? String(key) : "unknown").join(".").slice(0,120) || "root";
  const received = value === null ? "null" : Array.isArray(value) ? "array" : typeof value === "number" ? Number.isInteger(value) ? value < 0 ? "negative_integer" : "integer" : "non_integer" : typeof value;
  return new WatchdogError({ category: "invalid_inventory", operation: "inventory", field, received });
}

export function telnyxWatchdogTransport(key: string, applicationId: string): WatchdogTransport {
  async function request(path: string, body?: object) {
    const operation = body ? "hangup" : "inventory";
    let response: Response;
    try { response = await fetch(`https://api.telnyx.com/v2${path}`, {
      method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(5000), redirect: "error",
    }); } catch (error) {
      throw new WatchdogError({ category: error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name) ? "timeout" : "transport", operation });
    }
    if (!response.ok) throw new WatchdogError({ category: "http", operation, status: response.status });
    try { return await response.json(); } catch { throw new WatchdogError({ category: "invalid_json", operation }); }
  }
  return {
    async list() {
      const calls: WatchdogCall[] = []; const cursors = new Set<string>(); let after: string | undefined;
      for (let page = 0; page < 20; page++) {
        const path = `/connections/${encodeURIComponent(applicationId)}/active_calls?page[limit]=100${after ? `&page[after]=${encodeURIComponent(after)}` : ""}`;
        const input: unknown = await request(path);
        const parsed = z.object({ data: z.array(callSchema), meta: z.object({ cursors: z.object({ after: z.string().nullable().optional() }).optional() }).optional() }).safeParse(input);
        if (!parsed.success) throw invalidInventory(input, parsed.error.issues[0].path);
        const result = parsed.data;
        calls.push(...result.data);
        after = result.meta?.cursors?.after ?? undefined;
        if (!after) return calls;
        if (cursors.has(after)) throw new WatchdogError({ category: "incomplete_pagination", operation: "inventory" });
        cursors.add(after);
      }
      throw new WatchdogError({ category: "incomplete_pagination", operation: "inventory" });
    },
    async hangup(id, commandId) {
      const result = await request(`/calls/${encodeURIComponent(id)}/actions/hangup`, { command_id: commandId });
      if (result?.data?.result !== "ok") throw new WatchdogError({ category: "hangup_unconfirmed", operation: "hangup" });
    },
  };
}

export class PilotWatchdog {
  private sessions = new Map<string, number>();
  private commands = new Map<string, string>();
  private stoppedSessions = new Set<string>();
  private lastScan: number | null = null;
  private uncertain = true;
  constructor(private transport: WatchdogTransport, private apply: boolean, private closesAt: number) {}

  async scan(now: number) {
    const calls = await this.transport.list().catch(error => { this.uncertain = true; throw error; });
    const reset = this.uncertain || this.lastScan === null || now < this.lastScan || now - this.lastScan > 10000;
    const expired = new Set<string>();
    for (const call of calls) {
      const first = this.sessions.get(call.call_session_id) ?? now;
      this.sessions.set(call.call_session_id, first);
      // Early backup cutoff leaves room for polling/HTTP delay; it is not a carrier guarantee.
      if (reset || now >= this.closesAt || now - first >= 240000 || call.call_duration >= 240 || this.commands.has(call.call_control_id) || this.stoppedSessions.has(call.call_session_id)) expired.add(call.call_session_id);
    }
    if (this.apply) for (const session of expired) this.stoppedSessions.add(session);
    const targets = calls.filter(call => expired.has(call.call_session_id));
    let failed = 0;
    const failures: Diagnostic[] = [];
    if (this.apply) await Promise.all(targets.map(async call => {
      const id = this.commands.get(call.call_control_id) ?? randomUUID(); this.commands.set(call.call_control_id, id);
      try { await this.transport.hangup(call.call_control_id, id); } catch (error) { failed++; if (failures.length < 5) failures.push({ ...watchdogDiagnostic(error), operation: "hangup" }); }
    }));
    const legs = new Set(calls.map(call => call.call_control_id));
    for (const id of this.commands.keys()) if (!legs.has(id)) this.commands.delete(id);
    this.lastScan = now; this.uncertain = failed > 0;
    return { active: calls.length, targeted: targets.length, failed, failures, apply: this.apply, terminalVerified: calls.length === 0 };
  }
}
