import { readClientSetup } from "@/lib/clientSetup/service";
import { SetupWorkspace } from "@/components/clientSetup/SetupWorkspace";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";
export default async function ClientSetupPage() {
  const result = await readClientSetup();
  if (!result.ok) return <EmptyState title="Setup unavailable" description={result.error.message} />;
  return <SetupWorkspace setup={result.data} perspective="customer" />;
}
