import {
  EmptyState,
  PageHeader,
  StatusBadge,
  Table,
  TBody,
  TD,
  THead,
  TR,
  type Tone,
} from "@/components/ui";
import { Appointments } from "@/lib/data";

const statusTone: Record<string, Tone> = {
  scheduled: "warning",
  confirmed: "success",
  completed: "success",
  cancelled: "danger",
  no_show: "danger",
};

const titleCase = (value: string): string =>
  value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

export default async function AdminAppointmentsPage() {
  const result = await Appointments.listAppointments({});
  const appointments = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Appointments"
        description="Appointments across all authorized workspaces, including clearly classified internal demo activity."
      />
      {appointments.length === 0 ? (
        <EmptyState
          title="No appointments yet"
          description="Scheduled appointments will appear here."
        />
      ) : (
        <Table>
          <THead columns={["Title", "Start", "Provider", "Status", "Location"]} />
          <TBody>
            {appointments.map((appointment) => (
              <TR key={appointment.id}>
                <TD className="font-medium text-ink">{appointment.title}</TD>
                <TD mono>{new Date(appointment.start_time).toLocaleString("en-US")}</TD>
                <TD>{titleCase(appointment.calendar_provider)}</TD>
                <TD>
                  <StatusBadge
                    label={titleCase(appointment.status)}
                    tone={statusTone[appointment.status] ?? "neutral"}
                  />
                </TD>
                <TD>{appointment.location ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
