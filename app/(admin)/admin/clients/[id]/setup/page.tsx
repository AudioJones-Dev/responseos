import { getCurrentSession } from "@/lib/auth/session";
import { isCrossTenantRole } from "@/lib/data/session-helpers";
import { localSetupWritesAllowed } from "@/lib/clientSetup/contracts";
import { readClientSetup } from "@/lib/clientSetup/service";
import { SetupWorkspace } from "@/components/clientSetup/SetupWorkspace";
import { SetupForm } from "@/components/clientSetup/SetupForm";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function AccountSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session || !isCrossTenantRole(session)) return <EmptyState title="Operator access required" description="Use your client portal to review your account." />;
  const result = await readClientSetup((await params).id);
  if (!result.ok) return <EmptyState title="Setup unavailable" description={result.error.message} />;
  return <><SetupWorkspace setup={result.data} perspective="admin" /><SetupForm setup={result.data} writable={!result.data.synthetic && localSetupWritesAllowed()} /></>;
}
