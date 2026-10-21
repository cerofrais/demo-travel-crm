import type { DemoData, Enquiry, Trip } from "@/lib/demo/types";

export type RangeKey = "7d" | "30d" | "90d" | "all" | "custom";

export interface ReportCtx {
  db: DemoData;
  from: Date;
  to: Date;
  consultant: string;
  /** Enquiries created in range (and owned by the consultant filter). */
  enquiries: Enquiry[];
  /** Trips booked in range (createdAt) whose enquiry passes the consultant filter. */
  trips: Trip[];
  canAll: boolean;
}

export function rangeBounds(key: RangeKey, customFrom: string, customTo: string): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  if (key === "custom" && customFrom) {
    const f = new Date(customFrom);
    f.setHours(0, 0, 0, 0);
    const t = customTo ? new Date(customTo) : new Date();
    t.setHours(23, 59, 59, 999);
    return { from: f, to: t };
  }
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  if (key === "all") from.setFullYear(2000, 0, 1);
  else from.setDate(from.getDate() - (key === "7d" ? 7 : key === "30d" ? 30 : key === "90d" ? 90 : 30));
  return { from, to };
}

export const inRange = (iso: string | undefined, from: Date, to: Date) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
};

export function buildCtx(db: DemoData, from: Date, to: Date, consultant: string, canAll: boolean): ReportCtx {
  const ownerOk = (e?: Enquiry) => !consultant || e?.assignedTo === consultant;
  const enquiries = db.enquiries.filter((e) => inRange(e.createdAt, from, to) && ownerOk(e));
  const trips = db.trips.filter((t) => inRange(t.createdAt, from, to) && ownerOk(db.enquiries.find((e) => e.id === t.enquiryId)));
  return { db, from, to, consultant, enquiries, trips, canAll };
}

export function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
export const pct = (num: number, den: number) => (den ? Math.round((num / den) * 100) : 0);
export const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0);

export const monthKey = (iso: string) => iso.slice(0, 7);
export const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleString("en-IN", { month: "short", year: "2-digit" });

export function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function nextNMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export const nightsOf = (t: Trip) => Math.max(1, Math.round((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / 86400000));
