import { PageHeader, Card, CardHeading, EmptyState } from "@/components/ui";

export default function ClientReportsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Client Portal"
        title="Reports"
        description="Your monthly business review, ready to download and share."
      />

      <Card>
        <CardHeading>Monthly Business Review</CardHeading>
        <p className="mt-2 text-sm text-ink-secondary">
          A clear summary of the calls handled, leads recovered, and revenue
          earned for your business each month.
        </p>
        <div className="mt-5">
          <EmptyState
            title="No reports available yet"
            description="PDF and CSV downloads of your monthly business review will appear here once your first full month of results is in."
          />
        </div>
      </Card>
    </>
  );
}
