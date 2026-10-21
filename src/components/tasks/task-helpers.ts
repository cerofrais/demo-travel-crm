import type { Task, TaskPriority } from "@/lib/demo/types";

export const isOpenTask = (t: Task) => t.status === "open" || t.status === "snoozed";

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: "bg-rose-500",
  normal: "bg-amber-400",
  low: "bg-zinc-300",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = { high: "High", normal: "Normal", low: "Low" };

/** Local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
export function toLocalInput(date: Date | string): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export type TaskBucket = "overdue" | "today" | "upcoming" | "approval" | "done";

export function bucketOf(t: Task, now = new Date()): TaskBucket {
  if (!isOpenTask(t)) return "done";
  if (t.kind === "approval" && t.approval && !t.approval.decision) return "approval";
  const due = new Date(t.dueAt);
  if (due.getTime() < now.getTime()) return "overdue";
  if (due.getTime() <= endOfToday().getTime()) return "today";
  return "upcoming";
}

export function snoozeTarget(option: "1h" | "tomorrow" | "3d"): string {
  const d = new Date();
  if (option === "1h") d.setHours(d.getHours() + 1);
  else if (option === "tomorrow") {
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
  } else {
    d.setDate(d.getDate() + 3);
    d.setHours(10, 0, 0, 0);
  }
  return d.toISOString();
}
