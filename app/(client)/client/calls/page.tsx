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
import { Calls } from "@/lib/data";
import type { CallStatus } from "@/types/call";

const FALLBACK_ACCOUNT_ID = "org_mock_1";

const statusLabel: Record<CallStatus, string> = {
  answered: "Answered",
  missed: "Missed",
  voicemail: "Voicemail",
  spam: "Spam",
  failed: "Failed",
  completed: "Completed",
};

const statusTone: Record<CallStatus, "success" | "warning" | "danger" | "neutral"> = {
  answered: "success",
  completed: "success",
  voicemail: "warning",
  missed: "danger",
  failed: "danger",
  spam: "neutral",
};

const formatWhen = (iso: string): string => iso.slice(0, 16).replace("T", " ");

export default async function ClientCallsPage() {
  const org = await getCurrentAccount();
  const result = await Calls.listCalls({
    accountId: org?.id ?? FALLBACK_ACCOUNT_ID,
  });
  const calls = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Client Portal"
        title="Calls"
        description="Every inbound and outbound call handled on your behalf, newest first."
      />

      {calls.length === 0 ? (
        <EmptyState
          title="No calls yet"
          description="When a customer calls your business line, the call and its outcome will appear here."
        />
      ) : (
        <Table>
          <THead columns={["When", "Direction", "Outcome", "From", "To"]} />
          <TBody>
            {calls.map((c) => (
              <TR key={c.id}>
                <TD mono>{formatWhen(c.started_at)}</TD>
                <TD>{c.direction === "inbound" ? "Inbound" : "Outbound"}</TD>
                <TD>
                  <StatusBadge
                    label={statusLabel[c.status]}
                    tone={statusTone[c.status]}
                  />
                </TD>
                <TD mono>{c.from_number}</TD>
                <TD mono>{c.to_number}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
