"use client";

import * as React from "react";
import { AlarmClockPlus, Check, Plus, Trash2 } from "lucide-react";
import type { Enquiry, TaskKind, TaskPriority } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity, tasksForEnquiry, userName } from "@/lib/demo/queries";
import { TASK_KIND_LABEL } from "@/lib/pipeline";
import { Button, Input, Select } from "@/components/ui";
import { Field } from "@/components/shared";
import { cn, addDays, formatDateTime, relativeTime } from "@/lib/utils";
import { isConsultant, touch, type Actor } from "./booking-actions";

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TasksTab({ enquiry: e, actor, canEdit, onToast }: { enquiry: Enquiry; actor: Actor; canEdit: boolean; onToast: (m: string) => void }) {
  const db = useDb();
  const tasks = tasksForEnquiry(db, e.id);
  const open = tasks.filter((t) => t.status === "open" || t.status === "snoozed");
  const closed = tasks.filter((t) => t.status === "done" || t.status === "cancelled").sort((a, b) => (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt));
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [kind, setKind] = React.useState<TaskKind>("follow_up");
  const [due, setDue] = React.useState(() => toLocalInput(addDays(new Date(), 1)));
  const [assignee, setAssignee] = React.useState(e.assignedTo ?? actor.sub);
  const [priority, setPriority] = React.useState<TaskPriority>("normal");
  const assignees = db.users.filter((u) => u.active && (isConsultant(u) || u.role === "OPS" || u.role === "FINANCE" || u.role === "ADMIN"));

  const update = (id: string, fn: (t: (typeof tasks)[number]) => void, msg: string) => {
    mutateDb((d) => {
      const t = d.tasks.find((x) => x.id === id);
      if (t) fn(t);
      const enq = d.enquiries.find((x) => x.id === e.id);
      if (enq) touch(enq);
    });
    onToast(msg);
  };

  function add(ev: React.FormEvent) {
    ev.preventDefault();
    if (!title.trim()) return;
    mutateDb((d) => {
      d.tasks.push({ id: newId("task"), title: title.trim(), kind, enquiryId: e.id, travellerId: e.travellerId, tripId: e.tripId, assignedTo: assignee || undefined, dueAt: new Date(due).toISOString(), status: "open", priority, createdBy: actor.sub, createdAt: nowIso() });
      logActivity(d, { actor: actor.name, actorKind: "user", type: "task_created", text: `Task added: ${title.trim()}`, enquiryId: e.id, travellerId: e.travellerId });
      const enq = d.enquiries.find((x) => x.id === e.id);
      if (enq) touch(enq);
    });
    setTitle("");
    setAdding(false);
    onToast("Task added");
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Open tasks <span className="text-muted-foreground">({open.length})</span></h3>
        {canEdit && !adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add task</Button>}
      </div>

      {adding && (
        <form onSubmit={add} className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <Field label="Title"><Input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="Call back about dates" autoFocus required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              <Select value={kind} onChange={(ev) => setKind(ev.target.value as TaskKind)}>
                {(Object.keys(TASK_KIND_LABEL) as TaskKind[]).map((k) => <option key={k} value={k}>{TASK_KIND_LABEL[k]}</option>)}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={priority} onChange={(ev) => setPriority(ev.target.value as TaskPriority)}>
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
              </Select>
            </Field>
            <Field label="Due"><Input type="datetime-local" value={due} onChange={(ev) => setDue(ev.target.value)} required /></Field>
            <Field label="Assign to">
              <Select value={assignee} onChange={(ev) => setAssignee(ev.target.value)}>
                <option value="">Unassigned</option>
                {assignees.map((u) => <option key={u.sub} value={u.sub}>{u.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" size="sm">Add task</Button>
          </div>
        </form>
      )}

      <ul className="space-y-2">
        {open.map((t) => {
          const overdue = new Date(t.dueAt).getTime() < Date.now();
          return (
            <li key={t.id} className={cn("rounded-lg border bg-card p-3", overdue ? "border-rose-200" : "border-border")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {TASK_KIND_LABEL[t.kind]} · <span className={cn(overdue && "font-semibold text-rose-600")}>{overdue ? "Overdue · " : "Due "}{relativeTime(t.dueAt)}</span> · {t.assignedTo ? userName(db, t.assignedTo) : "Unassigned"}
                    {t.priority === "high" && <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-700">HIGH</span>}
                    {t.status === "snoozed" && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">Snoozed</span>}
                  </p>
                  {t.notes && <p className="mt-1 text-xs text-muted-foreground">{t.notes}</p>}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="secondary" title="Mark done" onClick={() => update(t.id, (x) => { x.status = "done"; x.doneAt = nowIso(); }, "Task done")}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" title="Snooze 1 day" onClick={() => update(t.id, (x) => { x.dueAt = addDays(new Date(Math.max(Date.now(), new Date(x.dueAt).getTime())), 1).toISOString(); x.status = "snoozed"; }, "Snoozed to tomorrow")}><AlarmClockPlus className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" title="Delete" className="text-rose-600" onClick={() => { mutateDb((d) => { d.tasks = d.tasks.filter((x) => x.id !== t.id); }); onToast("Task deleted"); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {open.length === 0 && <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No open tasks. The follow-up agent will nudge automatically.</li>}
      </ul>

      {closed.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Done / cancelled ({closed.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {closed.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                <span className={cn("truncate", t.status === "done" ? "line-through" : "italic")}>{t.title}</span>
                <span className="shrink-0 text-muted-foreground">{t.status === "done" ? `done ${formatDateTime(t.doneAt)}` : "cancelled"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
