"use client";

import * as React from "react";
import { Check, Eye, RotateCcw, Save } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/shared";
import { can, ROLE_LABEL, ROLE_PERMISSIONS, type AppRole, type Permission } from "@/lib/rbac";
import { STAGES } from "@/lib/pipeline";
import type { EnquiryStage, Settings } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { logActivity } from "@/lib/demo/queries";
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

type StageVisibility = Settings["stageVisibility"];

/** Always sees every column: an admin who unticked themselves would lose the board and this page's context for putting it back. */
const ALWAYS_VISIBLE: AppRole = "ADMIN";

const sameRoles = (a: AppRole[], b: AppRole[]) => a.length === b.length && a.every((r) => b.includes(r));
const viewersFor = (rules: StageVisibility, stage: EnquiryStage): AppRole[] => rules[stage] ?? ROLES;

/** Store a stage only when it differs from "everyone"; ADMIN is always included. */
function normalise(rules: StageVisibility): StageVisibility {
  const out: StageVisibility = {};
  for (const s of STAGES) {
    const roles = rules[s.id];
    if (!roles) continue;
    const withAdmin = roles.includes(ALWAYS_VISIBLE) ? roles : [...roles, ALWAYS_VISIBLE];
    if (!sameRoles(withAdmin, ROLES)) out[s.id] = ROLES.filter((r) => withAdmin.includes(r));
  }
  return out;
}

function StageVisibilityCard() {
  const db = useDb();
  const me = useCurrentUser();
  const { toast, node } = useToast();
  const canEdit = can(me.role, "users.manage");
  const saved = db.settings.stageVisibility ?? {};
  const [draft, setDraft] = React.useState<StageVisibility>(() => normalise(saved));
  const savedKey = JSON.stringify(normalise(saved));
  React.useEffect(() => {
    // Follow the store (another tab, a demo reset) when nothing is being edited here.
    setDraft(normalise(JSON.parse(savedKey) as StageVisibility));
  }, [savedKey]);
  const dirty = JSON.stringify(draft) !== savedKey;

  const toggle = (stage: EnquiryStage, role: AppRole) => {
    if (!canEdit || role === ALWAYS_VISIBLE) return;
    setDraft((prev) => {
      const cur = viewersFor(prev, stage);
      const next = cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role];
      return normalise({ ...prev, [stage]: next });
    });
  };

  const save = () => {
    const changed = STAGES.filter((s) => !sameRoles(viewersFor(draft, s.id), viewersFor(saved, s.id)));
    mutateDb((d) => {
      d.settings.stageVisibility = normalise(draft);
      logActivity(d, {
        actor: me.name || "You",
        actorSub: me.sub,
        actorKind: "user",
        type: "stage_visibility_changed",
        text: `Changed who sees ${changed.map((s) => s.label).join(", ") || "stages"}: ${changed.map((s) => `${s.label} → ${viewersFor(draft, s.id).length === ROLES.length ? "everyone" : viewersFor(draft, s.id).map((r) => ROLE_LABEL[r]).join("/")}`).join("; ")}`,
      });
    });
    toast("Stage visibility saved");
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4 text-brand-600" /> Who sees which stage</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Hides the enquiries inside a column for a role — never the column itself, and it never grants editing. Administrators always see everything.</p>
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!dirty} onClick={() => setDraft(normalise(saved))}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
            <Button size="sm" disabled={!dirty} onClick={save}><Save className="h-3.5 w-3.5" /> Save</Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Read-only — only administrators change this.</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-secondary/60 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Stage</th>
              {ROLES.map((r) => <th key={r} className="px-2 py-2 text-center font-semibold">{ROLE_LABEL[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {STAGES.map((s) => {
              const viewers = viewersFor(draft, s.id);
              const restricted = viewers.length < ROLES.length;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2" title={s.description}>
                    <div className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.accent)} />{s.label}{restricted && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">restricted</span>}</div>
                    <div className="text-[11px] text-muted-foreground">{s.description}</div>
                  </td>
                  {ROLES.map((r) => {
                    const on = viewers.includes(r);
                    const fixed = r === ALWAYS_VISIBLE;
                    return (
                      <td key={r} className="px-2 py-2 text-center">
                        <label className={cn("inline-flex h-10 w-10 items-center justify-center rounded-md", canEdit && !fixed ? "cursor-pointer hover:bg-secondary" : "cursor-default")}>
                          <input type="checkbox" className="h-4 w-4 accent-primary" checked={on} disabled={!canEdit || fixed} onChange={() => toggle(s.id, r)} aria-label={`${ROLE_LABEL[r]} sees ${s.label}`} title={fixed ? "Administrators always see every stage" : undefined} />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {node}
    </Card>
  );
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
      <StageVisibilityCard />
    </div>
  );
}
