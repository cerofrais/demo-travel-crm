import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatINR(amount?: number | null, opts: { compact?: boolean } = {}): string {
  if (amount == null) return "—";
  if (opts.compact) {
    if (Math.abs(amount) >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
    if (Math.abs(amount) >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(amount % 1_00_000 === 0 ? 0 : 1)} L`;
    if (Math.abs(amount) >= 1_000) return `₹${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}k`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Always renders in IST regardless of the viewer's own timezone. */
export function formatIST(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...options });
}

export function formatDate(date: Date | string | null | undefined, style: "short" | "medium" | "long" = "medium"): string {
  if (!date) return "—";
  const opts: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "numeric", month: "short" }
      : style === "long"
        ? { weekday: "short", day: "numeric", month: "short", year: "numeric" }
        : { day: "numeric", month: "short", year: "numeric" };
  return formatIST(date, opts);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatIST(date, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatIST(date, { hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(date: Date | string, now: Date = new Date()): string {
  const diff = (now.getTime() - new Date(date).getTime()) / 1000;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const fmt = (n: number, unit: string) => `${future ? "in " : ""}${n}${unit}${future ? "" : " ago"}`;
  if (abs < 60) return future ? "in a moment" : "just now";
  if (abs < 3600) return fmt(Math.round(abs / 60), "m");
  if (abs < 86400) return fmt(Math.round(abs / 3600), "h");
  if (abs < 86400 * 30) return fmt(Math.round(abs / 86400), "d");
  return formatDate(date, "short");
}

export function daysUntil(date: Date | string, now: Date = new Date()): number {
  const a = new Date(date);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export function addDays(date: Date | string, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function maskPassport(no?: string | null): string {
  if (!no) return "—";
  if (no.length <= 4) return "••••";
  return `${"•".repeat(no.length - 4)}${no.slice(-4)}`;
}

export function paxLabel(p: { adults: number; children: number; infants: number }): string {
  const parts = [`${p.adults} adult${p.adults === 1 ? "" : "s"}`];
  if (p.children) parts.push(`${p.children} child${p.children === 1 ? "" : "ren"}`);
  if (p.infants) parts.push(`${p.infants} infant${p.infants === 1 ? "" : "s"}`);
  return parts.join(", ");
}

export function paxCount(p: { adults: number; children: number; infants: number }): number {
  return p.adults + p.children + p.infants;
}

export function pluralize(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : many ?? `${one}s`}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}
