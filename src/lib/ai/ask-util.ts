/**
 * Ask the data — shared types and helpers for the question handlers.
 */
import type { AskEntry, DemoData, Enquiry, Payment, Task, Trip } from "@/lib/demo/types";
import { destinationById, isWon, userName, visibleEnquiries } from "@/lib/demo/queries";
import { SOURCE_LABEL, STAGE_MAP, TRIP_TYPE_LABEL } from "@/lib/pipeline";
import { formatDate, formatINR } from "@/lib/utils";
import type { AskFilters, AskGroupBy, AskRange, ParsedQuestion } from "./ask-parse";

export type Answer = AskEntry["answer"];
export type Row = Record<string, string | number | null>;
export type HandlerResult = Omit<Answer, "durationMs">;

export interface AskContext {
  db: DemoData;
  user: { sub: string; role: string };
  now: Date;
  /** Enquiries the asking user may see (role + stage visibility). */
  enquiries: Enquiry[];
  visibleEnquiryIds: Set<string>;
  /** Appended to answer text when the data is scoped to the user. */
  scopeNote: string;
}

export interface AskHandler {
  id: string;
  examples: string[];
  match: (q: ParsedQuestion) => boolean;
  run: (q: ParsedQuestion, ctx: AskContext) => HandlerResult;
}

export const MAX_ROWS = 50;

export function makeContext(db: DemoData, user: { sub: string; role: string }, now: Date): AskContext {
  const enquiries = visibleEnquiries(db, user);
  return {
    db,
    user,
    now,
    enquiries,
    visibleEnquiryIds: new Set(enquiries.map((e) => e.id)),
    scopeNote: user.role === "SALES" ? " Scoped to your own and unassigned enquiries." : "",
  };
}

// ---------- date helpers ----------

export const inRange = (iso: string | undefined, r: AskRange): boolean => {
  if (!iso) return !r.from && !r.to;
  const t = new Date(iso).getTime();
  if (r.from && t < r.from.getTime()) return false;
  if (r.to && t > r.to.getTime()) return false;
  return true;
};

export const sqlDate = (d?: Date) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");
export const daysBetween = (a: Date | string, b: Date | string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
export const monthKey = (iso: string) => iso.slice(0, 7);
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
};

// ---------- SQL rendering ----------

export function rangeWhere(column: string, r: AskRange): string[] {
  const out: string[] = [];
  if (r.from) out.push(`${column} >= '${sqlDate(r.from)}'`);
  if (r.to) out.push(`${column} <= '${sqlDate(r.to)}'`);
  return out;
}

export function enquiryWhere(f: AskFilters, ctx: AskContext): string[] {
  const w: string[] = [];
  if (f.source === "instagram") w.push("source IN ('instagram_comment','instagram_dm')");
  else if (f.source) w.push(`source = '${f.source}'`);
  if (f.stage === "won") w.push("stage IN (advance_paid, docs_visa, ready, travelling, completed)");
  else if (f.stage === "open") w.push("stage NOT IN ('completed','lost','non_lead')");
  else if (f.stage === "closed") w.push("stage IN ('completed','lost','non_lead')");
  else if (f.stage) w.push(`stage = '${f.stage}'`);
  if (f.destination) w.push(`destination_id = '${f.destination}'`);
  if (f.consultantSub === "unassigned") w.push("assigned_to IS NULL");
  else if (f.consultantSub && f.consultantSub !== "ai") w.push(`assigned_to = '${f.consultantSub}'`);
  if (f.tripType) w.push(`trip_type = '${f.tripType}'`);
  if (f.hot) w.push("ai_score >= 75");
  if (ctx.user.role === "SALES") w.push(`(assigned_to = '${ctx.user.sub}' OR assigned_to IS NULL)`);
  return w;
}

export function sql(select: string, from: string, where: string[], tail = ""): string {
  const w = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  return `SELECT ${select} FROM ${from}${w}${tail ? ` ${tail}` : ""}`;
}

// ---------- filtering ----------

export function matchesSource(e: Enquiry, source?: AskFilters["source"]): boolean {
  if (!source) return true;
  if (source === "instagram") return e.source === "instagram_comment" || e.source === "instagram_dm";
  return e.source === source;
}

export function matchesStage(e: Enquiry, stage?: AskFilters["stage"]): boolean {
  if (!stage) return true;
  if (stage === "won") return isWon(e);
  if (stage === "open") return !["completed", "lost", "non_lead"].includes(e.stage);
  if (stage === "closed") return ["completed", "lost", "non_lead"].includes(e.stage);
  return e.stage === stage;
}

/** Apply the common enquiry filters (not the date range — callers pick the column). */
export function filterEnquiries(list: Enquiry[], f: AskFilters): Enquiry[] {
  return list.filter((e) => {
    if (!matchesSource(e, f.source)) return false;
    if (!matchesStage(e, f.stage)) return false;
    if (f.destination && e.destinationId !== f.destination) return false;
    if (f.consultantSub === "unassigned" && e.assignedTo) return false;
    if (f.consultantSub && f.consultantSub !== "unassigned" && f.consultantSub !== "ai" && e.assignedTo !== f.consultantSub) return false;
    if (f.tripType && e.tripType !== f.tripType) return false;
    if (f.hot && (e.aiScore ?? 0) < 75) return false;
    return true;
  });
}

export function visibleTrips(ctx: AskContext): Trip[] {
  return ctx.db.trips.filter((t) => ctx.visibleEnquiryIds.has(t.enquiryId));
}

export function visiblePayments(ctx: AskContext): Payment[] {
  const tripIds = new Set(visibleTrips(ctx).map((t) => t.id));
  return ctx.db.payments.filter((p) => tripIds.has(p.tripId));
}

export function visibleTasks(ctx: AskContext): Task[] {
  return ctx.db.tasks.filter((t) => !t.enquiryId || ctx.visibleEnquiryIds.has(t.enquiryId));
}

// ---------- grouping ----------

export function groupKey(e: Enquiry, by: AskGroupBy, ctx: AskContext): string {
  switch (by) {
    case "source":
      return SOURCE_LABEL[e.source];
    case "stage":
      return STAGE_MAP[e.stage]?.label ?? e.stage;
    case "destination":
      return e.destination;
    case "consultant":
      return userName(ctx.db, e.assignedTo);
    case "month":
      return monthLabel(monthKey(e.createdAt));
    case "trip_type":
      return TRIP_TYPE_LABEL[e.tripType];
    case "channel":
      return SOURCE_LABEL[e.source];
  }
}

export function tripGroupKey(t: Trip, by: AskGroupBy, ctx: AskContext, enquiry?: Enquiry): string {
  switch (by) {
    case "destination":
      return t.destination;
    case "month":
      return monthLabel(monthKey(t.startDate));
    case "consultant":
      return userName(ctx.db, enquiry?.assignedTo ?? t.tripCaptain);
    case "stage":
      return t.status;
    case "trip_type":
      return enquiry ? TRIP_TYPE_LABEL[enquiry.tripType] : "—";
    default:
      return enquiry ? SOURCE_LABEL[enquiry.source] : "—";
  }
}

export const GROUP_COLUMN: Record<AskGroupBy, string> = {
  source: "source",
  stage: "stage",
  destination: "destination",
  consultant: "assigned_to",
  month: "DATE_TRUNC('month', created_at)",
  channel: "channel",
  trip_type: "trip_type",
};

export const GROUP_LABEL: Record<AskGroupBy, string> = {
  source: "Source",
  stage: "Stage",
  destination: "Destination",
  consultant: "Consultant",
  month: "Month",
  channel: "Channel",
  trip_type: "Trip type",
};

/** Count items per key, sorted by count desc. */
export function tally<T>(items: T[], key: (t: T) => string, value: (t: T) => number = () => 1): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    m.set(k, (m.get(k) ?? 0) + value(it));
  }
  return Array.from(m, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

// ---------- row builders ----------

export function enquiryRow(e: Enquiry, ctx: AskContext): Row {
  const t = ctx.db.travellers.find((x) => x.id === e.travellerId);
  return {
    Ref: e.ref,
    Traveller: t?.fullName ?? "—",
    Destination: e.destination,
    Stage: STAGE_MAP[e.stage]?.label ?? e.stage,
    Source: SOURCE_LABEL[e.source],
    "Trip type": TRIP_TYPE_LABEL[e.tripType],
    Budget: formatINR(e.budgetINR),
    Score: e.aiScore,
    Owner: userName(ctx.db, e.assignedTo),
    Created: formatDate(e.createdAt),
  };
}

export function tripRow(t: Trip, ctx: AskContext): Row {
  const traveller = ctx.db.travellers.find((x) => x.id === t.travellerId);
  const dest = destinationById(ctx.db, t.destinationId);
  return {
    Ref: t.ref,
    Traveller: traveller?.fullName ?? "—",
    Destination: dest?.name ?? t.destination,
    Departs: formatDate(t.startDate),
    Returns: formatDate(t.endDate),
    Pax: t.pax.adults + t.pax.children + t.pax.infants,
    Status: t.status.replace(/_/g, " "),
    Value: formatINR(t.totalINR),
    Paid: formatINR(t.paidINR),
    Captain: userName(ctx.db, t.tripCaptain),
  };
}

export function describeFilters(f: AskFilters, ctx: AskContext): string {
  const bits: string[] = [];
  if (f.source === "instagram") bits.push("from Instagram");
  else if (f.source) bits.push(`from ${SOURCE_LABEL[f.source]}`);
  if (f.stage === "won") bits.push("that converted");
  else if (f.stage === "open") bits.push("still open");
  else if (f.stage === "closed") bits.push("closed");
  else if (f.stage) bits.push(`in ${STAGE_MAP[f.stage]?.label ?? f.stage}`);
  if (f.destination) bits.push(`for ${destinationById(ctx.db, f.destination)?.name ?? f.destination}`);
  if (f.tripType) bits.push(`(${TRIP_TYPE_LABEL[f.tripType].toLowerCase()})`);
  if (f.consultantSub === "unassigned") bits.push("unassigned");
  else if (f.consultantSub && f.consultantSub !== "ai") bits.push(`owned by ${userName(ctx.db, f.consultantSub)}`);
  if (f.hot) bits.push("with AI score ≥ 75");
  return bits.length ? ` ${bits.join(" ")}` : "";
}

export function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

export function cap<T>(rows: T[]): T[] {
  return rows.slice(0, MAX_ROWS);
}
