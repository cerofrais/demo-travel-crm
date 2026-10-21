"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarCheck, CheckCircle2, ChevronDown, ChevronRight, ListTodo, Plus, ShieldCheck, Timer, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button, Card, Input, Select } from "@/components/ui";
import { EmptyState, StatCard, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { mutateDb, nowIso } from "@/lib/demo/store";
import { enquiryById, logActivity, travellerById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { TASK_KIND_LABEL } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import type { Task, TaskKind } from "@/lib/demo/types";
import { TaskRow } from "./task-row";
import { NewTaskDialog } from "./new-task-dialog";
import { bucketOf, snoozeTarget, type TaskBucket } from "./task-helpers";

const SECTION_META: Record<Exclude<TaskBucket, "done">, { label: string; tone: string }> = {
  overdue: { label: "Overdue", tone: "text-rose-600" },
  today: { label: "Today", tone: "text-amber-600" },
  upcoming: { label: "Upcoming", tone: "text-brand-600" },
  approval: { label: "Approvals", tone: "text-indigo-600" },
};

export function TasksWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const router = useRouter();
  const params = useSearchParams();
  const focusEnquiryId = params.get("enquiry");
  const { toast, node } = useToast();

  const canManage = can(me.role, "tasks.manage");
  const canApprove = me.role === "ADMIN" || me.role === "MANAGER";
  const seesAllByDefault = me.role !== "SALES";

  const [scope, setScope] = React.useState<"me" | "all">(seesAllByDefault ? "all" : "me");
  React.useEffect(() => setScope(seesAllByDefault ? "all" : "me"), [seesAllByDefault]);
  const [assignee, setAssignee] = React.useState("");
  const [kind, setKind] = React.useState<TaskKind | "">("");
  const [search, setSearch] = React.useState("");
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({ done: true });
  const [newOpen, setNewOpen] = React.useState(false);

  const focusEnquiry = enquiryById(db, focusEnquiryId);

  const filtered = React.useMemo(() => {
    const s = search.trim().toLowerCase();
    return db.tasks.filter((t) => {
      if (focusEnquiryId && t.enquiryId !== focusEnquiryId) return false;
      if (scope === "me" && t.assignedTo !== me.sub && !(t.kind === "approval" && canApprove)) return false;
      if (assignee && (assignee === "unassigned" ? t.assignedTo : t.assignedTo !== assignee)) return false;
      if (kind && t.kind !== kind) return false;
      if (s) {
        const trav = travellerById(db, t.travellerId ?? enquiryById(db, t.enquiryId)?.travellerId);
        const hay = `${t.title} ${trav?.fullName ?? ""} ${enquiryById(db, t.enquiryId)?.ref ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [db, focusEnquiryId, scope, me.sub, canApprove, assignee, kind, search]);

  const buckets = React.useMemo(() => {
    const out: Record<TaskBucket, Task[]> = { overdue: [], today: [], upcoming: [], approval: [], done: [] };
    for (const t of filtered) out[bucketOf(t)].push(t);
    out.overdue.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    out.today.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    out.upcoming.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    out.approval.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    out.done = out.done.sort((a, b) => (b.doneAt ?? b.dueAt).localeCompare(a.doneAt ?? a.dueAt)).slice(0, 20);
    return out;
  }, [filtered]);

  const weekAgo = Date.now() - 7 * 86400000;
  const completedThisWeek = db.tasks.filter((t) => t.status === "done" && t.doneAt && new Date(t.doneAt).getTime() >= weekAgo && (scope === "all" || t.assignedTo === me.sub)).length;

  // ----- mutations -----
  const markDone = (t: Task) => {
    mutateDb((d) => {
      const x = d.tasks.find((k) => k.id === t.id);
      if (!x) return;
      x.status = "done";
      x.doneAt = nowIso();
      logActivity(d, { actor: me.name, actorKind: "user", type: "task_done", text: `Completed task "${x.title}"`, enquiryId: x.enquiryId, tripId: x.tripId, travellerId: x.travellerId });
    });
    toast("Task completed");
  };
  const snooze = (t: Task, option: "1h" | "tomorrow" | "3d") => {
    mutateDb((d) => {
      const x = d.tasks.find((k) => k.id === t.id);
      if (!x) return;
      x.dueAt = snoozeTarget(option);
      x.status = "snoozed";
    });
    toast(option === "1h" ? "Snoozed for an hour" : option === "tomorrow" ? "Snoozed until tomorrow" : "Snoozed for 3 days");
  };
  const reassign = (t: Task, sub: string) => {
    mutateDb((d) => {
      const x = d.tasks.find((k) => k.id === t.id);
      if (!x) return;
      x.assignedTo = sub || undefined;
      const who = sub ? d.users.find((u) => u.sub === sub)?.name ?? sub : "Unassigned";
      logActivity(d, { actor: me.name, actorKind: "user", type: "task_reassigned", text: `Reassigned "${x.title}" → ${who}`, enquiryId: x.enquiryId, travellerId: x.travellerId });
    });
    toast("Task reassigned");
  };
  const remove = (t: Task) => {
    mutateDb((d) => {
      d.tasks = d.tasks.filter((k) => k.id !== t.id);
    });
    toast("Task deleted");
  };
  const decide = (t: Task, decision: "approved" | "denied") => {
    mutateDb((d) => {
      const x = d.tasks.find((k) => k.id === t.id);
      if (!x || !x.approval) return;
      x.approval.decision = decision;
      x.approval.decidedBy = me.sub;
      x.status = "done";
      x.doneAt = nowIso();
      const enq = d.enquiries.find((e) => e.id === x.enquiryId);
      if (x.approval.kind === "lost" && decision === "approved" && enq) {
        enq.stage = "lost";
        enq.lostReason = x.approval.payload;
        enq.lastStageChangeAt = nowIso();
        enq.updatedAt = nowIso();
        enq.needsAttention = false;
        logActivity(d, { actor: me.name, actorKind: "user", type: "stage_change", text: `Marked Lost — ${x.approval.payload}`, enquiryId: enq.id, travellerId: enq.travellerId });
      }
      const label = x.approval.kind === "lost" ? "lost marking" : x.approval.kind === "discount" ? "discount" : x.approval.kind === "refund" ? "refund" : "AI draft";
      logActivity(d, { actor: me.name, actorKind: "user", type: "approval", text: `${decision === "approved" ? "Approved" : "Denied"} ${label}${enq ? ` on ${enq.ref}` : ""}`, enquiryId: enq?.id, travellerId: enq?.travellerId });
    });
    toast(decision === "approved" ? "Approved" : "Denied");
  };

  const cadence = db.settings.sla.followUpCadenceDays;
  const toggle = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  const renderSection = (key: TaskBucket, label: string, tone: string, rows: Task[], extra?: React.ReactNode) => (
    <Card key={key} className="overflow-hidden">
      <button type="button" onClick={() => toggle(key)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-secondary/60">
        <span className="flex items-center gap-2">
          {collapsed[key] ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          <span className={cn("text-sm font-semibold", tone)}>{label}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{rows.length}</span>
        </span>
        {extra}
      </button>
      {!collapsed[key] && (
        <div className="divide-y divide-border border-t border-border">
          {rows.length === 0 && <p className="px-4 py-4 text-sm text-muted-foreground">Nothing here.</p>}
          {rows.map((t) => (
            <TaskRow key={t.id} task={t} db={db} canManage={canManage} canApprove={canApprove} onDone={markDone} onSnooze={snooze} onReassign={reassign} onDelete={remove} onDecide={decide} />
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <>
      <PageHeader title="Tasks & follow-ups" subtitle="Everything due — follow-ups, approvals, ops checklists and AI-raised items.">
        <div className="flex rounded-md border border-border bg-background p-0.5">
          {(["me", "all"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setScope(s)} className={cn("h-9 rounded px-3 text-sm font-medium", scope === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {s === "me" ? "Me" : "All"}
            </button>
          ))}
        </div>
        {canManage && (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        )}
      </PageHeader>

      <div className="space-y-6 p-4 md:p-6">
        {focusEnquiry && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-800">
            <span>
              Showing tasks for <span className="font-semibold">{focusEnquiry.ref}</span> · {travellerById(db, focusEnquiry.travellerId)?.fullName} · {focusEnquiry.destination}
            </span>
            <button type="button" onClick={() => router.replace("/tasks")} className="inline-flex h-9 items-center gap-1 rounded px-2 text-xs font-medium hover:bg-brand-100">
              <X className="h-3.5 w-3.5" /> clear
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Overdue" value={buckets.overdue.length} icon={AlertTriangle} tint="text-rose-500" />
          <StatCard label="Due today" value={buckets.today.length} icon={CalendarCheck} tint="text-amber-500" />
          <StatCard label="Approvals pending" value={buckets.approval.length} icon={ShieldCheck} tint="text-indigo-500" />
          <StatCard label="Completed this week" value={completedThisWeek} icon={CheckCircle2} tint="text-emerald-500" />
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <Input placeholder="Search by title, traveller or WT ref…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="md:w-48" aria-label="Assignee filter">
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {db.users
              .filter((u) => u.active)
              .map((u) => (
                <option key={u.sub} value={u.sub}>
                  {u.name}
                </option>
              ))}
          </Select>
          <Select value={kind} onChange={(e) => setKind(e.target.value as TaskKind | "")} className="md:w-48" aria-label="Kind filter">
            <option value="">All kinds</option>
            {(Object.keys(TASK_KIND_LABEL) as TaskKind[]).map((k) => (
              <option key={k} value={k}>
                {TASK_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={ListTodo} title="No tasks match" hint="Try widening the scope or clearing filters." action={canManage ? <Button onClick={() => setNewOpen(true)}>New task</Button> : undefined} />
        ) : (
          <div className="space-y-3">
            {renderSection("overdue", SECTION_META.overdue.label, SECTION_META.overdue.tone, buckets.overdue)}
            {renderSection("today", SECTION_META.today.label, SECTION_META.today.tone, buckets.today)}
            {renderSection("upcoming", SECTION_META.upcoming.label, SECTION_META.upcoming.tone, buckets.upcoming)}
            {renderSection("approval", SECTION_META.approval.label, SECTION_META.approval.tone, buckets.approval, !canApprove ? <span className="text-xs text-muted-foreground">Managers decide</span> : undefined)}
            {renderSection("done", "Done", "text-muted-foreground", buckets.done, <span className="text-xs text-muted-foreground">last 20</span>)}
          </div>
        )}

        <Card className="flex items-start gap-3 p-4">
          <Timer className="mt-0.5 h-5 w-5 shrink-0 text-saffron-400" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">{cadence.join("-")} follow-up cadence</p>
            <p className="mt-1 text-muted-foreground">
              When an itinerary goes out and the traveller goes quiet, the follow-up agent nudges on day {cadence.map((d, i) => (i === cadence.length - 1 ? `and day ${d}` : `${d}, `)).join("")}
              . After {db.settings.agents.followUp.maxAttempts} silent attempts it raises a <span className="font-medium">Lost approval</span> here instead of closing the lead itself. First reply SLA is {db.settings.sla.firstResponseMin} min; first itinerary within {db.settings.sla.itineraryHours} h. Change the cadence under Settings → Business hours &amp; SLA.
            </p>
          </div>
        </Card>
      </div>

      <NewTaskDialog open={newOpen} onClose={() => setNewOpen(false)} db={db} me={me} onCreated={() => toast("Task created")} />
      {node}
    </>
  );
}
