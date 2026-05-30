import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { CLIENT_NAV } from "@/components/layout/nav";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      items={CLIENT_NAV}
      product="ResponseOS"
      scope="Client Portal"
      switchHref="/admin"
      switchLabel="Operator console →"
    >
      {children}
    </AppShell>
  );
}
