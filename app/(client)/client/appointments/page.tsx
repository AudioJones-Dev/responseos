import {
  PageHeader,
  StatusBadge,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TD,
} from "@/components/ui";
import { getCurrentAccount } from "@/lib/auth/session";
import { Appointments } from "@/lib/data";
import type { AppointmentStatus } from "@/types/appointment";

const FALLBACK_ACCOUNT_ID = "org_mock_1";

const statusLabel: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

const statusTone: Record<
  AppointmentStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  confirmed: "success",
  completed: "success",
  scheduled: "warning",
  cancelled: "danger",
  no_show: "danger",
};

const formatWhen = (iso: string): string => iso.slice(0, 16).replace("T", " ");

export default async function ClientAppointmentsPage() {
  const org = await getCurrentAccount();
  const result = await Appointments.listAppointments({
    accountId: org?.id ?? FALLBACK_ACCOUNT_ID,
  });
  const appointments = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Client Portal"
        title="Appointments"
        description="Jobs booked onto your calendar, with their current status."
      />

      {appointments.length === 0 ? (
        <EmptyState
          title="No appointments booked yet"
          description="When a lead is booked into your calendar, the appointment will show up here."
        />
      ) : (
        <Table>
          <THead columns={["Job", "When", "Status"]} />
          <TBody>
            {appointments.map((b) => (
              <TR key={b.id}>
                <TD className="text-ink">{b.title}</TD>
                <TD mono>{formatWhen(b.start_time)}</TD>
                <TD>
                  <StatusBadge
                    label={statusLabel[b.status]}
                    tone={statusTone[b.status]}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
