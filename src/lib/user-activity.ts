import type { Activity, User } from "@/lib/demo/types";

/**
 * Team activity monitor — how active each team member was through one IST
 * day, read from the activity log in 10-minute slots. Ported from the
 * wellness CRM's user-activity module, computed in the browser here.
 *
 * Only what writes an activity-log row counts — remarks, stage moves,
 * messages sent, calls, tasks, assignments, documents. Reading an enquiry or
 * scrolling the board writes nothing, so "inactive" means "did nothing the
 * log records", not "wasn't at the screen".
 */

export const BUCKET_MINUTES = 10;
export const BUCKETS_PER_DAY = (24 * 60) / BUCKET_MINUTES;
const BUCKET_MS = BUCKET_MINUTES * 60_000;
const IST_OFFSET_MS = 5.5 * 3_600_000;

export interface UserActivityRow {
  sub: string;
  name: string;
  role: string | null;
  /** Actions per 10-minute slot, BUCKETS_PER_DAY long, from 00:00 IST. */
  counts: number[];
  total: number;
  /** Slots with at least one action — ×10 for active minutes. */
  activeBuckets: number;
  firstAt: string | null;
  lastAt: string | null;
}

export interface ActivityMonitorData {
  day: string;
  nowBucket: number | null;
  users: UserActivityRow[];
}

export function istToday(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function istDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS);
}

export function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Slot the current time falls in for `day`; null for a past day, -1 for a future one. */
export function nowBucketFor(day: string, now = new Date()): number | null {
  const start = istDayStart(day).getTime();
  const t = now.getTime();
  if (t < start) return -1;
  if (t >= start + BUCKETS_PER_DAY * BUCKET_MS) return null;
  return Math.floor((t - start) / BUCKET_MS);
}

export function buildActivityMonitor(day: string, activities: Activity[], staff: User[], now = new Date()): ActivityMonitorData {
  const from = istDayStart(day).getTime();
  const to = from + BUCKETS_PER_DAY * BUCKET_MS;
  const rows = new Map<string, UserActivityRow>();
  for (const u of staff) {
    rows.set(u.sub, { sub: u.sub, name: u.name, role: u.role, counts: new Array(BUCKETS_PER_DAY).fill(0), total: 0, activeBuckets: 0, firstAt: null, lastAt: null });
  }
  for (const a of activities) {
    if (a.actorKind !== "user" || !a.actorSub) continue;
    const t = new Date(a.at).getTime();
    if (t < from || t >= to) continue;
    const row = rows.get(a.actorSub);
    if (!row) continue;
    const bucket = Math.floor((t - from) / BUCKET_MS);
    row.counts[bucket] += 1;
    row.total += 1;
    if (!row.firstAt || a.at < row.firstAt) row.firstAt = a.at;
    if (!row.lastAt || a.at > row.lastAt) row.lastAt = a.at;
  }
  for (const row of rows.values()) row.activeBuckets = row.counts.filter((c) => c > 0).length;
  const users = [...rows.values()].sort((a, b) => b.activeBuckets - a.activeBuckets || b.total - a.total || a.name.localeCompare(b.name));
  return { day, nowBucket: nowBucketFor(day, now), users };
}

/** Each person's most recent logged action — the "Last active" column. */
export function lastActiveBySub(activities: Activity[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const a of activities) {
    if (a.actorKind !== "user" || !a.actorSub) continue;
    const prev = out.get(a.actorSub);
    if (!prev || a.at > prev) out.set(a.actorSub, a.at);
  }
  return out;
}
