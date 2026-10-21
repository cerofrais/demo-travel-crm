"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Card } from "@/components/ui";
import { ROLE_LABEL, ROLE_PERMISSIONS, type AppRole, type Permission } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const ROLES = Object.keys(ROLE_LABEL) as AppRole[];

const GROUP_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  enquiries: "Enquiries",
  itineraries: "Itineraries",
  trips: "Trips",
  travellers: "Travellers",
  payments: "Payments",
  suppliers: "Suppliers",
  inbox: "Inbox",
  messaging: "Messaging",
  agents: "AI agents",
  campaigns: "Campaigns",
  templates: "Templates",
  tasks: "Tasks",
  reports: "Reports",
  users: "Team",
  settings: "Settings",
  activity: "Activity log",
};

const ACTION_LABEL: Record<string, string> = {
  view: "View",
  manage: "Manage (create, edit, delete, reassign)",
  work: "Work own + unassigned",
  edit: "Edit",
  send: "Send messages",
  configure: "Configure",
  review: "Review & approve AI output",
  all: "All data incl. margin",
};

function humanize(p: Permission): { group: string; action: string } {
  const [g, a] = p.split(".");
  return { group: GROUP_LABEL[g] ?? g, action: ACTION_LABEL[a] ?? a };
}

export function RolesTab() {
  const all = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat())) as Permission[];
  const groups = new Map<string, Permission[]>();
  for (const p of all) {
    const g = p.split(".")[0];
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(p);
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-border bg-secondary/50 px-4 py-2 text-xs text-muted-foreground">Roles map 1:1 to Keycloak realm roles in production. Permissions are read-only here; change a member&apos;s role under Members.</p>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Permission</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-2 py-2 text-center font-semibold">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...groups.entries()].map(([g, perms]) => (
                <React.Fragment key={g}>
                  <tr className="bg-sand-50">
                    <td colSpan={ROLES.length + 1} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {GROUP_LABEL[g] ?? g}
                    </td>
                  </tr>
                  {perms.map((p) => (
                    <tr key={p} className="border-t border-border">
                      <td className="px-4 py-2">
                        <div>{humanize(p).action}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{p}</div>
                      </td>
                      {ROLES.map((r) => {
                        const ok = ROLE_PERMISSIONS[r].includes(p);
                        return (
                          <td key={r} className={cn("px-2 py-2 text-center", ok ? "text-emerald-600" : "text-muted-foreground/30")}>
                            {ok ? <Check className="mx-auto h-4 w-4" /> : "·"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
