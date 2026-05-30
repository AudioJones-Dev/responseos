import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ADMIN_NAV } from "@/components/layout/nav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      items={ADMIN_NAV}
      product="ResponseOS"
      scope="Operator Console"
      switchHref="/client/dashboard"
      switchLabel="Client portal →"
    >
      {children}
    </AppShell>
  );
}
