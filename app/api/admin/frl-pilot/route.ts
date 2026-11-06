import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { loadPilotConfig } from "@/lib/communications/pilot/config";
import type { PilotState } from "@/lib/communications/pilot/machine";
import { decidePilotAdmission, killPilotWindow } from "@/lib/communications/pilot/store";
import { z } from "zod";

export async function GET() {
  if (process.env.RESPONSEOS_REQUIRE_AUTH !== "true") return new Response(null, { status: 503 });
  await requireRole(["aj_admin", "operator"]);
  const c = loadPilotConfig();
  if (!c || !db) return new Response(null, { status: 503 });
  const runs = await db.frlPilotRun.findMany({ where: { account_id: c.accountId, window_id: c.windowId }, orderBy: { started_at: "desc" }, take: 10 });
  const artifacts = await db.frlPilotArtifact.findMany({ where: { account_id: c.accountId, run_id: { in: runs.map(r => r.id) }, purged_at: null, expires_at: { gt: new Date() } }, select: { run_id: true, recording_id: true, purpose: true, transcript: true, started_at: true, ended_at: true, expires_at: true } });
  const deletionPending = await db.frlPilotDeletion.count({ where: { account_id: c.accountId, state: { not: "verified" }, due_at: { lte: new Date() } } });
  return NextResponse.json({ exercise: c.exercise, deletionPending, runs: runs.map(r => {
    const s = r.state_json as unknown as PilotState;
    return { id: r.id, stage: s.stage, incident: s.incident, captureDenied: s.captureDenied, revoked: !!s.revokedAt,
      pending: s.stage === "pending" && s.admission && s.deadline > Date.now() ? { caller: s.admission.caller, arrivedAt: s.startedAt, expiresAt: s.deadline } : null,
      digits: s.digits ?? [],
      terminalObserved: s.stage === "ended", artifacts: s.revokedAt ? [] : artifacts.filter(a => a.run_id === r.id), nameStatus: "caller_provided_unverified" };
  }) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (process.env.RESPONSEOS_REQUIRE_AUTH !== "true") return new Response(null, { status: 503 });
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(req.url).origin) return new Response(null, { status: 403 });
  const session = await requireRole(["aj_admin", "operator"]);
  const c = loadPilotConfig();
  if (!c || !db) return new Response(null, { status: 503 });
  const raw = await req.text();
  if (raw.length > 1024) return new Response(null, { status: 413 });
  if (raw) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
    const decision = z.object({ action: z.enum(["approve", "reject"]), runId: z.string().uuid() }).strict().safeParse(parsed);
    if (!decision.success) return new Response(null, { status: 400 });
    const accepted = await decidePilotAdmission(db, c, session.user.id, decision.data.runId, decision.data.action === "approve");
    return NextResponse.json({ accepted }, { status: accepted ? 202 : 409, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(await killPilotWindow(db, c, session.user.id), { status: 202, headers: { "Cache-Control": "no-store" } });
}
