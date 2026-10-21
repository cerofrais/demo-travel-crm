"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/demo/session-client";
import {
  LayoutDashboard,
  KanbanSquare,
  MessageCircle,
  ListTodo,
  Plane,
  Users,
  Map,
  IndianRupee,
  Building2,
  Bot,
  Phone,
  Megaphone,
  LayoutTemplate,
  Star,
  BarChart3,
  UserCog,
  History,
  Settings,
  MessageSquareText,
  ShieldCheck,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  KanbanSquare,
  MessageCircle,
  ListTodo,
  Plane,
  Users,
  Map,
  IndianRupee,
  Building2,
  Bot,
  Phone,
  Megaphone,
  LayoutTemplate,
  Star,
  BarChart3,
  UserCog,
  History,
  Settings,
  MessageSquareText,
  ShieldCheck,
};

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  section: string;
}

const SECTION_LABEL: Record<string, string> = {
  work: "Work",
  operations: "Operations",
  ai: "AI agents",
  growth: "Growth",
  admin: "Admin",
};

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavList({
  nav,
  collapsed = false,
  onNavigate,
  badges = {},
}: {
  nav: NavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  let lastSection = "";
  return (
    <nav className="scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
      {nav.map((item) => {
        const Icon = NAV_ICONS[item.icon] ?? LayoutDashboard;
        const active = isActive(pathname, item.href);
        const showSection = item.section !== lastSection;
        lastSection = item.section;
        const badge = badges[item.href];
        return (
          <div key={item.href}>
            {showSection && !collapsed && (
              <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
                {SECTION_LABEL[item.section] ?? item.section}
              </div>
            )}
            {showSection && collapsed && <div className="mx-auto my-2 h-px w-6 bg-white/10" />}
            <Link
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                "min-h-[40px] py-1.5",
                collapsed && "justify-center px-0",
                active ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white",
              )}
            >
              <span className="relative">
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {collapsed && badge ? <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-clay-500" /> : null}
              </span>
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && badge ? (
                <span className="rounded-full bg-clay-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">{badge}</span>
              ) : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

export function SignOutButton({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <button
      title="Sign out"
      aria-label="Sign out"
      onClick={() => signOut()}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-white",
        collapsed && "mx-auto",
      )}
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}

export function UserFooter({ user, collapsed = false }: { user: { name: string; email?: string; role: string }; collapsed?: boolean }) {
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-white/10 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">{initials}</div>
        <SignOutButton collapsed />
      </div>
    );
  }
  return (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">{initials}</div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium text-white">{user.name}</div>
          <div className="truncate text-[11px] text-sidebar-foreground/60">{user.role}</div>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
