import { ClerkProvider } from "@clerk/nextjs";
import { requireRole } from "@/lib/auth/session";
import PilotControls from "./pilot-controls";

export default async function PilotPage() {
  await requireRole(["aj_admin", "operator"]);
  const controls = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? <ClerkProvider dynamic><PilotControls /></ClerkProvider>
    : <PilotControls />;
  return <main className="mx-auto max-w-3xl space-y-6 p-6"><h1 className="text-2xl font-semibold">FRL supervised pilot</h1>{controls}</main>;
}
