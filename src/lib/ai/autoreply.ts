import type { AutoReplyAgentConfig, AutoReplyRule, Destination, Enquiry, Traveller } from "@/lib/demo/types";

/**
 * Autonomous reply agent — rule/intent-based stand-in for the LLM agent that
 * answers WhatsApp / Instagram messages. Classifies an inbound message,
 * decides whether to auto-send, draft for review, or escalate, and composes
 * the reply with the enquiry's own context (destination, price, visa).
 */

export type Intent =
  | "greeting"
  | "pricing"
  | "visa"
  | "dates"
  | "itinerary_change"
  | "discount"
  | "cancellation"
  | "complaint"
  | "payment"
  | "documents"
  | "booking_status"
  | "thanks"
  | "trip_brief"
  | "other";

const INTENT_PATTERNS: [Intent, RegExp][] = [
  ["cancellation", /\b(cancel|refund|money back|postpone)\b/i],
  ["complaint", /\b(complain|complaint|worst|terrible|angry|unacceptable|not happy|disappointed)\b/i],
  ["discount", /\b(discount|cheaper|best price|offer|negotiat|lower price|deal)\b/i],
  ["pricing", /\b(price|cost|kitna|how much|budget|charges|rate|rupees|₹|lakh|per person|pp)\b/i],
  ["visa", /\b(visa|passport|voa|on arrival|embassy|vfs)\b/i],
  ["payment", /\b(pay|paid|payment|upi|link|emi|instalment|installment|advance|balance|invoice|gst)\b/i],
  ["documents", /\b(document|docs|voucher|ticket|pnr|boarding|insurance)\b/i],
  ["booking_status", /\b(status|confirmed\?|booking|confirm)\b/i],
  ["itinerary_change", /\b(change|swap|add|remove|drop|instead|closer|late checkout|extra night|one more night|different hotel|modify|tweak)\b/i],
  ["dates", /\b(date|dates|month|week|weekend|diwali|christmas|new year|dec|jan|feb|nov|oct|march|april|may|june|july|aug|sept)\b/i],
  ["thanks", /\b(thank|thanks|thx|great|perfect|awesome|love it|looks good)\b/i],
  ["greeting", /^(hi|hello|hey|namaste|hola|good (morning|evening|afternoon))\b/i],
];

export interface Classification {
  intent: Intent;
  confidence: number;
  extracted: Partial<{ month: string; pax: number; budgetINR: number; nights: number }>;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function classifyMessage(text: string): Classification {
  const t = text.trim();
  let intent: Intent = "other";
  let confidence = 0.55;
  for (const [i, re] of INTENT_PATTERNS) {
    if (re.test(t)) {
      intent = i;
      confidence = 0.86;
      break;
    }
  }
  const extracted: Classification["extracted"] = {};
  const m = MONTHS.find((mo) => new RegExp(`\\b${mo.slice(0, 3)}`, "i").test(t));
  if (m) extracted.month = m[0].toUpperCase() + m.slice(1);
  const pax = t.match(/\b(\d{1,2})\s*(of us|people|pax|adults|persons|friends|travellers|travelers)\b/i) ?? t.match(/\b(two|three|four|five|six)\s+(of us|people|friends)\b/i);
  if (pax) {
    const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };
    extracted.pax = words[pax[1].toLowerCase()] ?? parseInt(pax[1], 10);
  }
  const budget = t.match(/₹\s?([\d,]+)\s*(k|lakh|l)?/i) ?? t.match(/\b([\d,]+)\s*(k|lakh|l)\b/i);
  if (budget) {
    let n = parseInt(budget[1].replace(/,/g, ""), 10);
    const unit = (budget[2] ?? "").toLowerCase();
    if (unit === "k") n *= 1000;
    if (unit === "lakh" || unit === "l") n *= 100000;
    if (n > 1000) extracted.budgetINR = n;
  }
  const nights = t.match(/\b(\d{1,2})\s*(nights|days|n\b|d\b)/i);
  if (nights) extracted.nights = parseInt(nights[1], 10) - (/days|d\b/i.test(nights[2]) ? 1 : 0);
  const isQuestion = /\?|^(how|what|is|are|do|does|can|which)\b/i.test(t);
  if (Object.keys(extracted).length >= 2 && (intent === "other" || intent === "dates" || (intent === "pricing" && !isQuestion))) {
    intent = "trip_brief";
    confidence = 0.9;
  }
  return { intent, confidence, extracted };
}

export interface ReplyDecision {
  intent: Intent;
  confidence: number;
  action: "auto_sent" | "drafted" | "escalated";
  reason: string;
  reply: string;
  extracted: Classification["extracted"];
  suggestedStage?: Enquiry["stage"];
  tag?: string;
}

const HANDOFF: Intent[] = ["cancellation", "complaint", "discount"];

export function decideReply(opts: {
  text: string;
  enquiry: Enquiry;
  traveller: Traveller;
  destination?: Destination;
  config: AutoReplyAgentConfig;
  rules: AutoReplyRule[];
  consultantName: string;
  autoRepliesSoFar: number;
}): ReplyDecision {
  const { text, enquiry, traveller, destination, config, consultantName } = opts;
  const c = classifyMessage(text);
  const first = traveller.fullName.split(" ")[0];
  const dest = destination?.name ?? enquiry.destination;
  const fromPrice = (destination?.fromPriceINR ?? 40000).toLocaleString("en-IN");
  let reply = "";
  let tag: string | undefined;
  let suggestedStage: Enquiry["stage"] | undefined;
  switch (c.intent) {
    case "greeting":
      reply = `Hi ${first}! 👋 Wish here from wishtrip. Are we planning ${dest}, or is this about an existing booking?`;
      break;
    case "pricing":
      reply = `Our ${dest} trips start from ₹${fromPrice} per person on twin sharing (stays, transfers, breakfast). The exact number depends on dates and stays — share your dates and group size and I'll send a day-by-day plan with a transparent breakdown.`;
      tag = "price-asked";
      break;
    case "visa":
      reply = destination ? `${destination.visa.note}. We handle the paperwork for every booking — you just send passport copies on this chat.` : `We handle visa paperwork for every booking — just send passport copies here once you confirm.`;
      break;
    case "dates":
      reply = `${c.extracted.month ?? "Those dates"} work${c.extracted.month ? "s" : ""} well for ${dest}${destination && c.extracted.month && !destination.bestMonths.includes(MONTHS.indexOf(c.extracted.month.toLowerCase()) + 1) ? " (shoulder season — quieter and ~6% cheaper)" : ""}. How many travellers, and a rough budget per person?`;
      break;
    case "trip_brief":
      reply = `Perfect, ${first} — ${dest}${c.extracted.month ? ` in ${c.extracted.month}` : ""}${c.extracted.pax ? `, ${c.extracted.pax} travellers` : ""}${c.extracted.budgetINR ? `, around ₹${c.extracted.budgetINR.toLocaleString("en-IN")}` : ""}. ${consultantName} will send a day-by-day plan with transparent pricing on this chat within a few hours. Anything to avoid — long drives, early mornings?`;
      suggestedStage = "qualified";
      break;
    case "itinerary_change":
      reply = `Got it — I've noted that change on your ${dest} plan. ${consultantName} will send a revised version (v${enquiry.stage === "negotiation" ? 3 : 2}) shortly with the updated price.`;
      suggestedStage = "negotiation";
      break;
    case "payment":
      reply = config.allowPaymentLinks
        ? `Here's your secure payment link (UPI, cards, EMI): rzp.io/l/wt-${enquiry.ref.toLowerCase()}. The advance is 25% and confirms your dates.`
        : `${consultantName} will send your secure payment link (UPI, cards, EMI) on this chat in a moment. The advance is 25% and confirms your dates.`;
      break;
    case "documents":
      reply = `For your booking we need: passport front + back (valid 6 months past return) and one photo each. Vouchers and tickets land on this chat 7 days before departure.`;
      break;
    case "booking_status":
      reply = enquiry.tripId ? `Your ${dest} booking is confirmed ✅ Your trip captain Meera will share vouchers 7 days before departure. Anything specific you'd like to check?` : `Your ${dest} plan is with ${consultantName} — you'll have the latest version here shortly. Want me to flag anything?`;
      break;
    case "thanks":
      reply = `Anytime, ${first}! 🌴 I'm here whenever you want to tweak the plan.`;
      break;
    case "discount":
      reply = `Let me check what we can do on the stays for your dates — give me a little while and I'll come back with options.`;
      tag = "discount-asked";
      break;
    case "cancellation":
      reply = `I'm looping in ${consultantName} right away — they'll reply on this chat within the hour with exact options.`;
      tag = "needs-human";
      break;
    case "complaint":
      reply = `I'm really sorry, ${first}. I've flagged this as urgent to ${consultantName}, who will call you within the hour.`;
      tag = "needs-human";
      break;
    default:
      reply = `Thanks, ${first}! ${consultantName} will pick this up on this chat shortly. Meanwhile — anything you'd like changed in the ${dest} plan?`;
  }

  let action: ReplyDecision["action"];
  let reason: string;
  if (!config.enabled) {
    action = "drafted";
    reason = "Auto-reply agent is switched off — drafted only";
  } else if (HANDOFF.includes(c.intent) || config.handoffTopics.some((h) => text.toLowerCase().includes(h))) {
    action = c.intent === "discount" ? "drafted" : "escalated";
    reason = `"${c.intent}" is a hand-off topic — ${action === "drafted" ? "draft for consultant" : "escalated to consultant"}`;
  } else if (config.mode === "draft") {
    action = "drafted";
    reason = "Agent in draft-only mode";
  } else if (c.confidence < config.confidenceThreshold) {
    action = "drafted";
    reason = `Confidence ${Math.round(c.confidence * 100)}% below threshold ${Math.round(config.confidenceThreshold * 100)}%`;
  } else if (opts.autoRepliesSoFar >= config.maxAutoRepliesPerThread) {
    action = "drafted";
    reason = `Reached ${config.maxAutoRepliesPerThread} auto-replies in this thread — handing to consultant`;
  } else {
    action = "auto_sent";
    reason = `Intent "${c.intent}" at ${Math.round(c.confidence * 100)}% — within policy`;
  }
  return { intent: c.intent, confidence: c.confidence, action, reason, reply, extracted: c.extracted, suggestedStage, tag };
}
