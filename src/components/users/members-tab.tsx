"use client";

import * as React from "react";
import { KeyRound, Pencil, UserMinus, UserPlus, Copy } from "lucide-react";
import { Avatar, Badge, Button, Card, Dialog, Input, Select } from "@/components/ui";
import { Field, useToast } from "@/components/shared";
import { ROLE_LABEL, type AppRole } from "@/lib/rbac";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity } from "@/lib/demo/queries";
import { cn, copyToClipboard, relativeTime } from "@/lib/utils";
import type { DemoData, Language, User } from "@/lib/demo/types";
import { LANGUAGE_LABEL } from "@/components/templates/template-editor";

const ROLE_CLASS: Record<AppRole, string> = {
  ADMIN: "bg-brand-800 text-white",
  MANAGER: "bg-brand-100 text-brand-800",
  SALES: "bg-saffron-100 text-saffron-700",
  OPS: "bg-indigo-100 text-indigo-800",
  FINANCE: "bg-emerald-100 text-emerald-800",
  VIEWER: "bg-zinc-100 text-zinc-700",
};

type Draft = { name: string; email: string; role: AppRole; title: string; specialities: string[]; languages: Language[]; phone: string };
const EMPTY: Draft = { name: "", email: "", role: "SALES", title: "Trip Consultant", specialities: [], languages: ["en"], phone: "" };

function Chips<T extends string>({ options, value, onChange, render }: { options: T[]; value: T[]; onChange: (v: T[]) => void; render: (o: T) => React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])} className={cn("min-h-[32px] rounded-full border px-2.5 text-xs font-medium", on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
            {render(o)}
          </button>
        );
      })}
    </div>
  );
}

function MemberDialog({ open, onClose, db, initial, onSave }: { open: boolean; onClose: () => void; db: DemoData; initial: Draft; onSave: (d: Draft) => void }) {
  const [d, setD] = React.useState<Draft>(initial);
  React.useEffect(() => {
    if (open) setD(initial);
  }, [open, initial]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open={open} onClose={onClose} title={initial.name ? "Edit member" : "Invite member"} className="md:max-w-lg">
      <div className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={d.name} onChange={(e) => set("name", e.target.value)} autoFocus />
          </Field>
          <Field label="Email">
            <Input type="email" value={d.email} onChange={(e) => set("email", e.target.value)} placeholder="name@wishtrip.co" />
          </Field>
          <Field label="Role">
            <Select value={d.role} onChange={(e) => set("role", e.target.value as AppRole)}>
              {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title">
            <Input value={d.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Phone" className="sm:col-span-2">
            <Input value={d.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" />
          </Field>
        </div>
        <Field label="Specialities">
          <Chips options={db.destinations.map((x) => x.id)} value={d.specialities} onChange={(v) => set("specialities", v)} render={(id) => { const x = db.destinations.find((y) => y.id === id); return `${x?.emoji} ${x?.name}`; }} />
        </Field>
        <Field label="Languages">
          <Chips options={Object.keys(LANGUAGE_LABEL) as Language[]} value={d.languages} onChange={(v) => set("languages", v)} render={(l) => LANGUAGE_LABEL[l]} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(d)} disabled={!d.name.trim() || !d.email.trim()}>
            {initial.name ? "Save" : "Send invite"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function MembersTab({ db, me, canManage }: { db: DemoData; me: { sub: string; name: string }; canManage: boolean }) {
  const { toast, node } = useToast();
  const [editing, setEditing] = React.useState<User | null>(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [resetFor, setResetFor] = React.useState<User | null>(null);
  const tempPassword = React.useMemo(() => (resetFor ? `wt-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}` : ""), [resetFor]);

  const initial: Draft = editing ? { name: editing.name, email: editing.email, role: editing.role, title: editing.title, specialities: editing.specialities, languages: editing.languages, phone: editing.phone ?? "" } : EMPTY;

  const save = (d: Draft) => {
    mutateDb((x) => {
      if (editing) {
        const u = x.users.find((k) => k.sub === editing.sub);
        if (u) Object.assign(u, { name: d.name.trim(), email: d.email.trim(), role: d.role, title: d.title, specialities: d.specialities, languages: d.languages, phone: d.phone || undefined });
        logActivity(x, { actor: me.name, actorKind: "user", type: "team", text: `Updated team member ${d.name}` });
      } else {
        x.users.push({ sub: newId("u"), name: d.name.trim(), email: d.email.trim(), role: d.role, title: d.title, specialities: d.specialities, languages: d.languages, phone: d.phone || undefined, online: false, active: true, createdAt: nowIso() });
        logActivity(x, { actor: me.name, actorKind: "user", type: "team", text: `Invited ${d.name} as ${ROLE_LABEL[d.role]}` });
      }
    });
    toast(editing ? "Member updated" : "Invite sent");
    setEditing(null);
    setInviteOpen(false);
  };
  const toggleActive = (u: User) => {
    mutateDb((x) => {
      const k = x.users.find((y) => y.sub === u.sub);
      if (k) {
        k.active = !k.active;
        if (!k.active) k.online = false;
      }
      logActivity(x, { actor: me.name, actorKind: "user", type: "team", text: `${u.active ? "Deactivated" : "Reactivated"} ${u.name}` });
    });
    toast(u.active ? "Member deactivated" : "Member reactivated");
  };

  const sorted = [...db.users].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  // Most recent thing each member did, from the activity log (user actions
  // only). Not memoised: the store mutates arrays in place.
  const lastActive = new Map<string, string>();
  for (const a of db.activities) {
    if (a.actorKind !== "user" || !a.actorSub) continue;
    const prev = lastActive.get(a.actorSub);
    if (!prev || a.at > prev) lastActive.set(a.actorSub, a.at);
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => { setEditing(null); setInviteOpen(true); }}>
            <UserPlus className="h-4 w-4" /> Invite member
          </Button>
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-secondary/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Member</th>
                <th className="px-3 py-2 text-left font-semibold">Contact</th>
                <th className="px-3 py-2 text-left font-semibold">Role</th>
                <th className="px-3 py-2 text-left font-semibold">Specialities</th>
                <th className="px-3 py-2 text-left font-semibold">Languages</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Last active</th>
                {canManage && <th className="px-3 py-2 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((u) => (
                <tr key={u.sub} className={cn(!u.active && "opacity-60")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Avatar name={u.name} />
                        <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card", u.online ? "bg-emerald-500" : "bg-zinc-300")} title={u.online ? "Online" : "Offline"} />
                      </div>
                      <div>
                        <div className="font-medium">{u.name}{u.sub === me.sub && <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>}</div>
                        <div className="text-[11px] text-muted-foreground">{u.title}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div>{u.email}</div>
                    <div className="text-muted-foreground">{u.phone ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge className={ROLE_CLASS[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {u.specialities.length === 0 ? <span className="text-muted-foreground">—</span> : u.specialities.map((s) => db.destinations.find((d) => d.id === s)).filter(Boolean).map((d) => (
                      <span key={d!.id} className="mr-1.5 whitespace-nowrap">
                        {d!.emoji} {d!.name}
                      </span>
                    ))}
                  </td>
                  <td className="px-3 py-3 text-xs">{u.languages.map((l) => LANGUAGE_LABEL[l]).join(", ")}</td>
                  <td className="px-3 py-3 text-xs">{u.active ? <span className="text-emerald-700">Active</span> : <span className="text-muted-foreground">Deactivated</span>}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground" title={lastActive.get(u.sub)}>{lastActive.has(u.sub) ? relativeTime(lastActive.get(u.sub)!) : "—"}</td>
                  {canManage && (
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(u); setInviteOpen(true); }} aria-label="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setResetFor(u)} aria-label="Reset password">
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className={u.active ? "text-rose-600" : "text-emerald-700"} onClick={() => toggleActive(u)} disabled={u.sub === me.sub} aria-label={u.active ? "Deactivate" : "Reactivate"}>
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <MemberDialog open={inviteOpen} onClose={() => { setInviteOpen(false); setEditing(null); }} db={db} initial={initial} onSave={save} />

      <Dialog open={!!resetFor} onClose={() => setResetFor(null)} title="Reset password">
        <div className="space-y-3 p-4 text-sm">
          <p>
            A temporary password for <span className="font-semibold">{resetFor?.name}</span>. They&apos;ll be asked to change it on next sign-in. In production this is a Keycloak &ldquo;Update password&rdquo; required action.
          </p>
          <div className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2 font-mono text-base">
            {tempPassword}
            <Button size="sm" variant="ghost" onClick={async () => { await copyToClipboard(tempPassword); toast("Copied"); }} aria-label="Copy">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => { setResetFor(null); toast("Temporary password issued"); }}>Done</Button>
          </div>
        </div>
      </Dialog>
      {node}
    </div>
  );
}
