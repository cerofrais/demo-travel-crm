import type { AgentEvent, AgentKind, AutoReplyRule, DemoData, Enquiry, Message, MessageTemplate, Traveller } from "@/lib/demo/types";
import { classifyMessage, type Intent } from "@/lib/ai/autoreply";
import { maskPassport, paxLabel } from "@/lib/utils";

/**
 * AI Audit — pure helpers that turn an `AgentEvent` into a full inference
 * record (model, latency, tokens, exact prompts, output, outcome) and group
 * inbound traveller messages into the questions they keep asking.
 *
 * Seeded events carry no audit fields, so everything missing is synthesised
 * deterministically from the event id: the same event always shows the same
 * model, latency and prompts, which is what an audit trail must do.
 */

export interface AuditRecord {
  event: AgentEvent;
  model: string;
  latencyMs: number;
  tokens: { in: number; out: number };
  prompt: { system: string; user: string };
  output: string;
  outcome: "success" | "failed" | "skipped";
  /** Why the inference failed, when outcome is "failed". */
  failureNote?: string;
  entityLabel: string;
  entityHref?: string;
}

// ---------- deterministic hashing ----------

/** FNV-1a 32-bit — stable across runs, good enough spread for demo ranges. */
export function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function inRange(seed: string, min: number, max: number): number {
  const h = hashId(seed);
  return min + (h % (max - min + 1));
}

// ---------- model / runtime per agent ----------

export const AGENT_MODEL: Record<AgentKind, string> = {
  voice: "claude-sonnet-5-5 + realtime voice",
  autoreply: "claude-sonnet-5-5",
  scoring: "rules-v2 (deterministic)",
  itinerary: "claude-opus-5-5",
  followup: "rules-v2",
  assignment: "rules-v2",
};

export const AGENT_RUNTIME: Record<AgentKind, { runsOn: string; trigger: string; writes: string }> = {
  voice: { runsOn: "Realtime voice stack (telephony → STT → LLM → TTS)", trigger: "Inbound call, or new lead within 5 min", writes: "Call + transcript + AgentEvent" },
  autoreply: { runsOn: "Chat pipeline (WhatsApp / Instagram webhooks)", trigger: "Every inbound traveller message", writes: "Message (sent or draft) + AgentEvent" },
  scoring: { runsOn: "Rules engine, in-process", trigger: "Any enquiry change", writes: "Enquiry.aiScore + AgentEvent" },
  itinerary: { runsOn: "Chat pipeline (long-form generation)", trigger: "Consultant clicks Build, or brief captured", writes: "Itinerary draft + AgentEvent (needs review)" },
  followup: { runsOn: "Scheduler, in-process", trigger: "SLA timers (1 / 3 / 7 days, payment due dates)", writes: "Message + Task + AgentEvent" },
  assignment: { runsOn: "Rules engine, in-process", trigger: "New enquiry, passport / doc checks", writes: "Enquiry.assignedTo + Task + AgentEvent" },
};

const LATENCY: Record<AgentKind, [number, number]> = {
  voice: [1800, 4200],
  itinerary: [6000, 14000],
  autoreply: [400, 1600],
  scoring: [400, 1600],
  followup: [400, 1600],
  assignment: [400, 1600],
};

const FAILURE_NOTE: Record<AgentKind, string> = {
  voice: "Realtime stream dropped after 41s (carrier RTP timeout) — call routed to voicemail fallback",
  autoreply: "Model timeout after 12s — fell back to template reply",
  scoring: "Feature extraction failed (enquiry had no messages yet) — default score 40 applied, re-queued",
  itinerary: "Output failed schema validation (day 4 missing a stay) — regenerated on retry",
  followup: "WhatsApp template rejected by Meta (category mismatch) — nudge queued for retry",
  assignment: "No active consultant for destination — left unassigned, Ops notified",
};

// ---------- PII masking ----------

/** Mask passport-like tokens (one letter + 7 digits, Indian format) in prompt text. */
export function maskPII(text: string): string {
  return text.replace(/\b([A-Z])(\d{7})\b/g, (m) => maskPassport(m));
}

// ---------- prompts ----------

function systemPrompt(agent: AgentKind, db: DemoData): string {
  const s = db.settings;
  const company = s.company.name;
  const ar = s.agents.autoReply;
  const v = s.agents.voice;
  switch (agent) {
    case "autoreply":
      return [
        `You are ${ar.persona}, ${company}'s trip-planning assistant on WhatsApp and Instagram.`,
        `Tone: ${ar.tone}. Write like a helpful friend who plans trips for a living. Indian English, light emoji, no corporate phrasing.`,
        "",
        "Policy:",
        "- Never quote a refund amount or cancellation fee. Never promise a discount.",
        `- Hand off to the consultant (action=escalate) on: ${ar.handoffTopics.join(", ")}.`,
        `- Auto-send only when confidence ≥ ${Math.round(ar.confidenceThreshold * 100)}%; otherwise draft for review.`,
        `- Max ${ar.maxAutoRepliesPerThread} auto-replies per thread, then hand to the consultant.`,
        `- Payment links: ${ar.allowPaymentLinks ? "allowed" : "NOT allowed — say the consultant will send it"}.`,
        `- Itinerary drafts: ${ar.allowItineraryDraft ? "may propose a draft" : "never propose"}.`,
        "- Ask one question at a time. Keep replies under 60 words.",
        "- Never reveal passport numbers, card details or internal notes.",
        "",
        `Sign off: ${ar.signature}`,
        "",
        'Return JSON: { "intent", "confidence", "action": "auto_send" | "draft" | "escalate", "reply", "extracted": { month?, pax?, budgetINR?, nights? }, "suggestedStage"?, "tag"? }',
      ].join("\n");
    case "voice":
      return [
        `You are ${v.name}, ${company}'s voice assistant. Voice: ${v.voice}. Languages: ${v.languages.join(", ")} — mirror the caller's language and switch when they do.`,
        `Opening line: "${v.greeting}"`,
        `Tone: ${v.tone}`,
        "",
        "Goal for outbound calls: confirm destination, month or dates, number of travellers and budget per person, then promise a day-by-day plan on WhatsApp.",
        "Goal for inbound calls: answer FAQs (visa, best months, what's included), or look up an existing booking by name.",
        "",
        "Policy:",
        `- Escalate to a human immediately on: ${v.escalateOn.join(", ")}. Say you are connecting them, flag as urgent, never quote figures.`,
        `- Keep calls under ${v.maxCallMinutes} minutes. If the caller is busy, offer WhatsApp instead.`,
        "- Never read back passport numbers or payment details aloud.",
        "- No pricing beyond the published from-price per person.",
        "",
        'At call end return JSON: { "outcome", "summary", "extracted": { destination?, travelMonth?, nights?, pax?, budgetINR?, tripType?, departureCity? }, "sentiment", "nextAction" }',
      ].join("\n");
    case "itinerary":
      return [
        `You are ${company}'s itinerary planner. Rebuild the package the traveller saw on a reel for their dates, budget, pace and group — do not invent stays or activities outside the supplier list provided.`,
        "",
        "Rules:",
        "- Respect pace (slow = max 2 activities/day, balanced = 3, packed = 4) and comfort tier for every stay.",
        "- Price in INR using the supplier rates in context; add the configured margin and GST; show a transparent breakdown.",
        "- Keep driving legs under 4 hours; night 1 near the arrival airport.",
        "- Food preference drives restaurant picks (veg / Jain / halal).",
        "- Never promise visa outcomes; list visa type and processing days only.",
        `- Output is a DRAFT: ${s.agents.itinerary.requireReview ? "a consultant must approve before it is sent" : "may be sent directly"}.`,
        "",
        'Return JSON: { "title", "days": [...], "stays": [...], "flights": [...], "inclusions", "exclusions", "pricing": { perPersonINR, totalINR, breakdown[] }, "rationale": string[] }',
      ].join("\n");
    case "scoring":
      return [
        "rules-v2 conversion scoring (deterministic, no LLM).",
        "Signals: concrete dates (+20), budget within destination from-price × pax (+15), traveller replied within 2h (+15), brief captured (+10), itinerary viewed (+10), repeat traveller (+10), no reply 3+ days (−20), lost reason set (−40).",
        "Output 0–100 with the three strongest reasons. Re-run on every enquiry change.",
      ].join("\n");
    case "followup":
      return [
        "rules-v2 follow-up scheduler (deterministic, no LLM).",
        `Cadence after itinerary sent: ${s.sla.followUpCadenceDays.join(" / ")} days with no reply; max ${s.agents.followUp.maxAttempts} nudges, then mark Lost (no response).`,
        "Payment reminders: utility template with Pay Now link on due date and +2 days; escalate to Finance after the second reminder.",
        "Post-trip: review + referral request 48h after return.",
        "Only approved WhatsApp templates may be used; respect the 24h session window.",
      ].join("\n");
    case "assignment":
      return [
        "rules-v2 assignment & ops checks (deterministic, no LLM).",
        `Strategy: ${s.assignment.strategy} (auto-assign ${s.assignment.autoAssign ? "on" : "off"}). Prefer a consultant whose specialities include the destination, then least open leads.`,
        "Passport rule: flag any traveller whose passport expires within 6 months of the return date; create an Ops task.",
      ].join("\n");
  }
}

function lastInbound(db: DemoData, ev: AgentEvent, enquiry?: Enquiry, traveller?: Traveller): Message | undefined {
  const pool = db.messages.filter((m) => m.direction === "inbound" && ((enquiry && m.enquiryId === enquiry.id) || (traveller && m.travellerId === traveller.id)));
  if (pool.length === 0) return undefined;
  const before = pool.filter((m) => m.at <= ev.at).sort((a, b) => b.at.localeCompare(a.at));
  return before[0] ?? pool.sort((a, b) => a.at.localeCompare(b.at))[0];
}

function datesLabel(e: Enquiry): string {
  if (e.travelStart && e.travelEnd) return `${e.travelStart.slice(0, 10)} → ${e.travelEnd.slice(0, 10)}`;
  if (e.travelMonth) return `${e.travelMonth} (${e.flexibility.replace(/_/g, " ")})`;
  return "not fixed";
}

function userPrompt(ev: AgentEvent, db: DemoData, enquiry?: Enquiry, traveller?: Traveller): string {
  const lines: string[] = [];
  if (traveller) {
    lines.push("## Traveller");
    lines.push(`Name: ${traveller.fullName} · ${traveller.city} · language ${traveller.language} · prefers ${traveller.preferredChannel}`);
    lines.push(`Profile: ${traveller.tripsCount} past trips · pace ${traveller.pace} · comfort ${traveller.comfort} · food ${traveller.foodPref}`);
    if (traveller.passportNo) lines.push(`Passport: ${traveller.passportNo}${traveller.passportExpiry ? ` (expires ${traveller.passportExpiry.slice(0, 10)})` : ""}`);
    if (traveller.tags.length) lines.push(`Tags: ${traveller.tags.join(", ")}`);
  }
  if (enquiry) {
    lines.push("", "## Enquiry");
    lines.push(`Ref: ${enquiry.ref} · stage ${enquiry.stage} · source ${enquiry.source}${enquiry.reelRef ? ` · reel ${enquiry.reelRef}` : ""}`);
    lines.push(`Destination: ${enquiry.destination}${enquiry.altDestinations.length ? ` (alt: ${enquiry.altDestinations.join(", ")})` : ""}`);
    lines.push(`Dates: ${datesLabel(enquiry)} · ${enquiry.nights} nights`);
    lines.push(`Travellers: ${paxLabel(enquiry.pax)} · ${enquiry.rooms} room(s) · ${enquiry.tripType}`);
    lines.push(`Budget: ₹${enquiry.budgetINR.toLocaleString("en-IN")} total · flights ${enquiry.includeFlights ? `included, from ${enquiry.departureCity}` : "excluded"}`);
    lines.push(`Preferences: ${enquiry.pace} pace · ${enquiry.comfort} · ${enquiry.foodPref}${enquiry.interests.length ? ` · interests ${enquiry.interests.join(", ")}` : ""}`);
    if (enquiry.aiScore != null) lines.push(`Current AI score: ${enquiry.aiScore}/100`);
    if (enquiry.assignedTo) lines.push(`Consultant: ${db.users.find((u) => u.sub === enquiry.assignedTo)?.name ?? enquiry.assignedTo}`);
    const dest = db.destinations.find((d) => d.id === enquiry.destinationId);
    if (dest) lines.push(`Destination facts: from ₹${dest.fromPriceINR.toLocaleString("en-IN")}/pp · visa ${dest.visa.type} (${dest.visa.processingDays}d) · best months ${dest.bestMonths.join(",")}`);
  }
  const trip = ev.tripId ? db.trips.find((t) => t.id === ev.tripId) : undefined;
  if (trip) {
    lines.push("", "## Trip");
    lines.push(`${trip.ref} · ${trip.status} · ${trip.startDate.slice(0, 10)} → ${trip.endDate.slice(0, 10)} · total ₹${trip.totalINR.toLocaleString("en-IN")} · paid ₹${trip.paidINR.toLocaleString("en-IN")}`);
  }
  const inbound = lastInbound(db, ev, enquiry, traveller);
  if (inbound) {
    lines.push("", `## Last inbound message (${inbound.channel}, ${inbound.at.slice(0, 16).replace("T", " ")})`);
    lines.push(inbound.body);
  }
  if (!traveller && !enquiry) lines.push("## Context", "No linked traveller or enquiry (inbound caller not yet matched).");
  lines.push("", "## Task", ev.action);
  return maskPII(lines.join("\n"));
}

// ---------- the record ----------

const estTokens = (text: string) => Math.max(1, Math.round(text.length / 4));

export function auditFor(ev: AgentEvent, db: DemoData): AuditRecord {
  const enquiry = ev.enquiryId ? db.enquiries.find((e) => e.id === ev.enquiryId) : undefined;
  const traveller = db.travellers.find((t) => t.id === (ev.travellerId ?? enquiry?.travellerId));

  const prompt = ev.prompt ?? { system: systemPrompt(ev.agent, db), user: userPrompt(ev, db, enquiry, traveller) };
  const outcome: AuditRecord["outcome"] = ev.outcome ?? (ev.status === "rejected" ? "skipped" : hashId(`${ev.id}:fail`) % 15 === 0 ? "failed" : "success");
  const failureNote = outcome === "failed" && !ev.outcome ? FAILURE_NOTE[ev.agent] : undefined;

  let output = ev.output;
  if (output == null) {
    output = ev.detail;
    if (ev.payload && Object.keys(ev.payload).length) output += `\n\n\`\`\`json\n${JSON.stringify(ev.payload, null, 2)}\n\`\`\``;
    if (failureNote) output = `${failureNote}\n\nFallback result: ${ev.detail}`;
  }

  const [lo, hi] = LATENCY[ev.agent];
  const latencyMs = ev.latencyMs ?? (failureNote && ev.agent === "autoreply" ? 12000 : inRange(`${ev.id}:lat`, lo, hi));
  const tokens = ev.tokens ?? {
    in: estTokens(prompt.system) + estTokens(prompt.user) + inRange(`${ev.id}:tin`, 0, 120),
    out: estTokens(output) + inRange(`${ev.id}:tout`, 20, 260),
  };

  const entityLabel = traveller ? `${traveller.fullName}${enquiry ? ` · ${enquiry.ref}` : ""}` : enquiry ? enquiry.ref : "—";
  const entityHref = enquiry ? `/enquiries?enquiry=${enquiry.id}` : traveller ? `/travellers?traveller=${traveller.id}` : undefined;

  return { event: ev, model: ev.model ?? AGENT_MODEL[ev.agent], latencyMs, tokens, prompt, output, outcome, failureNote, entityLabel, entityHref };
}

// ---------- inbound question topics ----------

export interface Topic {
  intent: Intent;
  label: string;
  description: string;
  count: number;
  /** % of analysed inbound messages. */
  share: number;
  samples: string[];
  rule?: AutoReplyRule;
  templates: MessageTemplate[];
  /** Whether a canned reply makes sense for this topic (thanks / greetings don't need one). */
  templateExpected: boolean;
}

export interface InboundAnalysis {
  total: number;
  topics: Topic[];
  unrecognised: number;
  unrecognisedSamples: string[];
  gaps: Topic[];
}

const TOPIC_META: Record<Intent, { label: string; description: string; template: RegExp | null; ruleKeywords: string[]; expected: boolean }> = {
  trip_brief: { label: "Trip brief shared", description: "Traveller gives dates, group size and budget in one message", template: null, ruleKeywords: [], expected: true },
  pricing: { label: "Price / cost", description: "How much does it cost, per person, total, with flights", template: /quote|itinerary link|price/i, ruleKeywords: ["price", "cost", "how much"], expected: true },
  visa: { label: "Visa & passport", description: "Do we need a visa, on-arrival, processing time", template: /visa/i, ruleKeywords: ["visa", "passport"], expected: true },
  dates: { label: "Dates & months", description: "Is this month good, can we move the dates", template: /dates|availability/i, ruleKeywords: ["date", "month"], expected: true },
  itinerary_change: { label: "Change the plan", description: "Swap a hotel, drop a night, add an activity", template: /revis|change/i, ruleKeywords: ["change", "swap"], expected: true },
  discount: { label: "Discount request", description: "Any offer, best price, cheaper option", template: /discount|offer/i, ruleKeywords: ["discount", "cheaper", "best price", "offer"], expected: true },
  cancellation: { label: "Cancellation / refund", description: "Cancel, postpone, refund questions", template: /cancel|refund/i, ruleKeywords: ["cancel", "refund"], expected: true },
  complaint: { label: "Complaint", description: "Unhappy traveller, service issue", template: /complaint|apolog|sorry/i, ruleKeywords: ["complaint"], expected: true },
  payment: { label: "Payment", description: "Paid the advance, UPI reference, link, EMI", template: /payment/i, ruleKeywords: ["pay", "upi", "advance"], expected: true },
  documents: { label: "Documents & vouchers", description: "Passport copies, tickets, vouchers, insurance", template: /docs|passport|voucher/i, ruleKeywords: ["document", "voucher", "ticket"], expected: true },
  booking_status: { label: "Booking status", description: "Is it confirmed, what happens next", template: /booking confirmed/i, ruleKeywords: ["confirm", "status"], expected: true },
  greeting: { label: "Greeting / hello", description: "First hello, is this wishtrip", template: /welcome/i, ruleKeywords: ["plan"], expected: true },
  thanks: { label: "Thanks / positive", description: "Looks great, thank you, love it", template: /thanks|thank you/i, ruleKeywords: [], expected: false },
  other: { label: "Unrecognised", description: "No intent matched", template: null, ruleKeywords: [], expected: false },
};

export const INTENT_ORDER = Object.keys(TOPIC_META) as Intent[];

export function ruleForIntent(db: DemoData, intent: Intent): AutoReplyRule | undefined {
  const kw = TOPIC_META[intent].ruleKeywords;
  return db.autoReplyRules.find((r) => r.active && (r.intent === intent || r.keywords.some((k) => kw.includes(k.toLowerCase()))));
}

export function templatesForIntent(db: DemoData, intent: Intent): MessageTemplate[] {
  const re = TOPIC_META[intent].template;
  if (!re) return [];
  return db.templates.filter((t) => !t.archived && (re.test(t.name) || re.test(t.folder)));
}

export function inboundTopics(db: DemoData, opts: { sinceIso?: string } = {}): InboundAnalysis {
  const inbound = db.messages.filter((m) => m.direction === "inbound" && (!opts.sinceIso || m.at >= opts.sinceIso));
  const buckets = new Map<Intent, Message[]>();
  for (const m of inbound) {
    const { intent } = classifyMessage(m.body);
    if (!buckets.has(intent)) buckets.set(intent, []);
    buckets.get(intent)!.push(m);
  }
  const total = inbound.length;
  const other = buckets.get("other") ?? [];
  const topics: Topic[] = [];
  for (const intent of INTENT_ORDER) {
    if (intent === "other") continue;
    const msgs = buckets.get(intent);
    if (!msgs || msgs.length === 0) continue;
    const meta = TOPIC_META[intent];
    // Distinct sample bodies, newest first.
    const seen = new Set<string>();
    const samples: string[] = [];
    for (const m of [...msgs].sort((a, b) => b.at.localeCompare(a.at))) {
      const body = m.body.replace(/\s+/g, " ").trim();
      if (seen.has(body)) continue;
      seen.add(body);
      samples.push(body);
      if (samples.length === 3) break;
    }
    topics.push({
      intent,
      label: meta.label,
      description: meta.description,
      count: msgs.length,
      share: total ? Math.round((msgs.length / total) * 100) : 0,
      samples,
      rule: ruleForIntent(db, intent),
      templates: templatesForIntent(db, intent),
      templateExpected: meta.expected,
    });
  }
  topics.sort((a, b) => b.count - a.count);
  return {
    total,
    topics,
    unrecognised: other.length,
    unrecognisedSamples: other.slice(0, 3).map((m) => m.body.replace(/\s+/g, " ").trim()),
    gaps: topics.filter((t) => t.templateExpected && t.templates.length === 0),
  };
}

export interface TemplateSuggestion {
  name: string;
  body: string;
  variables: string[];
  rationale: string;
}

const SUGGESTED: Partial<Record<Intent, TemplateSuggestion>> = {
  trip_brief: {
    name: "Trip brief · acknowledgement",
    body: "Perfect, {{first_name}} — {{destination}} in {{month}} for {{pax}} travellers around ₹{{budget}} per person. {{agent_name}} will send a day-by-day plan with transparent pricing on this chat within {{sla_hours}} hours. Anything to avoid — long drives, early mornings?",
    variables: ["first_name", "destination", "month", "pax", "budget", "agent_name", "sla_hours"],
    rationale: "Travellers who share dates, pax and budget in one message expect confirmation that it was understood and a time promise. Echoing the brief back cuts the 'did you get my message?' follow-ups.",
  },
  visa: {
    name: "Visa · quick answer",
    body: "Good question! For {{destination}}: {{visa_note}}. We handle the paperwork for every booking — once you confirm, just send passport copies (front + back) on this chat and we take it from there. 🛂",
    variables: ["first_name", "destination", "visa_note"],
    rationale: "Visa is the most repeated pre-booking question and the answer is per destination, so a variable template lets the agent auto-send it safely.",
  },
  dates: {
    name: "Dates · best time + next question",
    body: "{{month}} is a {{season_note}} time for {{destination}} 🌤️ If your dates can move by a few days, tell me and I'll check which gives the better stays. How many travellers and a rough budget per person?",
    variables: ["month", "season_note", "destination"],
    rationale: "Date questions almost always precede the brief — answer the season question and ask for the next missing piece in one message.",
  },
  itinerary_change: {
    name: "Plan change · acknowledgement",
    body: "Got it, {{first_name}} — I've noted that on your {{destination}} plan. {{agent_name}} will send a revised version (v{{next_version}}) with the updated price within a few hours. Anything else you'd like tweaked while we're at it?",
    variables: ["first_name", "destination", "agent_name", "next_version"],
    rationale: "Change requests are frequent after the first itinerary; a same-minute acknowledgement keeps the traveller warm while the consultant revises.",
  },
  discount: {
    name: "Discount · hold reply (draft only)",
    body: "Let me check what we can do on the stays for your {{destination}} dates, {{first_name}} — give me a little while and I'll come back with options. Paying the full amount upfront sometimes unlocks a better room category too.",
    variables: ["first_name", "destination"],
    rationale: "Discounts are a hand-off topic, so this should stay a draft-only template: it buys the consultant time without promising a number.",
  },
  cancellation: {
    name: "Cancellation · hand-off (draft only)",
    body: "I'm really sorry to hear that, {{first_name}}. Cancellations are handled by your consultant directly so you get exact figures — {{agent_name}} will reply on this chat within the hour. Could you share the reason so we can look at postponing instead?",
    variables: ["first_name", "agent_name"],
    rationale: "Never quote refunds automatically; this template acknowledges, sets a time promise and opens the door to a postponement.",
  },
  complaint: {
    name: "Complaint · urgent acknowledgement",
    body: "I'm really sorry, {{first_name}} — that's not the experience we want for you. I've flagged this as urgent to {{agent_name}}, who will call you within the hour. If it's easier, reply here with the details and we'll fix it today.",
    variables: ["first_name", "agent_name"],
    rationale: "Complaints need a human, but a fast, warm acknowledgement protects the review score while the consultant picks up.",
  },
  pricing: {
    name: "Price · from-price + brief ask",
    body: "Our {{destination}} trips start from ₹{{from_price}} per person on twin sharing (stays, transfers, breakfast). The exact number depends on dates and stays — share your dates and group size and I'll send a day-by-day plan with a transparent breakdown.",
    variables: ["destination", "from_price"],
    rationale: "Keeps pricing honest (from-price only) and converts the question into a brief.",
  },
  booking_status: {
    name: "Booking status · update",
    body: "Hi {{first_name}}, your {{destination}} booking ({{ref}}) is {{status}} ✅ Next step: {{next_step}}. Your trip captain {{captain}} is on this chat for anything else.",
    variables: ["first_name", "destination", "ref", "status", "next_step", "captain"],
    rationale: "Status questions spike after payment; a templated answer with the next step reduces repeat pings.",
  },
  greeting: {
    name: "Hello · who we are + 3 questions",
    body: "Hi {{first_name}}! 👋 Yes, this is wishtrip — we rebuild the trips you see on reels for your dates, budget and pace. Tell me three things and I'll start: your destination, your dates (or month) and who's travelling.",
    variables: ["first_name"],
    rationale: "First-touch greetings should answer 'is this wishtrip?' and ask for the brief in one go.",
  },
  payment: {
    name: "Payment received · confirmation",
    body: "Received, {{first_name}} — ₹{{amount}} against {{ref}} 🎉 Your {{destination}} dates are now locked. Next: passport copies for all travellers on this chat; your trip captain {{captain}} takes it from here.",
    variables: ["first_name", "amount", "ref", "destination", "captain"],
    rationale: "'Paid, please confirm' messages deserve an instant receipt-style reply.",
  },
  documents: {
    name: "Documents · what we need",
    body: "For {{ref}} we need: passport front + back (valid 6 months past return), one photo each, and preferred flight timings. Reply with the photos here — vouchers and tickets land on this chat 7 days before departure.",
    variables: ["ref"],
    rationale: "Document questions follow a fixed checklist, ideal for a template.",
  },
};

export function suggestTemplateFor(topic: Pick<Topic, "intent" | "label" | "samples">): TemplateSuggestion {
  const s = SUGGESTED[topic.intent];
  if (s) return s;
  return {
    name: `${topic.label} · reply`,
    body: `Thanks, {{first_name}}! {{agent_name}} will pick this up on this chat shortly. Meanwhile — anything you'd like changed in the {{destination}} plan?`,
    variables: ["first_name", "agent_name", "destination"],
    rationale: `Travellers keep asking about "${topic.label.toLowerCase()}"${topic.samples[0] ? ` (e.g. "${topic.samples[0].slice(0, 80)}")` : ""}; a holding reply keeps the thread warm until a consultant answers.`,
  };
}
