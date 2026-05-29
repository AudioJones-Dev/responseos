import "@/lib/serverOnlyGuard";
import { db } from "@/lib/db/client";
import { getMockBookings } from "@/lib/mock/bookings";
import type { Booking, BookingStatus, CalendarProvider } from "@/types/booking";
import { err, errFromThrown, ok, type Result } from "./result";
import {
  assertRowInScope,
  isCrossTenantRole,
  withTenantScope,
} from "./session-helpers";

interface BookingRow {
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

function rowToBooking(row: BookingRow): Booking {
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
    status: row.status as BookingStatus,
    location: row.location ?? undefined,
    notes: row.notes ?? undefined,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function listBookings(params: {
  accountId?: string;
}): Promise<Result<Booking[]>> {
  const scope = await withTenantScope(params.accountId);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const all = getMockBookings();
    if (scope.effectiveAccountId) {
      return ok(all.filter((b) => b.account_id === scope.effectiveAccountId));
    }
    return ok(all);
  }

  try {
    const rows = await db.booking.findMany({
      where: scope.effectiveAccountId
        ? { account_id: scope.effectiveAccountId }
        : undefined,
      orderBy: { start_time: "asc" },
    });
    return ok(rows.map(rowToBooking));
  } catch (e) {
    return errFromThrown<Booking[]>(e);
  }
}

export async function getBookingById(id: string): Promise<Result<Booking>> {
  const scope = await withTenantScope(undefined);
  if (!scope.ok) return err(scope.error.code, scope.error.message);

  if (db === null) {
    const found = getMockBookings().find((b) => b.id === id);
    if (!found) return err("not_found", `Booking ${id} not found.`);
    const scoped = assertRowInScope(
      found,
      scope.effectiveAccountId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok ? ok(found) : err(scoped.error.code, scoped.error.message);
  }

  try {
    const row = await db.booking.findUnique({ where: { id } });
    if (!row) return err("not_found", `Booking ${id} not found.`);
    const booking = rowToBooking(row);
    const scoped = assertRowInScope(
      booking,
      scope.effectiveAccountId,
      isCrossTenantRole(scope.session),
    );
    return scoped.ok
      ? ok(booking)
      : err(scoped.error.code, scoped.error.message);
  } catch (e) {
    return errFromThrown<Booking>(e);
  }
}
