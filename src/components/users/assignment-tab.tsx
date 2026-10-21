"use client";

import * as React from "react";
import { Shuffle } from "lucide-react";
import { Avatar, Button, Card, Select } from "@/components/ui";
import { Field, Toggle, SectionTitle, useToast } from "@/components/shared";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity } from "@/lib/demo/queries";
import { isOpen } from "@/lib/demo/queries";
import type { DemoData, Enquiry, Settings, User } from "@/lib/demo/types";

type Strategy = Settings["assignment"]["strategy"];

const STRATEGY_INFO: Record<Strategy, { label: string; why: string }> = {
  round_robin: { label: "Round robin", why: "Each new enquiry goes to the next online consultant in turn. Fair and simple; ignores expertise." },
  destination: { label: "Destination specialist", why: "Match the enquiry's destination to a consultant's specialities; ties broken by lightest load. Best conversion in our data." },
  least_busy: { label: "Least busy", why: "Whoever has the fewest open enquiries right now. Keeps response times flat during spikes." },
  manual: { label: "Manual", why: "New enquiries stay unassigned until a manager picks them up from the board." },
};

export function pickConsultant(strategy: Strategy, e: Enquiry, consultants: User[], load: Map<string, number>, cursor: { i: number }): User | undefined {
  const pool = consultants.filter((u) => u.active);
  if (!pool.length || strategy === "manual") return undefined;
  const byLoad = (a: User, b: User) => (load.get(a.sub) ?? 0) - (load.get(b.sub) ?? 0);
  if (strategy === "round_robin") {
    const online = pool.filter((u) => u.online);
    const list = online.length ? online : pool;
    return list[cursor.i++ % list.length];
  }
  if (strategy === "destination") {
    const spec = pool.filter((u) => u.specialities.includes(e.destinationId)).sort(byLoad);
    return spec[0] ?? [...pool].sort(byLoad)[0];
  }
  return [...pool].sort(byLoad)[0];
}

export function AssignmentTab({ db, me, canManage }: { db: DemoData; me: { sub: string; name: string }; canManage: boolean }) {
  const { toast, node } = useToast();
  const { strategy, autoAssign } = db.settings.assignment;
  const consultants = db.users.filter((u) => u.role === "SALES" || u.role === "MANAGER");
  const today = new Date().toDateString();
  const unassigned = db.enquiries.filter((e) => isOpen(e) && !e.assignedTo);

  const setStrategy = (s: Strategy) => {
    mutateDb((d) => {
      d.settings.assignment.strategy = s;
    });
    toast(`Strategy: ${STRATEGY_INFO[s].label}`);
  };
  const setAuto = (v: boolean) => {
    mutateDb((d) => {
      d.settings.assignment.autoAssign = v;
    });
    toast(v ? "Auto-assign on" : "Auto-assign off");
  };
  const rebalance = () => {
    let n = 0;
    mutateDb((d) => {
      const load = new Map<string, number>();
      for (const e of d.enquiries) if (isOpen(e) && e.assignedTo) load.set(e.assignedTo, (load.get(e.assignedTo) ?? 0) + 1);
      const cursor = { i: 0 };
      const pool = d.users.filter((u) => u.role === "SALES" || u.role === "MANAGER");
      for (const e of d.enquiries) {
        if (!isOpen(e) || e.assignedTo) continue;
        const u = pickConsultant(d.settings.assignment.strategy, e, pool, load, cursor);
        if (!u) continue;
        e.assignedTo = u.sub;
        e.updatedAt = nowIso();
        load.set(u.sub, (load.get(u.sub) ?? 0) + 1);
        n++;
        d.agentEvents.unshift({ id: newId("evt"), agent: "assignment", at: nowIso(), enquiryId: e.id, travellerId: e.travellerId, action: "Rebalance: assigned consultant", detail: `${e.destination} enquiry ${e.ref} → ${u.name} (${STRATEGY_INFO[d.settings.assignment.strategy].label.toLowerCase()}, ${load.get(u.sub)} open)`, confidence: 1, status: "auto" });
        logActivity(d, { actor: "Assignment agent", actorKind: "ai", type: "assignment", text: `Assigned ${e.ref} to ${u.name}`, enquiryId: e.id, travellerId: e.travellerId });
      }
      if (n) logActivity(d, { actor: me.name, actorKind: "user", type: "assignment", text: `Rebalanced ${n} unassigned enquir${n === 1 ? "y" : "ies"} (${STRATEGY_INFO[d.settings.assignment.strategy].label})` });
    });
    toast(n ? `Assigned ${n} enquir${n === 1 ? "y" : "ies"}` : strategy === "manual" ? "Manual strategy — nothing assigned" : "Nothing to assign");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="space-y-4 p-4">
          <SectionTitle>Strategy</SectionTitle>
          <Field label="Assign new enquiries by">
            <Select value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)} disabled={!canManage}>
              {(Object.keys(STRATEGY_INFO) as Strategy[]).map((s) => (
                <option key={s} value={s}>
                  {STRATEGY_INFO[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-muted-foreground">{STRATEGY_INFO[strategy].why}</p>
          <Toggle checked={autoAssign} onChange={setAuto} label="Auto-assign on arrival (assignment agent)" disabled={!canManage} />
          <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{unassigned.length}</span> open enquir{unassigned.length === 1 ? "y is" : "ies are"} unassigned right now.
            {canManage && (
              <div className="mt-2">
                <Button size="sm" onClick={rebalance} disabled={unassigned.length === 0}>
                  <Shuffle className="h-3.5 w-3.5" /> Rebalance unassigned
                </Button>
              </div>
            )}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <div className="p-4 pb-2">
            <SectionTitle>Consultant load</SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-secondary/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Consultant</th>
                  <th className="px-3 py-2 text-right font-semibold">Open</th>
                  <th className="px-3 py-2 text-right font-semibold">New today</th>
                  <th className="px-3 py-2 text-left font-semibold">Destinations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {consultants.map((u) => {
                  const mine = db.enquiries.filter((e) => e.assignedTo === u.sub && isOpen(e));
                  const todayNew = mine.filter((e) => new Date(e.createdAt).toDateString() === today).length;
                  return (
                    <tr key={u.sub} className={!u.active ? "opacity-50" : undefined}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Avatar name={u.name} className="h-7 w-7 text-[10px]" />
                            <span className={"absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card " + (u.online ? "bg-emerald-500" : "bg-zinc-300")} />
                          </div>
                          <span className="font-medium">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{mine.length}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{todayNew}</td>
                      <td className="px-3 py-2 text-xs">{u.specialities.map((s) => db.destinations.find((d) => d.id === s)?.emoji).join(" ") || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {node}
    </div>
  );
}
