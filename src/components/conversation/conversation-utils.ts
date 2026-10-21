import type { AgentEvent, AutoReplyRule, Channel, DemoData, Enquiry, Message, Traveller } from "@/lib/demo/types";
import { decideReply, type ReplyDecision } from "@/lib/ai/autoreply";
import { destinationById, itinerariesForEnquiry, logActivity, tripById, userName } from "@/lib/demo/queries";
import { newId, nowIso } from "@/lib/demo/store";
import { stageIndex } from "@/lib/pipeline";
import { formatDate, paxCount } from "@/lib/utils";

/** Canned inbound texts for the "Simulate traveller reply" menu. */
export const CANNED_REPLIES = [
  "How much for 2 people in December?",
  "Is a visa needed?",
  "Can we add one more night and a beach stay?",
  "Any discount if we pay full now?",
  "I want to cancel, family emergency",
  "Thanks, looks perfect!",
];

export const THREAD_CHANNELS: Channel[] = ["whatsapp", "instagram", "email"];

/** Fill {{var}} placeholders from enquiry / traveller / user context. Unknown vars stay as-is. */
export function fillTemplate(body: string, db: DemoData, opts: { traveller: Traveller; enquiry?: Enquiry; userName: string }): string {
  const { traveller, enquiry } = opts;
  const dest = destinationById(db, enquiry?.destinationId);
  const latestItin = enquiry ? itinerariesForEnquiry(db, enquiry.id)[0] : undefined;
  const trip = tripById(db, enquiry?.tripId);
  const total = latestItin?.pricing.totalINR ?? trip?.totalINR;
  const pct = db.settings.payment.tokenPct;
  const month = enquiry?.travelMonth ? new Date(enquiry.travelMonth + "-01").toLocaleDateString("en-IN", { month: "long" }) : undefined;
  const vars: Record<string, string | undefined> = {
    first_name: traveller.fullName.split(" ")[0],
    destination: enquiry?.destination ?? dest?.name,
    agent_name: opts.userName.split(" ")[0] || "wishtrip",
    nights: enquiry ? String(enquiry.nights) : undefined,
    pax: enquiry ? String(paxCount(enquiry.pax)) : undefined,
    ref: trip?.ref ?? enquiry?.ref,
    month,
    total: total != null ? total.toLocaleString("en-IN") : undefined,
    amount: total != null ? Math.round((total * pct) / 100).toLocaleString("en-IN") : undefined,
    pct: String(pct),
    pay_link: enquiry ? `rzp.io/l/wt-${enquiry.ref.toLowerCase()}` : undefined,
    itinerary_link: latestItin ? `wishtrip.co/i/${latestItin.shareSlug}` : enquiry ? `wishtrip.co/i/${enquiry.ref.toLowerCase()}` : undefined,
    version: latestItin ? String(latestItin.version) : undefined,
    captain: trip?.tripCaptain ? userName(db, trip.tripCaptain) : undefined,
    dates: enquiry?.travelStart ? `${formatDate(enquiry.travelStart, "short")} – ${formatDate(enquiry.travelEnd ?? enquiry.travelStart, "short")}` : month,
    code: traveller.referralCode,
    from_price: dest ? dest.fromPriceINR.toLocaleString("en-IN") : undefined,
    visa_note: dest?.visa.note,
    stay: latestItin?.stays[0]?.name,
    due_date: trip ? formatDate(trip.startDate, "medium") : undefined,
  };
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => vars[k] ?? m);
}

export function senderLabel(db: DemoData, m: Message, travellerName: string, persona: string): string {
  if (m.direction === "inbound") return travellerName;
  if (m.sentBy === "ai") return `${persona} · AI agent`;
  if (m.sentBy === "system") return "System";
  return userName(db, m.sentBy);
}

/** Append an inbound traveller message (used by the simulator). */
export function appendInbound(db: DemoData, opts: { traveller: Traveller; enquiry?: Enquiry; channel: Channel; text: string }): Message {
  const at = nowIso();
  const m: Message = {
    id: newId("msg"),
    travellerId: opts.traveller.id,
    enquiryId: opts.enquiry?.id,
    channel: opts.channel,
    direction: "inbound",
    body: opts.text,
    at,
    sentBy: "traveller",
    status: "read",
  };
  db.messages.push(m);
  if (opts.enquiry) {
    const e = db.enquiries.find((x) => x.id === opts.enquiry!.id);
    if (e) {
      e.lastInboundAt = at;
      e.lastActivityAt = at;
      e.updatedAt = at;
      if (opts.channel === "whatsapp") e.whatsappWindowExpiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    }
  }
  logActivity(db, { actor: opts.traveller.fullName, actorKind: "traveller", type: "message_received", text: `${opts.traveller.fullName.split(" ")[0]} wrote on ${opts.channel}: "${opts.text.slice(0, 80)}"`, enquiryId: opts.enquiry?.id, travellerId: opts.traveller.id });
  return m;
}

/** Keyword rules that match the text on this channel. */
export function matchingRules(rules: AutoReplyRule[], text: string, channel: Channel): AutoReplyRule[] {
  const t = text.toLowerCase();
  return rules.filter((r) => r.active && r.mode !== "off" && r.channels.includes(channel) && r.keywords.length > 0 && r.keywords.some((k) => t.includes(k.toLowerCase())));
}

/**
 * Run the auto-reply agent for an inbound text and persist the outcome:
 * the reply message (sent or draft), an AgentEvent, stage/tag/attention
 * updates on the enquiry and rule hit counters.
 */
export function runAutoReply(db: DemoData, opts: { traveller: Traveller; enquiry: Enquiry; channel: Channel; text: string }): { decision: ReplyDecision; message: Message; event: AgentEvent } {
  const enquiry = db.enquiries.find((x) => x.id === opts.enquiry.id) ?? opts.enquiry;
  const destination = destinationById(db, enquiry.destinationId);
  const consultantName = enquiry.assignedTo ? userName(db, enquiry.assignedTo).split(" ")[0] : "your consultant";
  const autoRepliesSoFar = db.messages.filter((m) => m.travellerId === opts.traveller.id && m.channel === opts.channel && m.sentBy === "ai" && m.status !== "draft").length;
  const decision = decideReply({ text: opts.text, enquiry, traveller: opts.traveller, destination, config: db.settings.agents.autoReply, rules: db.autoReplyRules, consultantName, autoRepliesSoFar });
  const at = nowIso();
  const isDraft = decision.action !== "auto_sent";
  const message: Message = {
    id: newId("msg"),
    travellerId: opts.traveller.id,
    enquiryId: enquiry.id,
    channel: opts.channel,
    direction: "outbound",
    body: decision.reply,
    at,
    sentBy: "ai",
    status: isDraft ? "draft" : "sent",
    ai: { intent: decision.intent, confidence: decision.confidence, action: decision.action, reason: decision.reason },
  };
  db.messages.push(message);
  const actionLabel = decision.action === "auto_sent" ? `Auto-replied (${decision.intent})` : decision.action === "drafted" ? `Drafted reply (${decision.intent})` : `Escalated to consultant (${decision.intent})`;
  const event: AgentEvent = {
    id: newId("evt"),
    agent: "autoreply",
    at,
    enquiryId: enquiry.id,
    travellerId: opts.traveller.id,
    action: actionLabel,
    detail: decision.reason,
    confidence: decision.confidence,
    status: isDraft ? "needs_review" : "auto",
    payload: { messageId: message.id, intent: decision.intent, extracted: decision.extracted, text: opts.text },
  };
  db.agentEvents.unshift(event);

  enquiry.lastActivityAt = at;
  enquiry.updatedAt = at;
  if (decision.suggestedStage && stageIndex(enquiry.stage) < stageIndex(decision.suggestedStage) && stageIndex(enquiry.stage) >= 0 && !["lost", "non_lead", "completed"].includes(enquiry.stage)) {
    enquiry.stage = decision.suggestedStage;
    enquiry.lastStageChangeAt = at;
    enquiry.handledByAgent = true;
    logActivity(db, { actor: `${db.settings.agents.autoReply.persona} (auto-reply agent)`, actorKind: "ai", type: "stage_change", text: `Moved to ${decision.suggestedStage.replace("_", " ")} after reading the traveller's reply`, enquiryId: enquiry.id, travellerId: opts.traveller.id });
  }
  if (decision.tag && !enquiry.tags.includes(decision.tag)) enquiry.tags.push(decision.tag);
  if (isDraft) enquiry.needsAttention = true;
  if (!isDraft && enquiry.firstResponseMinutes == null) enquiry.firstResponseMinutes = 1;
  for (const r of matchingRules(db.autoReplyRules, opts.text, opts.channel)) r.hits += 1;
  logActivity(db, { actor: `${db.settings.agents.autoReply.persona} (auto-reply agent)`, actorKind: "ai", type: isDraft ? "ai_draft" : "auto_reply", text: isDraft ? `${decision.action === "escalated" ? "Escalated" : "Drafted a reply"} — ${decision.reason}` : `Auto-replied on ${opts.channel} (${decision.intent}, ${Math.round(decision.confidence * 100)}%)`, enquiryId: enquiry.id, travellerId: opts.traveller.id });
  return { decision, message, event };
}

/** Find the review event that belongs to a draft message (by payload id, else latest needs_review for the enquiry). */
export function eventForDraft(db: DemoData, m: Message): AgentEvent | undefined {
  const byId = db.agentEvents.find((e) => e.agent === "autoreply" && e.payload?.messageId === m.id);
  if (byId) return byId;
  return db.agentEvents.filter((e) => e.agent === "autoreply" && e.status === "needs_review" && e.enquiryId === m.enquiryId).sort((a, b) => b.at.localeCompare(a.at))[0];
}

export function approveDraft(db: DemoData, messageId: string, reviewer: { sub: string; name: string }, editedBody?: string) {
  const m = db.messages.find((x) => x.id === messageId);
  if (!m) return;
  const at = nowIso();
  if (editedBody != null) m.body = editedBody;
  m.status = "sent";
  m.at = at;
  const ev = eventForDraft(db, m);
  if (ev) {
    ev.status = "approved";
    ev.reviewedBy = reviewer.sub;
    ev.reviewedAt = at;
  }
  const e = db.enquiries.find((x) => x.id === m.enquiryId);
  if (e) {
    e.lastActivityAt = at;
    e.updatedAt = at;
    if (!db.messages.some((x) => x.enquiryId === e.id && x.status === "draft" && x.id !== m.id)) e.needsAttention = false;
  }
  logActivity(db, { actor: reviewer.name, actorKind: "user", type: "ai_draft_approved", text: `Approved and sent the AI draft${editedBody != null ? " (edited)" : ""}`, enquiryId: m.enquiryId, travellerId: m.travellerId });
}

export function discardDraft(db: DemoData, messageId: string, reviewer: { sub: string; name: string }) {
  const m = db.messages.find((x) => x.id === messageId);
  if (!m) return;
  const ev = eventForDraft(db, m);
  const at = nowIso();
  if (ev) {
    ev.status = "rejected";
    ev.reviewedBy = reviewer.sub;
    ev.reviewedAt = at;
  }
  db.messages = db.messages.filter((x) => x.id !== messageId);
  const e = db.enquiries.find((x) => x.id === m.enquiryId);
  if (e && !db.messages.some((x) => x.enquiryId === e.id && x.status === "draft")) e.needsAttention = false;
  logActivity(db, { actor: reviewer.name, actorKind: "user", type: "ai_draft_rejected", text: "Discarded the AI draft reply", enquiryId: m.enquiryId, travellerId: m.travellerId });
}
