"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MoreHorizontal, LayoutDashboard, X, PanelLeftOpen, PanelLeftClose, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet } from "@/components/ui/sheet";
import { NavList, UserFooter, NAV_ICONS, isActive, type NavItem } from "./nav-list";
import { BrandMark, BrandWordmark } from "./brand";
import { useDb, useHydrated } from "@/lib/demo/use-db";
import { resetDemoData } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";

/**
 * Responsive app shell (ported from the wellness CRM):
 *   phone  (<md): top bar + hamburger drawer + in-flow bottom nav
 *   md+        : expandable icon rail (icons-only <-> 240px with labels)
 */
export function AppShell({ nav, user, children }: { nav: NavItem[]; user: { name: string; email?: string; role: string }; children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [railExpanded, setRailExpanded] = React.useState(true);
  const pathname = usePathname();
  const db = useDb();
  const me = useCurrentUser();
  // The demo store only exists in the browser; the SSR pass renders a
  // throwaway seed whose relative dates differ from the client's, so every
  // data-driven surface waits for hydration to avoid React mismatch errors.
  const hydrated = useHydrated();

  React.useEffect(() => {
    if (window.innerWidth < 1024) setRailExpanded(false);
  }, []);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Live badges: unanswered threads, tasks due today, agent items needing review.
  const badges = React.useMemo(() => {
    if (!hydrated) return {} as Record<string, number>;
    const now = Date.now();
    const attention = db.enquiries.filter((e) => e.needsAttention && !["lost", "non_lead", "completed"].includes(e.stage)).length;
    const dueTasks = db.tasks.filter((t) => t.status === "open" && new Date(t.dueAt).getTime() <= now + 86400000 && (!t.assignedTo || t.assignedTo === me.sub || me.role === "ADMIN" || me.role === "MANAGER")).length;
    const review = db.agentEvents.filter((e) => e.status === "needs_review").length;
    const unanswered = db.messages.filter((m) => m.status === "draft").length;
    return { "/enquiries": attention, "/tasks": dueTasks, "/agents": review, "/inbox": unanswered } as Record<string, number>;
  }, [db, me, hydrated]);

  const hasMore = nav.length > 5;
  const primary = hasMore ? nav.slice(0, 4) : nav.slice(0, 5);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <aside className={cn("no-print hidden min-h-0 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex", railExpanded ? "w-60" : "w-16")}>
        {railExpanded ? <Brand role={user.role} /> : <BrandOnly />}
        <NavList nav={nav} collapsed={!railExpanded} badges={badges} />
        <button
          onClick={() => setRailExpanded((v) => !v)}
          aria-label={railExpanded ? "Collapse sidebar" : "Expand sidebar"}
          className={cn("mx-3 mb-1 flex min-h-[40px] items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-white/5 hover:text-white", !railExpanded && "justify-center px-0")}
        >
          {railExpanded ? (
            <>
              <PanelLeftClose className="h-[18px] w-[18px] shrink-0" /> Collapse
            </>
          ) : (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" />
          )}
        </button>
        <UserFooter user={user} collapsed={!railExpanded} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex shrink-0 items-center gap-3 border-b border-border bg-sidebar px-4 pt-safe text-white md:hidden">
          <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-md hover:bg-white/10">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <BrandMark className="h-7 w-7" />
            <BrandWordmark />
          </div>
        </header>

        <main data-scroll-container className="min-h-0 flex-1 overflow-y-auto">
          {hydrated ? children : <PageSkeleton />}
        </main>

        <DemoFooter />

        <nav className="no-print flex shrink-0 items-stretch border-t border-border bg-card pb-safe md:hidden">
          {primary.map((item) => {
            const Icon = NAV_ICONS[item.icon] ?? LayoutDashboard;
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} className={cn("flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            );
          })}
          {hasMore && (
            <button onClick={() => setDrawerOpen(true)} className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium text-muted-foreground" aria-label="More menu items">
              <MoreHorizontal className="h-5 w-5" />
              <span>More</span>
            </button>
          )}
        </nav>
      </div>

      <Sheet open={drawerOpen} onClose={() => setDrawerOpen(false)} side="left" ariaLabel="Navigation menu" className="bg-sidebar text-sidebar-foreground">
        <div className="flex h-full min-h-0 flex-col pt-safe">
          <div className="flex items-center justify-between pr-2">
            <Brand role={user.role} />
            <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-white/10 hover:text-white">
              <X className="h-6 w-6" />
            </button>
          </div>
          <NavList nav={nav} onNavigate={() => setDrawerOpen(false)} badges={badges} />
          <UserFooter user={user} />
        </div>
      </Sheet>
    </div>
  );
}

function Brand({ role }: { role: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <BrandMark />
      <div className="leading-tight">
        <BrandWordmark />
        <div className="text-[11px] text-sidebar-foreground/60">CRM · {role}</div>
      </div>
    </div>
  );
}

function BrandOnly() {
  return (
    <div className="flex items-center justify-center py-4">
      <BrandMark />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse-soft space-y-4 p-4 md:p-6" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-64 rounded bg-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-muted" />
    </div>
  );
}

function DemoFooter() {
  return (
    <div className="no-print flex shrink-0 items-center justify-between gap-2 border-t border-border bg-card px-4 py-1.5 text-[11px] text-muted-foreground">
      <span className="truncate">Interactive demo · all data is generated and lives only in this browser</span>
      <button
        onClick={() => {
          if (confirm("Reset the demo data to a fresh seed? Your changes in this browser will be lost.")) resetDemoData();
        }}
        className="flex shrink-0 items-center gap-1 rounded px-2 py-0.5 hover:bg-secondary hover:text-foreground"
      >
        <RotateCcw className="h-3 w-3" /> Reset demo data
      </button>
    </div>
  );
}
