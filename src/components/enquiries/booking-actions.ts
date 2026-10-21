import type { ChecklistItem, DemoData, Enquiry, EnquiryStage, Itinerary, Message, Payment, Trip, User } from "@/lib/demo/types";
import { newId, nowIso } from "@/lib/demo/store";
import { destinationById, enquiryById, itinerariesForEnquiry, logActivity, travellerById, userBySub } from "@/lib/demo/queries";
import { stageIndex, stageLabel } from "@/lib/pipeline";
import { addDays } from "@/lib/utils";

/**
 * Shared enquiry mutations used by the kanban, the drawer and the new-enquiry
 * dialog. Every function here expects to run inside `mutateDb((db) => …)`.
 */

export interface Actor {
  sub: string;
  name: string;
}

export const ACTOR_SYSTEM: Actor = { sub: "system", name: "System" };

export const isConsultant = (u: User) => u.active && (u.role === "SALES" || u.role === "MANAGER");

export function nextEnquiryRef(db: DemoData): string {
  const max = db.enquiries.reduce((m, e) => {
    const n = Number(e.ref.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 1000);
  return `WT-${max + 1}`;
}

export function nextTripRef(db: DemoData): string {
  const year = new Date().getFullYear();
  const max = db.trips.reduce((m, t) => {
    const n = Number(t.ref.split("-").pop());
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `WTB-${year}-${String(max + 1).padStart(3, "0")}`;
}

/** Fill `{{var}}` placeholders in a message template. */
export function fillTemplate(body: string, vars: Record<string, string | number | undefined>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (vars[k] == null ? `{{${k}}}` : String(vars[k])));
}

export const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full;

export function touch(e: Enquiry, at = nowIso()) {
  e.updatedAt = at;
  e.lastActivityAt = at;
}

/** Mirrors the seed's checklist so trips confirmed in the demo look identical to seeded ones. */
export function buildChecklist(db: DemoData, destinationId: string): ChecklistItem[] {
  const dest = destinationById(db, destinationId);
  const visa = dest?.visa.type;
  return [
    { key: "advance", label: "Advance received & booking confirmed", offsetDays: -60, done: true, doneAt: nowIso(), auto: true },
    { key: "passports", label: "Passport copies for all travellers", offsetDays: -50, done: false, auto: false },
    ...(visa === "embassy" || visa === "evisa" ? [{ key: "visa", label: `Visa ${visa === "embassy" ? "appointment & submission" : "e-visa applied"}`, offsetDays: -40, done: false, auto: false }] : []),
    { key: "stays", label: "Stays confirmed with suppliers", offsetDays: -35, done: false, auto: false },
    { key: "flights", label: "Flights ticketed (PNR shared)", offsetDays: -30, done: false, auto: false },
    { key: "insurance", label: "Travel insurance issued", offsetDays: -21, done: false, auto: false },
    { key: "balance", label: "Balance payment received", offsetDays: -21, done: false, auto: true },
    { key: "vouchers", label: "Vouchers & tickets sent on WhatsApp", offsetDays: -7, done: false, auto: false },
    { key: "predeparture", label: "Pre-departure call / message", offsetDays: -1, done: false, auto: true },
    { key: "midtrip", label: "Mid-trip check-in", offsetDays: 2, done: false, auto: true },
    { key: "review", label: "Review & referral request", offsetDays: 99, done: false, auto: true },
  ];
}

/**
 * Confirm the booking for an enquiry: creates the Trip (status confirmed) and
 * the instalment schedule from settings, marks the advance as paid and moves
 * the enquiry to Advance Paid. Idempotent — returns the existing trip if there is one.
 */
export function confirmBooking(db: DemoData, enquiryId: string, itineraryId?: string, actor: Actor = ACTOR_SYSTEM): Trip | undefined {
  const e = enquiryById(db, enquiryId);
  if (!e) return undefined;
  const existing = e.tripId ? db.trips.find((t) => t.id === e.tripId) : undefined;
  if (existing) return existing;

  const traveller = travellerById(db, e.travellerId);
  const versions = itinerariesForEnquiry(db, enquiryId);
  const itinerary: Itinerary | undefined = (itineraryId && versions.find((i) => i.id === itineraryId)) || versions.find((i) => i.status === "accepted") || versions[0];
  const now = nowIso();

  if (itinerary && itinerary.status !== "accepted") itinerary.status = "accepted";

  const start = e.travelStart ?? itinerary?.startDate ?? (e.travelMonth ? `${e.travelMonth}-15T00:00:00.000Z` : addDays(now, 30).toISOString());
  const nights = Math.max(1, e.nights || itinerary?.nights || 4);
  const end = e.travelEnd ?? addDays(start, nights).toISOString();
  const total = itinerary?.pricing.totalINR ?? e.budgetINR;

  const trip: Trip = {
    id: newId("trip"),
    ref: nextTripRef(db),
    enquiryId: e.id,
    travellerId: e.travellerId,
    travellerIds: [e.travellerId],
    itineraryId: itinerary?.id ?? "",
    destinationId: e.destinationId,
    destination: e.destination,
    title: itinerary?.title ?? `${e.nights}-night ${e.destination} trip`,
    startDate: start,
    endDate: end,
    pax: { ...e.pax },
    status: "confirmed",
    totalINR: total,
    paidINR: 0,
    marginINR: itinerary?.pricing.marginINR ?? Math.round(total * 0.14),
    checklist: buildChecklist(db, e.destinationId),
    tripCaptain: db.users.find((u) => u.role === "OPS" && u.active)?.sub,
    specialRequests: e.notes,
    cancellationPolicy: "Token non-refundable · 61+ days 10% · 31–60 days 25% · 15–30 days 50% · <15 days 100% · GST non-refundable",
    createdAt: now,
  };
  db.trips.push(trip);

  const schedule = db.settings.payment.schedule;
  const nowMs = Date.parse(now);
  schedule.forEach((s, si) => {
    const amount = Math.round((total * s.pct) / 100);
    const due = si === 0 ? new Date(now) : addDays(start, s.offsetDays);
    const paid = si === 0;
    const p: Payment = {
      id: newId("pay"),
      tripId: trip.id,
      travellerId: e.travellerId,
      label: s.label,
      amountINR: amount,
      dueAt: (due.getTime() < nowMs ? new Date(now) : due).toISOString(),
      status: paid ? "paid" : "pending",
      paidAt: paid ? now : undefined,
      mode: paid ? "upi" : undefined,
      reference: paid ? `UPI${Math.floor(100000000 + Math.random() * 899999999)}` : undefined,
      linkUrl: `https://rzp.io/l/wt-${trip.ref.toLowerCase()}-${si + 1}`,
      invoiceNo: paid ? `INV/26-27/${Math.floor(100 + Math.random() * 899)}` : undefined,
      receiptNo: paid ? `RCP/26-27/${Math.floor(100 + Math.random() * 899)}` : undefined,
      reminderCount: 0,
    };
    db.payments.push(p);
    if (paid) trip.paidINR += amount;
  });

  e.tripId = trip.id;
  e.needsAttention = false;
  if (stageIndex(e.stage) < stageIndex("advance_paid")) {
    e.stage = "advance_paid";
    e.lastStageChangeAt = now;
  }
  touch(e, now);
  if (traveller) {
    traveller.tripsCount += 1;
    traveller.lifetimeValueINR += total;
  }

  const ops = db.users.find((u) => u.role === "OPS" && u.active);
  db.tasks.push({
    id: newId("task"),
    title: `Collect passport copies — ${trip.ref}`,
    kind: "document",
    enquiryId: e.id,
    tripId: trip.id,
    travellerId: e.travellerId,
    assignedTo: ops?.sub,
    dueAt: addDays(now, 3).toISOString(),
    status: "open",
    priority: "high",
    createdBy: "system",
    createdAt: now,
  });

  logActivity(db, {
    actor: actor.name,
    actorKind: actor.sub === "system" ? "system" : "user",
    type: "booking_confirmed",
    text: `Booking ${trip.ref} confirmed — advance ₹${trip.paidINR.toLocaleString("en-IN")} received`,
    enquiryId: e.id,
    tripId: trip.id,
    travellerId: e.travellerId,
  });
  return trip;
}

/** Mark an enquiry lost with a reason. */
export function markLost(db: DemoData, enquiryId: string, reason: string, actor: Actor): void {
  const e = enquiryById(db, enquiryId);
  if (!e) return;
  const now = nowIso();
  e.stage = "lost";
  e.lostReason = reason.trim() || "No reason given";
  e.needsAttention = false;
  e.lastStageChangeAt = now;
  touch(e, now);
  for (const t of db.tasks) if (t.enquiryId === e.id && t.status === "open") t.status = "cancelled";
  logActivity(db, { actor: actor.name, actorKind: "user", type: "stage_change", text: `Marked lost — ${e.lostReason}`, enquiryId: e.id, travellerId: e.travellerId });
}

/**
 * Generic stage move with the side-effects a consultant expects: moving into
 * Advance Paid confirms the booking (trip + payments). Use `markLost` for Lost.
 */
export function moveStage(db: DemoData, enquiryId: string, stage: EnquiryStage, actor: Actor): void {
  const e = enquiryById(db, enquiryId);
  if (!e || e.stage === stage) return;
  const from = e.stage;
  const now = nowIso();
  e.stage = stage;
  e.lastStageChangeAt = now;
  if (stage === "contacted" || stage === "qualified") e.needsAttention = false;
  touch(e, now);
  logActivity(db, { actor: actor.name, actorKind: "user", type: "stage_change", text: `Moved from ${stageLabel(from)} to ${stageLabel(stage)}`, enquiryId: e.id, travellerId: e.travellerId });
  if (stage === "advance_paid" && !e.tripId) confirmBooking(db, enquiryId, undefined, actor);
}

/** Send an itinerary version to the traveller on their preferred channel. */
export function sendItinerary(db: DemoData, itineraryId: string, actor: Actor): Message | undefined {
  const it = db.itineraries.find((i) => i.id === itineraryId);
  if (!it) return undefined;
  const e = enquiryById(db, it.enquiryId);
  const traveller = travellerById(db, e?.travellerId);
  if (!e || !traveller) return undefined;
  const now = nowIso();
  const tpl = db.templates.find((t) => t.id === "tpl_itinerary_sent");
  const pax = e.pax.adults + e.pax.children + e.pax.infants;
  const body = fillTemplate(tpl?.body ?? "{{first_name}}, your {{nights}}-night {{destination}} plan is ready: {{itinerary_link}} · Total ₹{{total}}", {
    first_name: firstName(traveller.fullName),
    nights: it.nights,
    destination: e.destination,
    itinerary_link: `https://wishtrip.co/i/${it.shareSlug}`,
    total: it.pricing.totalINR.toLocaleString("en-IN"),
    pax,
  });
  const channel = traveller.preferredChannel === "phone" || traveller.preferredChannel === "sms" ? "whatsapp" : traveller.preferredChannel;
  const msg: Message = { id: newId("msg"), travellerId: traveller.id, enquiryId: e.id, channel, direction: "outbound", body, at: now, sentBy: actor.sub, status: "sent", templateId: tpl?.id };
  db.messages.push(msg);
  if (tpl) tpl.usageCount += 1;
  it.status = "sent";
  it.sentAt = now;
  if (stageIndex(e.stage) < stageIndex("itinerary_sent")) {
    e.stage = "itinerary_sent";
    e.lastStageChangeAt = now;
  }
  e.needsAttention = false;
  touch(e, now);
  logActivity(db, { actor: actor.name, actorKind: "user", type: "itinerary_sent", text: `Sent itinerary v${it.version} (${it.title}) on ${channel}`, enquiryId: e.id, travellerId: traveller.id });
  return msg;
}

/** Pick a consultant for a destination: specialist with the fewest open leads, else the least-busy SALES user. */
export function autoAssign(db: DemoData, destinationId: string): { user: User; reason: string } | undefined {
  const openCount = (sub: string) => db.enquiries.filter((e) => e.assignedTo === sub && !["completed", "lost", "non_lead"].includes(e.stage)).length;
  const sales = db.users.filter((u) => u.active && u.role === "SALES");
  const pool = sales.length ? sales : db.users.filter(isConsultant);
  if (!pool.length) return undefined;
  const specialists = pool.filter((u) => u.specialities.includes(destinationId));
  const ranked = (specialists.length ? specialists : pool).slice().sort((a, b) => openCount(a.sub) - openCount(b.sub));
  const user = ranked[0];
  const reason = specialists.length ? `destination specialist, ${openCount(user.sub)} open leads` : `round-robin (least busy), ${openCount(user.sub)} open leads`;
  return { user, reason };
}

export const consultantName = (db: DemoData, sub?: string | null) => userBySub(db, sub)?.name ?? "wishtrip";
