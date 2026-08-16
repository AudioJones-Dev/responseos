import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockAppointments } from "@/lib/mock/appointments";
import type { Appointment, AppointmentStatus, CalendarProvider } from "@/types/appointment";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  assertRowInScope,
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

interface AppointmentRow {
  id: string;
  account_id: string;
  contact_id: string;
  lead_event_id: string | null;
  calendar_provider: string;
  external_event_id: string | null;
  title: string;
  start_time: Date;
  end_time: Date;
  status: string;
  location: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

function rowToAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    account_id: row.account_id,
    contact_id: row.contact_id,
    lead_event_id: row.lead_event_id ?? undefined,
    calendar_provider: row.calendar_provider as CalendarProvider,
    external_event_id: row.external_event_id ?? undefined,
    title: row.title,
    start_time: row.start_time.toISOString(),
    end_time: row.end_time.toISOString(),
    status: row.status as AppointmentStatus,
    location: row.location ?? undefined,
    notes: row.notes ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listAppointments(params: {
  accountId?: string;
}): Promise<Result<Appointment[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockAppointments();
    if (scope.effectiveAccountId) {
      return ok(all.filter((b) => b.account_id === scope.effectiveAccountId));
    }
    return ok(all);
  }

  try {
    const rows = await db.appointment.findMany({
      where: scope.effectiveAccountId
        ? { account_id: scope.effectiveAccountId }
        : undefined,
      orderBy: { start_time: "asc" },
    });
    return ok(rows.map(rowToAppointment));
  } catch (e) {
    return errFromThrown<Appointment[]>(e);
  }
}

/**
 * Creates an appointment in the session's effective tenant scope. The
 * account is derived from the session, never from the caller's claim.
 */
export async function createAppointment(entry: {
  accountId: string;
  contactId: string;
  calendarProvider: CalendarProvider;
  title: string;
  startTime: Date;
  endTime: Date;
  status?: AppointmentStatus;
  externalEventId?: string;
  leadEventId?: string;
  location?: string;
  notes?: string;
}): Promise<Result<Appointment>> {
  const scope = await withTenantScope(entry.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);
  if (!scope.effectiveAccountId) {
    return err("invalid_input", "An account id is required.");
  }

  if (db === null) {
    return err(
      "not_available",
      "createAppointment requires a database connection.",
    );
  }

  try {
    const row = await db.appointment.create({
      data: {
        account_id: scope.effectiveAccountId,
        contact_id: entry.contactId,
        lead_event_id: entry.leadEventId ?? null,
        calendar_provider: entry.calendarProvider,
        external_event_id: entry.externalEventId ?? null,
        title: entry.title,
        start_time: entry.startTime,
        end_time: entry.endTime,
        status: entry.status ?? "scheduled",
        location: entry.location ?? null,
        notes: entry.notes ?? null,
      },
    });
    return ok(rowToAppointment(row));
  } catch (e) {
    return errFromThrown<Appointment>(e);
  }
}

export async function getAppointmentById(id: string): Promise<Result<Appointment>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockAppointments().find((b) => b.id === id);
    if (!found) return err("not_found", `Appointment ${id} not found.`);
    const scoped = assertRowInScope(
      found,
      scope.effectiveAccountId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok ? ok(found) : err(scoped.error.code, scoped.error.message);
  }

  try {
    const row = await db.appointment.findUnique({ where: { id } });
    if (!row) return err("not_found", `Appointment ${id} not found.`);
    const booking = rowToAppointment(row);
    const scoped = assertRowInScope(
      booking,
      scope.effectiveAccountId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok
      ? ok(booking)
      : err(scoped.error.code, scoped.error.message);
  } catch (e) {
    return errFromThrown<Appointment>(e);
  }
}
