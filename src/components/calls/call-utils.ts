import type { Call, CallOutcome, DemoData, Enquiry, Traveller } from "@/lib/demo/types";
import { simulateOutboundQualification } from "@/lib/ai/voice-agent";
import { scoreEnquiry } from "@/lib/ai/scoring";
import { destinationById, logActivity, userName } from "@/lib/demo/queries";
import { newId, nowIso } from "@/lib/demo/store";

export const OUTCOME_LABEL: Record<CallOutcome, string> = {
  qualified: "Qualified",
  callback: "Callback",
  not_interested: "Not interested",
  booked: "Booked",
  handoff: "Hand-off",
  info: "Info",
  voicemail: "Voicemail",
  no_answer: "No answer",
};

export const OUTCOME_CLASS: Record<CallOutcome, string> = {
  qualified: "bg-emerald-100 text-emerald-800",
  callback: "bg-sky-100 text-sky-800",
  not_interested: "bg-zinc-100 text-zinc-700",
  booked: "bg-brand-100 text-brand-800",
  handoff: "bg-rose-100 text-rose-700",
  info: "bg-indigo-100 text-indigo-800",
  voicemail: "bg-amber-100 text-amber-800",
  no_answer: "bg-amber-100 text-amber-800",
};

export const CALL_STATUS_CLASS: Record<Call["status"], string> = {
  completed: "bg-emerald-100 text-emerald-800",
  missed: "bg-rose-100 text-rose-700",
  voicemail: "bg-amber-100 text-amber-800",
  no_answer: "bg-amber-100 text-amber-800",
  in_progress: "bg-sky-100 text-sky-800",
};

export const SENTIMENT_CLASS: Record<NonNullable<Call["sentiment"]>, string> = {
  positive: "text-emerald-700",
  neutral: "text-muted-foreground",
  negative: "text-rose-700",
};

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function callerName(db: DemoData, c: Call): string {
  const t = c.travellerId ? db.travellers.find((x) => x.id === c.travellerId) : undefined;
  return t?.fullName ?? c.phone;
}

export function handledByLabel(db: DemoData, c: Call): string {
  return c.kind === "voice_agent" ? `${db.settings.agents.voice.name} · voice agent` : userName(db, c.handledBy);
}

/** Build a voice-agent call via the simulator and persist Call + AgentEvent + stage move. */
export function saveVoiceCall(db: DemoData, opts: { enquiry: Enquiry; traveller: Traveller; answered: boolean; prebuilt?: Omit<Call, "id"> }): Call {
  const enquiry = db.enquiries.find((x) => x.id === opts.enquiry.id) ?? opts.enquiry;
  const destination = destinationById(db, enquiry.destinationId);
  const consultantName = enquiry.assignedTo ? userName(db, enquiry.assignedTo).split(" ")[0] : "Your consultant";
  const built = opts.prebuilt ?? simulateOutboundQualification({ enquiry, traveller: opts.traveller, destination, config: db.settings.agents.voice, consultantName, answered: opts.answered });
  const call: Call = { id: newId("call"), ...built };
  db.calls.unshift(call);
  const answered = call.status === "completed";
  const agentName = db.settings.agents.voice.name;
  db.agentEvents.unshift({
    id: newId("evt"),
    agent: "voice",
    at: call.startedAt,
    enquiryId: enquiry.id,
    travellerId: opts.traveller.id,
    action: answered ? "Outbound qualification call completed" : "Outbound call — voicemail",
    detail: answered ? `${formatDuration(call.durationSec)} · captured month, pax and budget · ${call.summary ?? ""}` : "No answer — left voicemail, WhatsApp fallback sent",
    confidence: answered ? 0.93 : 0.5,
    status: "auto",
    payload: { callId: call.id },
  });
  const at = nowIso();
  enquiry.lastActivityAt = at;
  enquiry.updatedAt = at;
  if (answered && (enquiry.stage === "new" || enquiry.stage === "contacted")) {
    enquiry.stage = "qualified";
    enquiry.lastStageChangeAt = at;
    enquiry.handledByAgent = true;
    enquiry.needsAttention = false;
    if (enquiry.firstResponseMinutes == null) enquiry.firstResponseMinutes = Math.max(1, Math.min(30, Math.round((Date.now() - new Date(enquiry.createdAt).getTime()) / 60000)));
  }
  logActivity(db, { actor: `${agentName} (voice agent)`, actorKind: "ai", type: "call", text: answered ? `Outbound qualification call (${formatDuration(call.durationSec)}) — ${enquiry.stage === "qualified" ? "moved to Qualified" : "brief confirmed"}` : "Outbound call — voicemail, WhatsApp fallback sent", enquiryId: enquiry.id, travellerId: opts.traveller.id });
  return call;
}

/** Log a human call from the dialog. */
export function saveHumanCall(db: DemoData, opts: { enquiryId: string; user: { sub: string; name: string }; direction: Call["direction"]; minutes: number; outcome: CallOutcome; summary: string }): Call {
  const e = db.enquiries.find((x) => x.id === opts.enquiryId);
  const t = e ? db.travellers.find((x) => x.id === e.travellerId) : undefined;
  const at = nowIso();
  const call: Call = {
    id: newId("call"),
    enquiryId: opts.enquiryId,
    travellerId: t?.id,
    direction: opts.direction,
    kind: "human",
    handledBy: opts.user.sub,
    phone: t?.phone ?? "",
    startedAt: at,
    durationSec: Math.max(0, Math.round(opts.minutes * 60)),
    status: "completed",
    language: t?.language === "hi" ? "hi" : "en",
    transcript: [],
    summary: opts.summary || undefined,
    outcome: opts.outcome,
    sentiment: "neutral",
    recordingAvailable: false,
  };
  db.calls.unshift(call);
  if (e) {
    e.lastActivityAt = at;
    e.updatedAt = at;
    if (e.stage === "new") {
      e.stage = "contacted";
      e.lastStageChangeAt = at;
    }
  }
  logActivity(db, { actor: opts.user.name, actorKind: "user", type: "call", text: `${opts.direction === "outbound" ? "Called" : "Call from"} ${t?.fullName.split(" ")[0] ?? "traveller"} (${opts.minutes} min) — ${OUTCOME_LABEL[opts.outcome]}${opts.summary ? `: ${opts.summary.slice(0, 80)}` : ""}`, enquiryId: opts.enquiryId, travellerId: t?.id });
  return call;
}

/** Create Traveller + Enquiry from an unlinked inbound voice-agent call with extracted fields. */
export function createEnquiryFromCall(db: DemoData, callId: string, user: { sub: string; name: string }): Enquiry | undefined {
  const call = db.calls.find((c) => c.id === callId);
  if (!call || !call.extracted || call.enquiryId) return undefined;
  const x = call.extracted;
  const at = nowIso();
  const dest = db.destinations.find((d) => d.name.toLowerCase() === (x.destination ?? "").toLowerCase()) ?? db.destinations[0];
  let traveller = call.travellerId ? db.travellers.find((t) => t.id === call.travellerId) : db.travellers.find((t) => t.phone === call.phone);
  if (!traveller) {
    traveller = {
      id: newId("trv"),
      fullName: `Caller ${call.phone.slice(-4)}`,
      phone: call.phone,
      city: x.departureCity ?? "Bengaluru",
      preferredChannel: "whatsapp",
      language: call.language,
      nationality: "Indian",
      foodPref: "no_preference",
      pace: "balanced",
      comfort: "comfort",
      interests: [],
      tags: [],
      blocked: false,
      tripsCount: 0,
      lifetimeValueINR: 0,
      createdAt: at,
    };
    db.travellers.push(traveller);
  }
  const maxRef = db.enquiries.reduce((m, e) => Math.max(m, parseInt(e.ref.replace(/\D/g, ""), 10) || 0), 1000);
  const pax = x.pax ?? { adults: 2, children: 0, infants: 0 };
  const nights = x.nights ?? 5;
  const consultant = db.users.find((u) => u.active && u.role === "SALES" && u.specialities.includes(dest.id)) ?? db.users.find((u) => u.active && u.role === "SALES");
  const enquiry: Enquiry = {
    id: newId("enq"),
    ref: `WT-${maxRef + 1}`,
    travellerId: traveller.id,
    stage: "qualified",
    source: "phone",
    destinationId: dest.id,
    destination: dest.name,
    altDestinations: [],
    travelMonth: x.travelMonth,
    nights,
    flexibility: "flexible_month",
    pax,
    rooms: Math.max(1, Math.ceil(pax.adults / 2)),
    tripType: x.tripType ?? "couple",
    pace: "balanced",
    comfort: "comfort",
    foodPref: "no_preference",
    budgetINR: x.budgetINR ?? dest.fromPriceINR * (pax.adults + pax.children),
    includeFlights: dest.region === "international",
    departureCity: x.departureCity ?? traveller.city,
    interests: [],
    notes: call.summary ? `From voice-agent call: ${call.summary}` : undefined,
    assignedTo: consultant?.sub,
    tags: ["phone-lead"],
    aiScore: null,
    needsAttention: false,
    handledByAgent: true,
    firstResponseMinutes: 0,
    createdAt: at,
    updatedAt: at,
    lastActivityAt: at,
    lastInboundAt: call.startedAt,
    lastStageChangeAt: at,
  };
  enquiry.aiScore = scoreEnquiry(enquiry, { messagesCount: 0, hasItinerary: false, traveller });
  enquiry.aiSummary = `${dest.name} enquiry captured by ${db.settings.agents.voice.name} on an inbound call${x.travelMonth ? ` for ${x.travelMonth}` : ""}.`;
  db.enquiries.unshift(enquiry);
  call.enquiryId = enquiry.id;
  call.travellerId = traveller.id;
  db.agentEvents.unshift({ id: newId("evt"), agent: "scoring", at, enquiryId: enquiry.id, travellerId: traveller.id, action: "Scored conversion likelihood", detail: `${enquiry.aiScore}/100 — new phone lead from voice agent call`, confidence: 0.8, status: "info" });
  logActivity(db, { actor: user.name, actorKind: "user", type: "enquiry_created", text: `Created ${enquiry.ref} (${dest.name}) from ${db.settings.agents.voice.name}'s call`, enquiryId: enquiry.id, travellerId: traveller.id });
  return enquiry;
}
