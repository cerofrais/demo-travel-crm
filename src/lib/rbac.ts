/**
 * Roles & permissions for the wishtrip CRM.
 * A Keycloak realm would carry the same role names in production.
 */
export type AppRole = "ADMIN" | "MANAGER" | "SALES" | "OPS" | "FINANCE" | "VIEWER";

export const ROLE_LABEL: Record<AppRole, string> = {
  ADMIN: "Administrator",
  MANAGER: "Manager",
  SALES: "Trip Consultant",
  OPS: "Operations",
  FINANCE: "Finance",
  VIEWER: "Viewer",
};

export type Permission =
  | "dashboard.view"
  | "enquiries.view"
  | "enquiries.manage" // all enquiries, reassign, delete
  | "enquiries.work" // own + unassigned
  | "itineraries.edit"
  | "trips.view"
  | "trips.manage"
  | "travellers.view"
  | "travellers.manage"
  | "payments.view"
  | "payments.manage"
  | "suppliers.view"
  | "suppliers.manage"
  | "inbox.view"
  | "messaging.send"
  | "agents.view"
  | "agents.configure"
  | "agents.review"
  | "campaigns.manage"
  | "templates.manage"
  | "tasks.view"
  | "tasks.manage"
  | "reports.view"
  | "reports.all"
  | "users.manage"
  | "settings.manage"
  | "settings.view"
  | "activity.view"
  | "ai.audit"
  | "data.ask";

const ALL: Permission[] = [
  "dashboard.view",
  "enquiries.view",
  "enquiries.manage",
  "enquiries.work",
  "itineraries.edit",
  "trips.view",
  "trips.manage",
  "travellers.view",
  "travellers.manage",
  "payments.view",
  "payments.manage",
  "suppliers.view",
  "suppliers.manage",
  "inbox.view",
  "messaging.send",
  "agents.view",
  "agents.configure",
  "agents.review",
  "campaigns.manage",
  "templates.manage",
  "tasks.view",
  "tasks.manage",
  "reports.view",
  "reports.all",
  "users.manage",
  "settings.manage",
  "settings.view",
  "activity.view",
  "ai.audit",
  "data.ask",
];

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  ADMIN: ALL,
  MANAGER: ALL.filter((p) => p !== "users.manage" && p !== "settings.manage"),
  // (MANAGER keeps settings.view → read-only Settings page)
  SALES: [
    "dashboard.view",
    "enquiries.view",
    "enquiries.work",
    "itineraries.edit",
    "trips.view",
    "travellers.view",
    "travellers.manage",
    "payments.view",
    "suppliers.view",
    "inbox.view",
    "messaging.send",
    "agents.view",
    "agents.review",
    "templates.manage",
    "tasks.view",
    "tasks.manage",
    "reports.view",
    "data.ask",
  ],
  OPS: [
    "dashboard.view",
    "enquiries.view",
    "trips.view",
    "trips.manage",
    "travellers.view",
    "travellers.manage",
    "payments.view",
    "suppliers.view",
    "suppliers.manage",
    "inbox.view",
    "messaging.send",
    "agents.view",
    "tasks.view",
    "tasks.manage",
    "reports.view",
    "activity.view",
    "data.ask",
  ],
  FINANCE: [
    "dashboard.view",
    "enquiries.view",
    "trips.view",
    "travellers.view",
    "payments.view",
    "payments.manage",
    "suppliers.view",
    "tasks.view",
    "tasks.manage",
    "reports.view",
    "reports.all",
    "activity.view",
    "data.ask",
  ],
  VIEWER: [
    "dashboard.view",
    "enquiries.view",
    "trips.view",
    "travellers.view",
    "payments.view",
    "suppliers.view",
    "inbox.view",
    "agents.view",
    "tasks.view",
    "reports.view",
    "activity.view",
    "ai.audit",
    "data.ask",
  ],
};

export function can(role: AppRole, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function canAny(role: AppRole, perms: Permission[]): boolean {
  return perms.some((p) => can(role, p));
}

export interface NavDef {
  href: string;
  label: string;
  icon: string;
  perm: Permission | Permission[];
  section: "work" | "operations" | "growth" | "ai" | "admin";
}

export const NAV: NavDef[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", perm: "dashboard.view", section: "work" },
  { href: "/enquiries", label: "Enquiries", icon: "KanbanSquare", perm: "enquiries.view", section: "work" },
  { href: "/inbox", label: "Inbox", icon: "MessageCircle", perm: "inbox.view", section: "work" },
  { href: "/tasks", label: "Tasks", icon: "ListTodo", perm: "tasks.view", section: "work" },
  { href: "/trips", label: "Trips", icon: "Plane", perm: "trips.view", section: "operations" },
  { href: "/travellers", label: "Travellers", icon: "Users", perm: "travellers.view", section: "operations" },
  { href: "/itineraries", label: "Itineraries", icon: "Map", perm: "enquiries.view", section: "operations" },
  { href: "/payments", label: "Payments", icon: "IndianRupee", perm: "payments.view", section: "operations" },
  { href: "/suppliers", label: "Suppliers", icon: "Building2", perm: "suppliers.view", section: "operations" },
  { href: "/agents", label: "AI Agents", icon: "Bot", perm: "agents.view", section: "ai" },
  { href: "/calls", label: "Calls", icon: "Phone", perm: "agents.view", section: "ai" },
  { href: "/ask", label: "Ask the data", icon: "MessageSquareText", perm: "data.ask", section: "ai" },
  { href: "/ai-audit", label: "AI Audit", icon: "ShieldCheck", perm: "ai.audit", section: "ai" },
  { href: "/campaigns", label: "Campaigns", icon: "Megaphone", perm: "campaigns.manage", section: "growth" },
  { href: "/templates", label: "Templates", icon: "LayoutTemplate", perm: "templates.manage", section: "growth" },
  { href: "/reviews", label: "Reviews & Referrals", icon: "Star", perm: "travellers.view", section: "growth" },
  { href: "/reports", label: "Reports", icon: "BarChart3", perm: "reports.view", section: "growth" },
  { href: "/users", label: "Team", icon: "UserCog", perm: "users.manage", section: "admin" },
  { href: "/activity", label: "Activity", icon: "History", perm: "activity.view", section: "admin" },
  { href: "/settings", label: "Settings", icon: "Settings", perm: ["settings.manage", "settings.view"], section: "admin" },
];

export function navFor(role: AppRole): NavDef[] {
  return NAV.filter((n) => (Array.isArray(n.perm) ? canAny(role, n.perm) : can(role, n.perm)));
}

export const ROUTE_GUARDS: { prefix: string; perm: Permission | Permission[] }[] = NAV.map((n) => ({
  prefix: n.href,
  perm: n.perm,
}));

export function homeFor(role: AppRole): string {
  if (role === "OPS") return "/trips";
  if (role === "FINANCE") return "/payments";
  return "/dashboard";
}
