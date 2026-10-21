"use client";

import { useState } from "react";
import { ShieldCheck, Briefcase, Compass, ClipboardList, IndianRupee, Eye, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_USERS } from "@/lib/demo/seed-static";
import { setClientSessionCookie } from "@/lib/demo/session";
import { DEMO_SESSION_EVENT } from "@/lib/demo/session-client";
import { ROLE_LABEL, type AppRole } from "@/lib/rbac";

const ROLE_ICON: Record<AppRole, LucideIcon> = {
  ADMIN: ShieldCheck,
  MANAGER: Briefcase,
  SALES: Compass,
  OPS: ClipboardList,
  FINANCE: IndianRupee,
  VIEWER: Eye,
};

const ROLE_BLURB: Record<AppRole, string> = {
  ADMIN: "Everything — team, settings, agent configuration, all reports.",
  MANAGER: "Pipeline oversight, approvals, campaigns, reports across consultants.",
  SALES: "Own enquiries, itineraries, inbox, calls — the consultant's day.",
  OPS: "Trips, travellers, documents, visas, suppliers, pre-departure.",
  FINANCE: "Payments, invoices, collections, supplier payables, revenue reports.",
  VIEWER: "Read-only across the app — ideal for a walkthrough.",
};

export function RolePicker() {
  const [signingIn, setSigningIn] = useState<string | null>(null);

  function handleSignIn(user: (typeof DEMO_USERS)[number]) {
    setSigningIn(user.sub);
    setClientSessionCookie({ sub: user.sub, name: user.name, email: user.email, role: user.role });
    window.dispatchEvent(new Event(DEMO_SESSION_EVENT));
    window.location.href = "/";
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {DEMO_USERS.filter((u) => u.role !== "SALES" || u.sub === "u_rohan").map((user) => {
        const Icon = ROLE_ICON[user.role];
        return (
          <button
            key={user.sub}
            onClick={() => handleSignIn(user)}
            disabled={signingIn !== null}
            className={cn(
              "flex items-start gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60",
              signingIn === user.sub && "border-brand-500 bg-brand-50",
            )}
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{user.name}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">{ROLE_LABEL[user.role]}</span>
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{ROLE_BLURB[user.role]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
