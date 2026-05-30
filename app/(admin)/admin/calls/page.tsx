import {
  PageHeader,
  EmptyState,
  StatusBadge,
  Table,
  THead,
  TBody,
  TR,
  TD,
  type Tone,
} from "@/components/ui";
import { Calls } from "@/lib/data";

const statusTone: Record<string, Tone> = {
  answered: "success",
  completed: "success",
  missed: "warning",
  voicemail: "warning",
  failed: "danger",
  spam: "danger",
};

const titleCase = (s: string): string =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const formatDuration = (s?: number): string => {
  const secs = s ?? 0;
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
};

export default async function AdminCallsPage() {
  const result = await Calls.listCalls({});
  const calls = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Calls"
        description="Inbound and outbound call events across providers (Twilio, Retell, Vapi, Bland, manual)."
      />

      {calls.length === 0 ? (
        <EmptyState
          title="No call events captured"
          description="Once a connected line receives or places a call, every event lands here with its provider, outcome, and duration."
        />
      ) : (
        <Table>
          <THead
            columns={[
              "Time",
              "Direction",
              "Status",
              "Provider",
              "From",
              "To",
              "Duration",
            ]}
          />
          <TBody>
            {calls.map((c) => (
              <TR key={c.id}>
                <TD mono>{c.started_at.slice(0, 16).replace("T", " ")}</TD>
                <TD>{titleCase(c.direction)}</TD>
                <TD>
                  <StatusBadge
                    label={titleCase(c.status)}
                    tone={statusTone[c.status] ?? "neutral"}
                  />
                </TD>
                <TD>{titleCase(c.provider)}</TD>
                <TD mono>{c.from_number}</TD>
                <TD mono>{c.to_number}</TD>
                <TD className="tabular-nums">
                  {formatDuration(c.duration_seconds)}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
