"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, Check, Trash2, Cog } from "lucide-react";
import { Avatar, Badge, Button, Select } from "@/components/ui";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";
import { TASK_KIND_LABEL } from "@/lib/pipeline";
import { enquiryById, travellerById, tripById, userName } from "@/lib/demo/queries";
import type { DemoData, Task } from "@/lib/demo/types";
import { PRIORITY_DOT, PRIORITY_LABEL, isOpenTask } from "./task-helpers";

export interface TaskRowProps {
  task: Task;
  db: DemoData;
  canManage: boolean;
  canApprove: boolean;
  onDone: (t: Task) => void;
  onSnooze: (t: Task, option: "1h" | "tomorrow" | "3d") => void;
  onReassign: (t: Task, sub: string) => void;
  onDelete: (t: Task) => void;
  onDecide: (t: Task, decision: "approved" | "denied") => void;
}

function CreatedByChip({ createdBy, db }: { createdBy: string; db: DemoData }) {
  if (createdBy === "ai")
    return (
      <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
        <Bot className="h-3 w-3" /> AI
      </span>
    );
  if (createdBy === "system")
    return (
      <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
        <Cog className="h-3 w-3" /> System
      </span>
    );
  return <span className="inline-flex items-center rounded bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{userName(db, createdBy)}</span>;
}

export function TaskRow({ task, db, canManage, canApprove, onDone, onSnooze, onReassign, onDelete, onDecide }: TaskRowProps) {
  const enquiry = enquiryById(db, task.enquiryId);
  const traveller = travellerById(db, task.travellerId ?? enquiry?.travellerId);
  const trip = tripById(db, task.tripId ?? enquiry?.tripId);
  const open = isOpenTask(task);
  const overdue = open && new Date(task.dueAt).getTime() < Date.now();
  const isApproval = task.kind === "approval" && task.approval;
  const pendingApproval = isApproval && !task.approval?.decision && open;
  const assignees = db.users.filter((u) => u.active);

  return (
    <div className={cn("flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4", !open && "opacity-70")}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", PRIORITY_DOT[task.priority])} title={`${PRIORITY_LABEL[task.priority]} priority`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={cn("text-[10px]", task.kind === "approval" ? "bg-amber-100 text-amber-800" : "bg-brand-100 text-brand-700")}>{TASK_KIND_LABEL[task.kind]}</Badge>
            <span className={cn("text-sm font-medium text-foreground", !open && "line-through")}>{task.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {traveller && <span className="text-foreground/80">{traveller.fullName}</span>}
            {enquiry && (
              <Link href={`/enquiries?enquiry=${enquiry.id}`} className="font-medium text-primary hover:underline">
                {enquiry.ref}
              </Link>
            )}
            {trip && (
              <Link href={`/trips/${trip.id}`} className="font-medium text-primary hover:underline">
                {trip.ref}
              </Link>
            )}
            <span className={cn(overdue && "font-semibold text-rose-600")} title={formatDateTime(task.dueAt)}>
              {open ? `Due ${relativeTime(task.dueAt)}` : task.doneAt ? `Done ${relativeTime(task.doneAt)}` : "Closed"} · {formatDateTime(task.dueAt)}
            </span>
            <CreatedByChip createdBy={task.createdBy} db={db} />
          </div>
          {isApproval && (
            <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
              <span className="font-semibold">{task.approval!.kind.replace("_", " ")}</span> · {task.approval!.payload}
              {task.approval!.decision && (
                <span className="ml-2 font-semibold">
                  {task.approval!.decision === "approved" ? "Approved" : "Denied"} by {userName(db, task.approval!.decidedBy)}
                </span>
              )}
            </p>
          )}
          {task.notes && <p className="mt-1 text-xs text-muted-foreground">{task.notes}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <div className="flex items-center gap-1.5" title={userName(db, task.assignedTo)}>
          <Avatar name={task.assignedTo ? userName(db, task.assignedTo) : undefined} className="h-7 w-7 text-[10px]" />
          <span className="text-xs text-muted-foreground md:hidden">{task.assignedTo ? userName(db, task.assignedTo) : "Unassigned"}</span>
        </div>
        {pendingApproval && canApprove && (
          <>
            <Button size="sm" onClick={() => onDecide(task, "approved")}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDecide(task, "denied")}>
              Deny
            </Button>
          </>
        )}
        {open && canManage && !pendingApproval && (
          <Button size="sm" variant="outline" onClick={() => onDone(task)} aria-label="Mark done">
            <Check className="h-3.5 w-3.5" /> Done
          </Button>
        )}
        {open && canManage && (
          <Select
            aria-label="Snooze"
            className="h-8 w-auto text-xs lg:h-8"
            value=""
            onChange={(e) => {
              const v = e.target.value as "1h" | "tomorrow" | "3d" | "";
              if (v) onSnooze(task, v);
            }}
          >
            <option value="">Snooze…</option>
            <option value="1h">+1 hour</option>
            <option value="tomorrow">Tomorrow 10:00</option>
            <option value="3d">+3 days</option>
          </Select>
        )}
        {canManage && (
          <Select aria-label="Reassign" className="h-8 w-auto max-w-[140px] text-xs lg:h-8" value={task.assignedTo ?? ""} onChange={(e) => onReassign(task, e.target.value)}>
            <option value="">Unassigned</option>
            {assignees.map((u) => (
              <option key={u.sub} value={u.sub}>
                {u.name}
              </option>
            ))}
          </Select>
        )}
        {canManage && (
          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-rose-600" onClick={() => onDelete(task)} aria-label="Delete task">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
