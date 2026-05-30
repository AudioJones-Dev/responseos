import { PageHeader, EmptyState } from "@/components/ui";

export default function AdminWorkspacesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operator Console"
        title="Workspaces"
        description="Internal grouping of clients and operator assignments for routing and on-call coverage."
      />
      <EmptyState
        title="Workspace grouping arrives post-v0.1"
        description="Operator assignments and client groupings are not wired up yet. Manage clients directly from the Clients view in the meantime."
      />
    </>
  );
}
