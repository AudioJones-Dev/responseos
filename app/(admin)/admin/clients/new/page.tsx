import { getCurrentSession } from "@/lib/auth/session";
import { isCrossTenantRole } from "@/lib/data/session-helpers";
import { localSetupWritesAllowed } from "@/lib/clientSetup/contracts";
import { SetupForm } from "@/components/clientSetup/SetupForm";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function NewClientPage() {
  const session = await getCurrentSession();
  if (!session || !isCrossTenantRole(session)) return <EmptyState title="Operator access required" description="Account creation is restricted to operators." />;
  return <><PageHeader eyebrow="Operator Console" title="Prepare a client account" description="Local inactive setup. Check existing accounts before creating a new one." /><SetupForm writable={localSetupWritesAllowed()} /></>;
}
