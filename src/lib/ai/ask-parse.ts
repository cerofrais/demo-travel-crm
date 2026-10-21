/**
 * Ask the data — question parser.
 *
 * Turns a free-text question into a small structured `ParsedQuestion` that
 * the handlers in ask-handlers-*.ts pattern-match on. Pure: no store access,
 * `now` is injected so tests are deterministic.
 */
import type { DemoData, EnquiryStage, LeadSource, TripType } from "@/lib/demo/types";

export type AskEntity = "enquiries" | "trips" | "payments" | "travellers" | "tasks" | "calls" | "messages" | "itineraries" | "campaigns";
export type AskMetric = "count" | "sum" | "list" | "avg" | "top";
export type AskGroupBy = "source" | "stage" | "destination" | "consultant" | "month" | "channel" | "trip_type";

export interface AskRange {
  from?: Date;
  to?: Date;
  label: string;
  /** True when the range lies ahead of `now` ("next 14 days", "in December"). */
  future?: boolean;
}

export interface AskFilters {
  /** A concrete source, or "instagram" for comment + DM together. */
  source?: LeadSource | "instagram";
  stage?: EnquiryStage | "won" | "open" | "closed";
  /** Destination id. */
  destination?: string;
  consultantSub?: string;
  tripType?: TripType;
  status?: string;
  overdue?: boolean;
  noReplyDays?: number;
  hot?: boolean;
}

export interface ParsedQuestion {
  raw: string;
  lower: string;
  entity?: AskEntity;
  metric: AskMetric;
  groupBy?: AskGroupBy;
  filters: AskFilters;
  range: AskRange;
  limit?: number;
  /** Entity references found verbatim in the question (WT-1045, WTB-2026-021). */
  refs: string[];
}

// ---------- synonyms ----------

const ENTITY_PATTERNS: [AskEntity, RegExp][] = [
  ["payments", /\b(payments?|instal+ments?|dues|collections?|receivables?|invoices?|balance due|outstanding)\b/],
  ["tasks", /\b(tasks?|to-?dos?|follow-?ups?|reminders?|action items?)\b/],
  ["calls", /\b(calls?|phone ?calls?|voice agent|aanya|dialled|dialed)\b/],
  ["itineraries", /\b(itinerar(y|ies)|quotes?|quotations?|proposals?)\b/],
  ["campaigns", /\b(campaigns?|broadcasts?|automations?|drips?)\b/],
  ["travellers", /\b(travell?ers?|customers?|clients?|guests?|passports?|passengers?)\b/],
  ["trips", /\b(bookings?|trips?|departures?|departing|booked|confirmed trips?)\b/],
  ["messages", /\b(messages?|dms?|chats?|texts|conversations?|whatsapps)\b/],
  ["enquiries", /\b(enquir(y|ies)|inquir(y|ies)|leads?|queries|query|prospects?|requests?)\b/],
];

const SOURCE_PATTERNS: [AskFilters["source"], RegExp][] = [
  ["instagram_comment", /\b(comment plan|ig comments?|instagram comments?|comment automation|commented)\b/],
  ["instagram_dm", /\b(ig dms?|instagram dms?|insta dms?)\b/],
  ["instagram", /\b(instagram|insta|ig)\b/],
  ["whatsapp", /\b(whatsapp|wa)\b/],
  ["website_planner", /\b(website|web|planner|site)\b/],
  ["meta_lead_form", /\b(meta|lead forms?|facebook|fb)\b/],
  ["google", /\b(google|search ads?)\b/],
  ["referral", /\b(referrals?|referred|refer-a-friend)\b/],
  ["email", /\b(e-?mails?)\b/],
  ["phone", /\b(phone|inbound calls?)\b/],
  ["repeat", /\b(repeat|returning)\b/],
];

const STAGE_PATTERNS: [AskFilters["stage"], RegExp][] = [
  ["itinerary_sent", /\b(itinerary sent|sent itinerary|itinerary stage)\b/],
  ["negotiation", /\b(negotiation|negotiating|revision)\b/],
  ["advance_paid", /\b(advance paid|token paid|advance stage)\b/],
  ["docs_visa", /\b(docs? (&|and) visa|docs stage|visa stage)\b/],
  ["ready", /\b(ready to travel|ready stage)\b/],
  ["travelling", /\b(travelling now|currently travelling|on trip|on the trip)\b/],
  ["completed", /\b(completed trips?|completed stage|returned)\b/],
  ["qualified", /\b(qualified)\b/],
  ["contacted", /\b(contacted)\b/],
  ["lost", /\b(lost|dropped|churned)\b/],
  ["non_lead", /\b(non-?leads?|spam)\b/],
  ["new", /\b(in new|new stage|stage new|untouched)\b/],
  ["won", /\b(won|converted|closed won|successful)\b/],
  ["open", /\b(open|active|live|in progress|pipeline)\b/],
];

const TRIP_TYPE_PATTERNS: [TripType, RegExp][] = [
  ["honeymoon", /\b(honeymoon(ers)?)\b/],
  ["couple", /\b(couples?)\b/],
  ["family", /\b(famil(y|ies))\b/],
  ["friends", /\b(friends?|gang|group)\b/],
  ["solo", /\b(solo)\b/],
  ["parents", /\b(parents?|elderly)\b/],
  ["corporate", /\b(corporate|offsite|company)\b/],
];

const DESTINATION_ALIASES: Record<string, string[]> = {
  goa: ["goa", "north goa", "south goa", "palolem", "anjuna"],
  kerala: ["kerala", "kochi", "munnar", "alleppey", "backwaters"],
  dharamshala: ["dharamshala", "mcleod", "mcleodganj", "himachal", "dharamsala"],
  thailand: ["thailand", "phuket", "krabi", "bangkok", "koh samui"],
  japan: ["japan", "tokyo", "kyoto", "osaka"],
  vietnam: ["vietnam", "hanoi", "da nang", "hoi an", "ha long"],
  bali: ["bali", "indonesia", "ubud", "uluwatu"],
  malaysia: ["malaysia", "langkawi", "kuala lumpur", "kl"],
  dubai: ["dubai", "uae", "abu dhabi"],
  kashmir: ["kashmir", "srinagar", "gulmarg", "pahalgam"],
  ladakh: ["ladakh", "leh", "pangong", "nubra"],
  andaman: ["andaman", "andamans", "havelock", "port blair", "neil island"],
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// ---------- helpers ----------

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const word = (s: string) => new RegExp(`\\b${esc(s)}\\b`, "i");

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function shiftDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** Monday of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}
function monthRange(year: number, month: number): { from: Date; to: Date } {
  return { from: new Date(year, month, 1, 0, 0, 0, 0), to: new Date(year, month + 1, 0, 23, 59, 59, 999) };
}

/** Parse the time window mentioned in the question. */
export function parseRange(lower: string, now: Date, prefer: "past" | "future" = "past"): AskRange {
  const sod = startOfDay(now);
  if (/\btoday\b/.test(lower)) return { from: sod, to: endOfDay(now), label: "today" };
  if (/\byesterday\b/.test(lower)) return { from: shiftDays(sod, -1), to: endOfDay(shiftDays(sod, -1)), label: "yesterday" };
  if (/\btomorrow\b/.test(lower)) return { from: shiftDays(sod, 1), to: endOfDay(shiftDays(sod, 1)), label: "tomorrow", future: true };
  if (/\bthis week\b/.test(lower)) return { from: startOfWeek(now), to: endOfDay(now), label: "this week" };
  if (/\b(last|past|previous) week\b/.test(lower)) {
    const from = shiftDays(startOfWeek(now), -7);
    return { from, to: endOfDay(shiftDays(from, 6)), label: "last week" };
  }
  if (/\bthis month\b/.test(lower)) return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now), label: "this month" };
  if (/\b(last|past|previous) month\b/.test(lower)) {
    const r = monthRange(now.getFullYear(), now.getMonth() - 1);
    return { ...r, label: "last month" };
  }
  if (/\bnext month\b/.test(lower)) {
    const r = monthRange(now.getFullYear(), now.getMonth() + 1);
    return { ...r, label: "next month", future: true };
  }
  if (/\bthis year\b/.test(lower)) return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now), label: "this year" };
  if (/\b(last|past|previous) year\b/.test(lower)) {
    return { from: new Date(now.getFullYear() - 1, 0, 1), to: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999), label: "last year" };
  }
  const past = lower.match(/\b(?:last|past|previous)\s+(\d+)\s*(days?|weeks?|months?)\b/);
  if (past) {
    const n = parseInt(past[1], 10);
    const unit = past[2].startsWith("w") ? 7 : past[2].startsWith("m") ? 30 : 1;
    return { from: startOfDay(shiftDays(now, -n * unit)), to: endOfDay(now), label: `last ${n} ${past[2].replace(/s$/, "")}${n === 1 ? "" : "s"}` };
  }
  const next = lower.match(/\b(?:next|coming|upcoming|within(?: the)?(?: next)?|in the next)\s+(\d+)\s*(days?|weeks?|months?)\b/);
  if (next) {
    const n = parseInt(next[1], 10);
    const unit = next[2].startsWith("w") ? 7 : next[2].startsWith("m") ? 30 : 1;
    return { from: sod, to: endOfDay(shiftDays(now, n * unit)), label: `next ${n} ${next[2].replace(/s$/, "")}${n === 1 ? "" : "s"}`, future: true };
  }
  if (/\b(next|coming|upcoming) week\b/.test(lower)) {
    const from = shiftDays(startOfWeek(now), 7);
    return { from, to: endOfDay(shiftDays(from, 6)), label: "next week", future: true };
  }
  // Month names: full names stand alone, abbreviations need a preposition ("in dec").
  for (let i = 0; i < MONTHS.length; i++) {
    const full = MONTHS[i];
    const abbr = full.slice(0, 3);
    const m = lower.match(new RegExp(`\\b${full}\\b(?:\\s+(\\d{4}))?`)) ?? lower.match(new RegExp(`\\b(?:in|for|during|of)\\s+${abbr}\\b(?:\\s+(\\d{4}))?`));
    if (!m) continue;
    if (full === "may" && !/\b(in|for|during|of) may\b/.test(lower)) continue;
    let year = m[1] ? parseInt(m[1], 10) : now.getFullYear();
    if (!m[1]) {
      if (prefer === "future" && i < now.getMonth()) year += 1;
      if (prefer === "past" && i > now.getMonth()) year -= 1;
    }
    const r = monthRange(year, i);
    const label = `${full[0].toUpperCase()}${full.slice(1)} ${year}`;
    return { ...r, label, future: r.from > now };
  }
  return { label: "all time" };
}

function findEntity(lower: string): AskEntity | undefined {
  for (const [entity, re] of ENTITY_PATTERNS) if (re.test(lower)) return entity;
  return undefined;
}

function findMetric(lower: string, entity: AskEntity | undefined): AskMetric {
  if (/\b(average|avg|mean|typical)\b/.test(lower)) return "avg";
  if (/\b(top|most|best|popular|highest|biggest|largest|demand)\b/.test(lower)) return "top";
  if (/\b(revenue|booked value|booking value|sales|value|total amount|worth|collected|how much)\b/.test(lower)) return "sum";
  if (/\b(how many|number of|count|total)\b/.test(lower)) return "count";
  if (/\b(show|list|which|who|what are|give me|find|display)\b/.test(lower)) return "list";
  return entity === "trips" && /\bvalue\b/.test(lower) ? "sum" : "list";
}

function findGroupBy(lower: string): AskGroupBy | undefined {
  const m = lower.match(/\b(?:by|per|across|split by|broken down by|grouped by|for each)\s+([a-z _-]+?)(?=\s+(?:this|last|past|next|in|for|during|over|since|who|that|with)\b|[?.,]|$)/);
  if (m) {
    const by = m[1];
    if (/\b(source|origin|platform)\b/.test(by) || (/\bchannel\b/.test(by) && !/\bmessage|dm|chat|campaign/.test(lower))) return "source";
    if (/\b(channel|platform)\b/.test(by)) return "channel";
    if (/\b(stage|status|pipeline)\b/.test(by)) return "stage";
    if (/\b(destination|country|place|location)\b/.test(by)) return "destination";
    if (/\b(consultant|owner|rep|assignee|person|user|team ?member|agent|salesperson|handler)\b/.test(by)) return "consultant";
    if (/\b(month|monthly)\b/.test(by)) return "month";
    if (/\b(trip ?type|type of trip|type)\b/.test(by)) return "trip_type";
  }
  // Explicit "-wise" / "monthly" forms and "who has / who handled" questions.
  if (/\bmonthly\b|\bmonth[- ]?wise\b|\bper month\b|\bmonth on month\b/.test(lower)) return "month";
  if (/\bsource[- ]?wise\b/.test(lower)) return "source";
  if (/\bdestination[- ]?wise\b|\bcountry[- ]?wise\b/.test(lower)) return "destination";
  if (/\bstage[- ]?wise\b/.test(lower)) return "stage";
  if (/\bconsultant[- ]?wise\b|\bwho (has|handled|handles|owns|closed|booked)\b|\bper (consultant|person)\b/.test(lower)) return "consultant";
  return undefined;
}

function findDestination(lower: string, db: DemoData): string | undefined {
  for (const d of db.destinations) {
    const aliases = [d.name.toLowerCase(), ...(DESTINATION_ALIASES[d.id] ?? [])];
    if (aliases.some((a) => word(a).test(lower))) return d.id;
  }
  return undefined;
}

function findConsultant(lower: string, db: DemoData): string | undefined {
  if (/\b(aanya|voice agent|the agent|ai agent|the ai|bot)\b/.test(lower)) return "ai";
  if (/\bunassigned\b/.test(lower)) return "unassigned";
  for (const u of db.users) {
    const first = u.name.split(" ")[0].toLowerCase();
    if (word(u.name.toLowerCase()).test(lower) || word(first).test(lower)) return u.sub;
  }
  return undefined;
}

function findStatus(lower: string, entity: AskEntity | undefined): string | undefined {
  if (entity === "payments") {
    if (/\boverdue|late|past due|missed\b/.test(lower)) return "overdue";
    if (/\bpaid|received|collected\b/.test(lower) && !/\bunpaid|not paid\b/.test(lower)) return "paid";
    if (/\bpending|due|upcoming|unpaid|not paid|outstanding\b/.test(lower)) return "pending";
    if (/\brefund/.test(lower)) return "refunded";
  }
  if (entity === "tasks") {
    if (/\bdone|completed|finished\b/.test(lower)) return "done";
    if (/\bopen|pending|outstanding|due\b/.test(lower)) return "open";
  }
  if (entity === "itineraries") {
    if (/\bnot viewed|unviewed|unopened|not opened|sent but\b/.test(lower)) return "sent_not_viewed";
    for (const s of ["accepted", "rejected", "revised", "viewed", "sent", "draft"]) if (word(s).test(lower)) return s;
  }
  if (entity === "trips") {
    if (/\bcancelled|canceled\b/.test(lower)) return "cancelled";
    if (/\bon trip|travelling now|currently travelling\b/.test(lower)) return "on_trip";
    if (/\bdocs pending\b/.test(lower)) return "docs_pending";
    if (/\bcompleted\b/.test(lower)) return "completed";
  }
  if (entity === "calls") {
    if (/\bmissed|no answer|unanswered\b/.test(lower)) return "missed";
    if (/\bvoicemail\b/.test(lower)) return "voicemail";
  }
  return undefined;
}

function findNoReplyDays(lower: string): number | undefined {
  const a = lower.match(/(?:no reply|not replied|unanswered|waiting|no response|without (?:a )?(?:reply|response)|not responded|no answer)\D{0,24}?(\d+)\s*(days?|hours?)/);
  if (a) return a[2].startsWith("h") ? Math.max(0, Math.round(parseInt(a[1], 10) / 24)) : parseInt(a[1], 10);
  const b = lower.match(/(\d+)\s*days?\s*(?:without|with no|no)\s*(?:a )?(?:reply|response)/);
  if (b) return parseInt(b[1], 10);
  if (/\b(no reply|not replied|unanswered|waiting for (?:a )?reply|no response|without (?:a )?reply|awaiting reply|not responded)\b/.test(lower)) return 0;
  return undefined;
}

/** Parse a question into its structured form. */
export function parseQuestion(raw: string, db: DemoData, now: Date = new Date()): ParsedQuestion {
  const lower = raw.toLowerCase().replace(/\s+/g, " ").trim();
  const entity = findEntity(lower);
  const metric = findMetric(lower, entity);
  const groupBy = findGroupBy(lower);
  const prefer: "past" | "future" = entity === "trips" || /\bdepart|leaving|travelling in|travel in|upcoming|due\b/.test(lower) ? "future" : "past";
  const range = parseRange(lower, now, prefer);

  const filters: AskFilters = {};
  for (const [source, re] of SOURCE_PATTERNS) {
    if (re.test(lower)) {
      filters.source = source;
      break;
    }
  }
  // "by source" is a grouping, not a filter — and "phone" is a channel word in call questions.
  if (groupBy === "source" && filters.source && !/\bfrom\b|\bvia\b|\bonly\b/.test(lower)) delete filters.source;
  if (entity === "calls" && filters.source === "phone") delete filters.source;
  if (entity === "messages" && (filters.source === "whatsapp" || filters.source === "instagram" || filters.source === "email")) {
    // Channel filters on messages are expressed through `status` to keep LeadSource typing honest.
    filters.status = filters.source;
    delete filters.source;
  }
  for (const [stage, re] of STAGE_PATTERNS) {
    if (re.test(lower)) {
      filters.stage = stage;
      break;
    }
  }
  if (groupBy === "stage" && filters.stage === "open") delete filters.stage;
  for (const [tt, re] of TRIP_TYPE_PATTERNS) {
    if (re.test(lower)) {
      filters.tripType = tt;
      break;
    }
  }
  const destination = findDestination(lower, db);
  if (destination && groupBy !== "destination") filters.destination = destination;
  const consultant = findConsultant(lower, db);
  if (consultant) filters.consultantSub = consultant;
  const status = findStatus(lower, entity);
  if (status) filters.status = status;
  if (/\b(overdue|late|past due|missed due|behind schedule)\b/.test(lower)) filters.overdue = true;
  if (/\b(hot|warm|high[- ]score|high[- ]intent|promising|best leads?)\b/.test(lower)) filters.hot = true;
  const noReply = findNoReplyDays(lower);
  if (noReply !== undefined) filters.noReplyDays = noReply;

  const lim = lower.match(/\b(?:top|first|best|limit)\s+(\d+)\b/);
  const limit = lim ? Math.min(50, parseInt(lim[1], 10)) : undefined;

  const refs = Array.from(raw.toUpperCase().matchAll(/\b(WTB-\d{4}-\d{3,}|WT-\d{3,})\b/g)).map((m) => m[1]);

  return { raw, lower, entity, metric, groupBy, filters, range, limit, refs };
}
