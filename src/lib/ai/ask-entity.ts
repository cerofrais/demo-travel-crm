/**
 * Ask the data — entity lookup. "Show me Priya Pillai" / "WT-1045" /
 * "what's happening with WTB-2026-021" → a narrative lead summary, or a
 * `choose` answer when a bare first name matches several travellers.
 */
import type { Enquiry, Traveller } from "@/lib/demo/types";
import { enquiriesForTraveller, messagesForEnquiry, paymentsForTrip, tasksForEnquiry, travellerById, tripById, userName } from "@/lib/demo/queries";
import { SOURCE_LABEL, STAGE_MAP, TRIP_TYPE_LABEL } from "@/lib/pipeline";
import { formatDate, formatINR, paxLabel, pluralize, relativeTime } from "@/lib/utils";
import type { ParsedQuestion } from "./ask-parse";
import type { AskContext, HandlerResult, Row } from "./ask-util";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, w: string) => new RegExp(`\\b${esc(w)}\\b`, "i").test(text);

/** Words that are never a traveller's name even if the seed happens to produce one. */
const STOP = new Set(["show", "me", "who", "is", "what", "about", "find", "lookup", "look", "up", "status", "of", "the", "with", "for", "tell", "lead", "enquiry", "happening", "summary", "and", "or", "a", "an"]);

export function latestEnquiryFor(ctx: AskContext, traveller: Traveller): Enquiry | undefined {
  const list = enquiriesForTraveller(ctx.db, traveller.id).filter((e) => ctx.visibleEnquiryIds.has(e.id));
  return list.find((e) => !["completed", "lost", "non_lead"].includes(e.stage)) ?? list[0];
}

function candidateRow(ctx: AskContext, t: Traveller): Row {
  const e = latestEnquiryFor(ctx, t);
  return { Ref: e?.ref ?? "—", Traveller: t.fullName, City: t.city, Phone: t.phone, Destination: e?.destination ?? "—", Stage: e ? STAGE_MAP[e.stage]?.label ?? e.stage : "—", Owner: e ? userName(ctx.db, e.assignedTo) : "—", "Last activity": e ? relativeTime(e.lastActivityAt, ctx.now) : "—" };
}

/** Full narrative for one enquiry (or a traveller with no visible enquiry). */
export function narrativeFor(ctx: AskContext, traveller: Traveller, enquiry: Enquiry | undefined): HandlerResult {
  if (!enquiry) {
    return {
      mode: "narrative",
      text: `${traveller.fullName} (${traveller.city}, ${traveller.phone}) is a traveller with no enquiry you can see — ${traveller.tripsCount} past ${pluralize(traveller.tripsCount, "trip").split(" ")[1]}, lifetime value ${formatINR(traveller.lifetimeValueINR)}.`,
      query: `SELECT * FROM travellers WHERE id = '${traveller.id}'`,
      entityId: traveller.id,
      entityKind: "traveller",
    };
  }
  const e = enquiry;
  const msgs = messagesForEnquiry(ctx.db, e.id);
  const last = msgs[msgs.length - 1];
  const tasks = tasksForEnquiry(ctx.db, e.id).filter((t) => t.status === "open");
  const trip = tripById(ctx.db, e.tripId);
  const payments = trip ? paymentsForTrip(ctx.db, trip.id) : [];
  const overdue = payments.filter((p) => p.status === "overdue" || (p.status === "pending" && new Date(p.dueAt) < ctx.now));
  const dates = e.travelStart ? `${formatDate(e.travelStart, "short")} – ${formatDate(e.travelEnd, "short")}` : e.travelMonth ? `in ${new Date(`${e.travelMonth}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}` : "dates TBC";
  const lines: string[] = [];
  lines.push(`${traveller.fullName} (${e.ref}) — ${TRIP_TYPE_LABEL[e.tripType].toLowerCase()} trip to ${e.destination}, ${dates}, ${e.nights} nights, ${paxLabel(e.pax)}, budget ${formatINR(e.budgetINR)}.`);
  lines.push(`Stage: ${STAGE_MAP[e.stage]?.label ?? e.stage} (since ${relativeTime(e.lastStageChangeAt, ctx.now)}). Source: ${SOURCE_LABEL[e.source]}. Owner: ${userName(ctx.db, e.assignedTo)}. AI score ${e.aiScore ?? "—"}${e.aiSummary ? ` — ${e.aiSummary}` : ""}`);
  if (last) lines.push(`Last message ${relativeTime(last.at, ctx.now)} (${last.direction === "inbound" ? "from traveller" : last.sentBy === "ai" ? "from Wish, the AI" : `from ${userName(ctx.db, last.sentBy)}`} on ${last.channel}): “${last.body.length > 140 ? `${last.body.slice(0, 140)}…` : last.body}”`);
  else lines.push("No messages on this enquiry yet.");
  if (tasks.length) lines.push(`Open tasks (${tasks.length}): ${tasks.slice(0, 3).map((t) => `${t.title} — ${userName(ctx.db, t.assignedTo)}, due ${formatDate(t.dueAt, "short")}`).join("; ")}${tasks.length > 3 ? "; …" : ""}.`);
  else lines.push("No open tasks.");
  if (trip) lines.push(`Trip ${trip.ref}: ${trip.status.replace(/_/g, " ")}, ${formatDate(trip.startDate, "short")} – ${formatDate(trip.endDate, "short")}, ${formatINR(trip.paidINR)} of ${formatINR(trip.totalINR)} paid${overdue.length ? ` — ${pluralize(overdue.length, "instalment")} overdue (${formatINR(overdue.reduce((s, p) => s + p.amountINR, 0))})` : payments.length ? `, next due ${formatDate(payments.find((p) => p.status === "pending")?.dueAt)}` : ""}.`);
  if (e.aiNextAction) lines.push(`Suggested next action: ${e.aiNextAction}`);
  const rows: Row[] = payments.map((p) => ({ Instalment: p.label, Amount: formatINR(p.amountINR), Due: formatDate(p.dueAt), Status: p.status }));
  return {
    mode: "narrative",
    text: lines.join("\n"),
    columns: rows.length ? ["Instalment", "Amount", "Due", "Status"] : undefined,
    rows: rows.length ? rows : undefined,
    query: `SELECT e.*, t.*, m.body AS last_message, (SELECT COUNT(*) FROM tasks WHERE enquiry_id = e.id AND status = 'open') AS open_tasks FROM enquiries e JOIN travellers t ON t.id = e.traveller_id LEFT JOIN LATERAL (SELECT body FROM messages WHERE enquiry_id = e.id ORDER BY at DESC LIMIT 1) m ON true WHERE e.ref = '${e.ref}'`,
    entityId: e.id,
    entityKind: "enquiry",
  };
}

/** Exact lookups: an enquiry/trip ref or a full traveller name in the question. */
export function exactLookup(q: ParsedQuestion, ctx: AskContext): HandlerResult | null {
  for (const ref of q.refs) {
    const e = ctx.db.enquiries.find((x) => x.ref === ref);
    if (e) {
      if (!ctx.visibleEnquiryIds.has(e.id)) return { mode: "unknown", text: `${ref} exists but isn't in your view — it's assigned to another consultant.`, query: `SELECT * FROM enquiries WHERE ref = '${ref}'` };
      const t = travellerById(ctx.db, e.travellerId)!;
      return narrativeFor(ctx, t, e);
    }
    const trip = ctx.db.trips.find((x) => x.ref === ref);
    if (trip) {
      const e2 = ctx.db.enquiries.find((x) => x.id === trip.enquiryId);
      const t = travellerById(ctx.db, trip.travellerId)!;
      const out = narrativeFor(ctx, t, e2);
      return { ...out, entityId: trip.id, entityKind: "trip" };
    }
    return { mode: "unknown", text: `Couldn't find anything with the reference ${ref}. Enquiry refs look like WT-1045 and trip refs like WTB-2026-021.`, query: `SELECT * FROM enquiries WHERE ref = '${ref}' UNION SELECT * FROM trips WHERE ref = '${ref}'` };
  }
  const full = ctx.db.travellers.filter((t) => hasWord(q.lower, t.fullName.toLowerCase()));
  if (full.length === 1) return narrativeFor(ctx, full[0], latestEnquiryFor(ctx, full[0]));
  if (full.length > 1) return chooseAmong(ctx, full, full[0].fullName);
  return null;
}

/** Fallback: a first/last name in the question matches one or more travellers. */
export function fuzzyLookup(q: ParsedQuestion, ctx: AskContext): HandlerResult | null {
  const words = q.lower.replace(/[^a-z\s'-]/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
  if (!words.length) return null;
  const matches = ctx.db.travellers.filter((t) => {
    const parts = t.fullName.toLowerCase().split(/\s+/);
    return words.some((w) => parts.includes(w));
  });
  if (!matches.length) return null;
  if (matches.length === 1) return narrativeFor(ctx, matches[0], latestEnquiryFor(ctx, matches[0]));
  const name = words.find((w) => matches.some((t) => t.fullName.toLowerCase().split(/\s+/).includes(w))) ?? words[0];
  return chooseAmong(ctx, matches, name);
}

function chooseAmong(ctx: AskContext, matches: Traveller[], name: string): HandlerResult {
  const sorted = [...matches].sort((a, b) => (latestEnquiryFor(ctx, b)?.lastActivityAt ?? "").localeCompare(latestEnquiryFor(ctx, a)?.lastActivityAt ?? ""));
  const rows = sorted.slice(0, 12).map((t) => candidateRow(ctx, t));
  return {
    mode: "choose",
    text: `${matches.length} travellers match “${name[0].toUpperCase()}${name.slice(1)}”. Pick one to see the full picture.`,
    columns: Object.keys(rows[0]),
    rows,
    query: `SELECT t.full_name, t.city, e.ref, e.destination, e.stage FROM travellers t LEFT JOIN enquiries e ON e.traveller_id = t.id WHERE t.full_name ILIKE '%${name}%' ORDER BY e.last_activity_at DESC`,
  };
}
