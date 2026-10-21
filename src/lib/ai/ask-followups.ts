/**
 * Ask the data — follow-up chips. Each chip is a short phrase appended to the
 * previous question ("Enquiries this week" + "by destination"), so the user
 * can drill in without retyping. Only suggests what the question lacks.
 */
import type { DemoData } from "@/lib/demo/types";
import { parseQuestion } from "./ask-parse";

export interface FollowUp {
  label: string;
  question: string;
}

export function followUpsFor(question: string, db: DemoData, now: Date = new Date()): FollowUp[] {
  const q = parseQuestion(question, db, now);
  const base = question.trim().replace(/[?.!]+$/, "");
  const out: FollowUp[] = [];
  const add = (label: string, suffix = label) => out.push({ label, question: `${base} ${suffix}` });
  const groupable = !q.entity || ["enquiries", "trips"].includes(q.entity) || /\bconversion|revenue|response time\b/.test(q.lower);
  if (groupable && !q.groupBy) {
    if (!q.filters.destination) add("by destination");
    if (!q.filters.source && q.entity !== "trips") add("by source");
    add("by consultant");
    add("by month");
  }
  if (!q.range.from) {
    add("this month");
    add("last 30 days");
  } else if (q.range.label !== "last 90 days") {
    add("last 90 days");
  }
  if (!q.filters.source && (!q.entity || q.entity === "enquiries") && !/\bconversion\b/.test(q.lower)) add("only Instagram", "from Instagram only");
  if (!q.filters.destination && groupable && q.groupBy !== "destination") add("only Kerala", "for Kerala");
  if (q.entity === "tasks" && !q.filters.overdue) add("overdue only", "that are overdue");
  if (q.entity === "payments" && !q.range.from && !q.filters.overdue) add("due in next 7 days", "due in the next 7 days");
  return out.slice(0, 5);
}
