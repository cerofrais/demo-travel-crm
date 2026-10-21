import type { DemoData, Trip } from "@/lib/demo/types";
import { daysUntil, formatDate } from "@/lib/utils";

/** Small helpers shared by the Operations area (trips, payments, documents, travellers, suppliers). */

export function firstName(fullName?: string | null): string {
  if (!fullName) return "there";
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** Fill `{{var}}` placeholders in a message template body. Unknown vars are left as `{var}`. */
export function fillTemplate(body: string, vars: Record<string, string | number | undefined | null>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => (vars[k] == null ? `{${k}}` : String(vars[k])));
}

export function templateBody(db: DemoData, id: string, fallback: string): string {
  return db.templates.find((t) => t.id === id)?.body ?? fallback;
}

/** Next running serial for a document series like `INV/26-27/123`. */
export function nextSerial(existing: (string | undefined)[], prefix: string): string {
  let max = 100;
  for (const s of existing) {
    if (!s || !s.startsWith(prefix)) continue;
    const n = parseInt(s.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

export const INVOICE_PREFIX = "INV/26-27/";
export const RECEIPT_PREFIX = "RCP/26-27/";

/** "in 12 days" / "day 2 of 5" / "departed" / "completed" for a trip. */
export function tripTiming(trip: Pick<Trip, "startDate" | "endDate" | "status">, now = new Date()): { label: string; tone: "upcoming" | "live" | "past" | "cancelled" } {
  if (trip.status === "cancelled") return { label: "Cancelled", tone: "cancelled" };
  const d = daysUntil(trip.startDate, now);
  const total = Math.max(1, daysUntil(trip.endDate, new Date(trip.startDate)) + 1);
  if (d > 0) return { label: d === 1 ? "Departs tomorrow" : `In ${d} days`, tone: "upcoming" };
  const dayN = -d + 1;
  if (dayN <= total) return { label: `Day ${dayN} of ${total}`, tone: "live" };
  return { label: `Returned ${formatDate(trip.endDate, "short")}`, tone: "past" };
}

export function tripNights(trip: Pick<Trip, "startDate" | "endDate">): number {
  return Math.max(1, Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000));
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

export function isoDateOnly(d: Date | string): string {
  const x = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export const PAYMENT_MODE_LABEL: Record<string, string> = {
  upi: "UPI",
  razorpay_link: "Razorpay link",
  bank_transfer: "Bank transfer",
  card: "Card",
  cash: "Cash",
};

export function passportExpiryState(expiry?: string | null, now = new Date()): { tone: "ok" | "warn" | "expired" | "none"; days: number } {
  if (!expiry) return { tone: "none", days: 0 };
  const days = daysUntil(expiry, now);
  if (days < 0) return { tone: "expired", days };
  if (days <= 180) return { tone: "warn", days };
  return { tone: "ok", days };
}
