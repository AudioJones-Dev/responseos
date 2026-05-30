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
import { Quotes } from "@/lib/data";
import type { QuoteStatus } from "@/types/quote";

const FALLBACK_ACCOUNT_ID = "org_mock_1";

const formatUsd = (cents?: number): string =>
  typeof cents === "number"
    ? (cents / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : "—";

const statusLabel: Record<QuoteStatus, string> = {
  requested: "Requested",
  reviewing: "Needs Review",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
};

const statusTone: Record<
  QuoteStatus,
  "success" | "warning" | "danger" | "neutral"
> = {
  accepted: "success",
  sent: "success",
  requested: "warning",
  reviewing: "warning",
  declined: "danger",
};

export default async function ClientQuotesPage() {
  const org = await getCurrentAccount();
  const result = await Quotes.listQuoteRequests({
    accountId: org?.id ?? FALLBACK_ACCOUNT_ID,
  });
  const quotes = result.ok ? result.data : [];

  return (
    <>
      <PageHeader
        eyebrow="Client Portal"
        title="Quote Requests"
        description="Estimates customers have asked for, with their value and where each one stands."
      />

      {quotes.length === 0 ? (
        <EmptyState
          title="No quote requests yet"
          description="When a customer asks for an estimate, the request and its value will appear here."
        />
      ) : (
        <Table>
          <THead columns={["Service", "Status", "Estimated Value"]} />
          <TBody>
            {quotes.map((q) => (
              <TR key={q.id}>
                <TD className="text-ink">{q.service_type}</TD>
                <TD>
                  <StatusBadge
                    label={statusLabel[q.status]}
                    tone={statusTone[q.status]}
                  />
                </TD>
                <TD mono>{formatUsd(q.estimated_value)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
