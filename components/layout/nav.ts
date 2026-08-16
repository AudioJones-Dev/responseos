import type { IconName } from "./icons";

export type NavItem = { label: string; href: string; icon: IconName };

/** Admin console nav — maps to existing /admin routes (no dead links). */
export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "overview" },
  { label: "Clients", href: "/admin/clients", icon: "clients" },
  { label: "Workspaces", href: "/admin/workspaces", icon: "workspaces" },
  { label: "Calls", href: "/admin/calls", icon: "calls" },
  { label: "Leads", href: "/admin/leads", icon: "leads" },
  { label: "Receptionist", href: "/admin/receptionist", icon: "playbooks" },
  { label: "Automations", href: "/admin/automations", icon: "automations" },
  { label: "Playbooks", href: "/admin/playbooks", icon: "playbooks" },
  { label: "Reports", href: "/admin/reports", icon: "reports" },
  { label: "Billing", href: "/admin/billing", icon: "billing" },
  { label: "Settings", href: "/admin/settings", icon: "settings" },
];

/** Client portal nav — maps to existing /client routes. */
export const CLIENT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/client/dashboard", icon: "overview" },
  { label: "Calls", href: "/client/calls", icon: "calls" },
  { label: "Leads", href: "/client/leads", icon: "leads" },
  { label: "Appointments", href: "/client/appointments", icon: "appointments" },
  { label: "Quotes", href: "/client/quotes", icon: "quotes" },
  { label: "Revenue", href: "/client/revenue", icon: "revenue" },
  { label: "Reports", href: "/client/reports", icon: "reports" },
  { label: "Settings", href: "/client/settings", icon: "settings" },
];
