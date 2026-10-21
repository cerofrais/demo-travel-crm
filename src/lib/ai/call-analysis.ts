import type { Call, CallAnalysis, Enquiry, Traveller, TranscriptLine } from "@/lib/demo/types";

/**
 * Call transcription, translation and analysis — deterministic stand-ins for
 * the speech-to-text + LLM pipeline (Indic ASR → translation → Claude call
 * scoring in the wellness CRM). Same output shapes, no network.
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pickBy = <T,>(seed: string, arr: readonly T[]): T => arr[hash(seed) % arr.length];

export interface CallContext {
  enquiry?: Enquiry;
  traveller?: Traveller;
  consultantName: string;
}

/** Produce a plausible transcript for a consultant call from its summary and outcome. */
export function transcribeCall(call: Call, ctx: CallContext): { transcript: TranscriptLine[]; translation?: TranscriptLine[] } {
  const first = ctx.traveller?.fullName.split(" ")[0] ?? "there";
  const dest = ctx.enquiry?.destination ?? "the trip";
  const agent = ctx.consultantName.split(" ")[0];
  const hinglish = call.language === "hi" || call.language === "hinglish";
  const pax = ctx.enquiry ? ctx.enquiry.pax.adults + ctx.enquiry.pax.children : 2;
  const month = ctx.enquiry?.travelMonth ? new Date(ctx.enquiry.travelMonth + "-01").toLocaleDateString("en-IN", { month: "long" }) : "next month";
  const sum = (call.summary ?? "").toLowerCase();

  const opening: [string, string][] = hinglish
    ? [
        [`Hi ${first}, ${agent} bol raha hoon wishtrip se. ${dest} plan dekha aapne?`, `Hi ${first}, this is ${agent} from wishtrip. Did you get a look at the ${dest} plan?`],
        [`Haan dekha, kaafi accha laga. Bas kuch sawaal the.`, `Yes I saw it, liked it a lot. Just had a few questions.`],
      ]
    : [
        [`Hi ${first}, ${agent} from wishtrip. Is this a good time to go through the ${dest} plan?`, ""],
        [`Yes, perfect timing. We went through it last night.`, ""],
      ];

  let body: [string, string][];
  if (sum.includes("beachfront") || sum.includes("stay")) {
    body = hinglish
      ? [
          [`Second stay thoda door hai beach se. Kuch beachfront option hai?`, `The second stay is a bit far from the beach. Any beachfront option?`],
          [`Bilkul — ${dest} mein ek beachfront property hai, same budget mein. Main revised plan aaj bhej deta hoon.`, `Of course — there's a beachfront property in ${dest} within the same budget. I'll send a revised plan today.`],
          [`Great. Aur last day late checkout ho sakta hai?`, `Great. And can we get a late checkout on the last day?`],
          [`Request daal deta hoon, usually ho jaata hai.`, `I'll put in the request, it usually works out.`],
        ]
      : [
          [`The second stay looks a bit far from the beach. Could we swap it for something beachfront?`, ""],
          [`Absolutely — there's a beachfront villa in ${dest} at almost the same rate. I'll send a revised version (v2) today with the new stay.`, ""],
          [`Perfect. And a late checkout on the last day would be ideal.`, ""],
          [`I'll request it with the property — it usually comes through.`, ""],
        ];
  } else if (sum.includes("discount") || sum.includes("price") || sum.includes("%")) {
    body = hinglish
      ? [
          [`Price thoda zyada lag raha hai. Koi discount mil sakta hai?`, `The price feels a little high. Is any discount possible?`],
          [`Samajh sakta hoon. Stays pe rate fixed hain, lekin airport transfer upgrade free de sakte hain, aur ek night kam karke budget mein fit kar sakte hain.`, `I understand. The stay rates are fixed, but I can give a free airport transfer upgrade, or drop one night to fit the budget.`],
          [`Upgrade wala option theek hai. Sochke batata hoon.`, `The upgrade option sounds fine. I'll think and let you know.`],
        ]
      : [
          [`Honestly the price is a little above what we had in mind. Any room on it?`, ""],
          [`The stays are at contracted rates, so there's no straight discount — but I can add a free airport-transfer upgrade, or trim one night to bring it under your number.`, ""],
          [`Let's keep the nights. The upgrade works. I'll confirm with my wife tonight.`, ""],
          [`Sounds good — I'll hold the ${month} dates for 48 hours.`, ""],
        ];
  } else if (sum.includes("pax") || sum.includes("child") || sum.includes("friends")) {
    body = hinglish
      ? [
          [`Ek aur member add karna hai — bachcha, 6 saal ka.`, `We need to add one more traveller — a child, 6 years old.`],
          [`Noted. Child with bed ya without? Price accordingly change hoga.`, `Noted. Child with or without bed? The price will change accordingly.`],
          [`Without bed chalega.`, `Without bed is fine.`],
          [`Theek hai, ${pax + 1} travellers ke liye revised quote aaj bhejta hoon.`, `Alright, I'll send a revised quote for ${pax + 1} travellers today.`],
        ]
      : [
          [`One more thing — my brother and his wife want to join, so that's ${pax + 2} of us now.`, ""],
          [`Lovely. Same stays will work with two rooms. I'll rebuild the quote for ${pax + 2} and send it this evening.`, ""],
          [`Great, and can they share the airport transfer?`, ""],
          [`Yes, one vehicle covers everyone.`, ""],
        ];
  } else {
    body = hinglish
      ? [
          [`Dates thoda shift ho sakti hain — ek hafta aage.`, `The dates might shift a bit — a week later.`],
          [`Koi dikkat nahi. Main dono weeks ke rates check karke batata hoon.`, `No problem. I'll check rates for both weeks and let you know.`],
          [`Friday tak confirm kar dunga.`, `I'll confirm by Friday.`],
        ]
      : [
          [`We might have to move the dates by a week — work is being unpredictable.`, ""],
          [`No problem at all. I'll check availability for both weeks and send you both prices.`, ""],
          [`Thanks. I'll confirm by Friday.`, ""],
          [`Perfect. I'll set a reminder and keep the current plan saved.`, ""],
        ];
  }

  const closing: [string, string][] = hinglish
    ? [[`Thank you ${agent}!`, `Thank you ${agent}!`], [`Welcome ${first}, WhatsApp pe update milega.`, `You're welcome ${first}, you'll get an update on WhatsApp.`]]
    : [[`Thanks ${agent}, this is really helpful.`, ""], [`Any time, ${first}. Everything will be on WhatsApp.`, ""]];

  const all = [...opening, ...body, ...closing];
  const total = Math.max(60, call.durationSec);
  const step = total / (all.length + 1);
  const transcript: TranscriptLine[] = all.map(([text], i) => ({ speaker: i % 2 === 0 ? "agent" : "caller", text, t: Math.round(i * step) }));
  const translation = hinglish ? all.map(([, en], i) => ({ speaker: (i % 2 === 0 ? "agent" : "caller") as TranscriptLine["speaker"], text: en, t: Math.round(i * step) })) : undefined;
  return { transcript, translation };
}

/** English rendering for a Hinglish transcript the voice agent produced. */
const HINGLISH_PHRASES: [RegExp, string][] = [
  [/haan bolo, quick please\./i, "Yes go ahead, quickly please."],
  [/namaste/gi, "Hello"],
  [/haan bilkul\./i, "Yes, absolutely."],
  [/aapki/gi, "your"],
  [/booking ke baare mein poochna tha/i, "I wanted to ask about the booking"],
  [/haan, bas voucher kab milega\?/i, "Yes, just — when will I get the voucher?"],
  [/vouchers departure se 7 din pehle whatsapp pe aa jayenge\./i, "Vouchers will arrive on WhatsApp 7 days before departure."],
  [/trip captain meera aapko update karengi\./i, "Trip captain Meera will keep you updated."],
  [/confirmed hai/gi, "is confirmed"],
  [/aur vouchers ka status main whatsapp pe bhej deti hoon\. kuch aur\?/i, "and I'll send the voucher status on WhatsApp. Anything else?"],
  [/hello, /i, "Hello, "],
];
export function translateTranscript(lines: TranscriptLine[]): TranscriptLine[] {
  return lines.map((l) => {
    let text = l.text;
    for (const [re, en] of HINGLISH_PHRASES) text = text.replace(re, en);
    return { ...l, text };
  });
}

/** Call quality score + coaching, from the transcript and outcome. */
export function analyseCall(call: Call, ctx: CallContext, now = new Date()): CallAnalysis {
  const text = call.transcript.map((l) => l.text).join(" ").toLowerCase();
  const agentLines = call.transcript.filter((l) => l.speaker === "agent");
  const callerLines = call.transcript.filter((l) => l.speaker === "caller");
  const tags: string[] = [];
  let score = 60;
  const seed = call.id;

  if (/price|cost|discount|budget|rate|₹|lakh|kitna/.test(text)) tags.push("price-discussion");
  if (/visa|passport/.test(text)) tags.push("visa-question");
  if (/date|week|month|friday|shift/.test(text)) tags.push("dates-discussed");
  if (/beach|stay|hotel|villa|room|checkout/.test(text)) tags.push("stay-preference");
  if (/child|kid|brother|wife|pax|travellers|of us/.test(text)) tags.push("pax-change");
  if (call.outcome === "qualified" || call.outcome === "booked") tags.push("high-intent");
  if (call.outcome === "callback") tags.push("callback-requested");
  if (call.outcome === "handoff") tags.push("escalated");
  if (call.outcome === "not_interested") tags.push("low-intent");

  if (agentLines.length > 0 && /hi|hello|namaste/.test(agentLines[0].text.toLowerCase()) && /wishtrip/.test(agentLines[0].text.toLowerCase())) score += 8;
  if (agentLines.some((l) => /\?/.test(l.text))) score += 6;
  if (agentLines.some((l) => /i'll|i will|send|today|whatsapp|hold|reminder|bhej/i.test(l.text))) score += 10;
  if (callerLines.some((l) => /thank|great|perfect|lovely|accha/i.test(l.text))) score += 6;
  if (call.durationSec < 45) score -= 10;
  if (call.durationSec > 600) score -= 5;
  if (call.outcome === "qualified" || call.outcome === "booked") score += 8;
  if (call.outcome === "not_interested") score -= 12;
  if (call.sentiment === "negative") score -= 8;
  if (call.transcript.length === 0) score -= 15;
  score += hash(seed) % 7;
  score = Math.max(15, Math.min(98, Math.round(score)));

  const first = ctx.traveller?.fullName.split(" ")[0] ?? "the traveller";
  const dest = ctx.enquiry?.destination ?? "the trip";
  const summary =
    call.summary ??
    (call.kind === "voice_agent" ? `Aanya handled a ${call.direction} call about ${dest}.` : `${ctx.consultantName} spoke with ${first} about ${dest}.`);

  const coaching = {
    opening: agentLines[0]
      ? /wishtrip/i.test(agentLines[0].text)
        ? "Strong — named yourself and wishtrip in the first line, then asked if it was a good time."
        : "Name wishtrip and check it's a good time before diving in."
      : "No opening captured — make sure the recording starts before the greeting.",
    explanation: tags.includes("price-discussion")
      ? pickBy(seed + "e", ["Price was handled well: anchored on contracted stay rates and offered value (transfer upgrade / fewer nights) instead of a discount.", "Good reframing from discount to value. Next time, state the per-person number before the total — it lands softer."])
      : pickBy(seed + "e", [`Clear walk-through of the ${dest} plan; the traveller's questions were answered in order.`, "Explanation was concise. Consider summarising the three inclusions that matter most (stays, transfers, breakfast) once near the end."]),
    professionalism: pickBy(seed + "p", ["Warm, unhurried tone; no interruptions. Confirmed next steps before closing.", "Polite and clear. One small thing: avoid 'usually ho jaata hai' — commit to checking and coming back.", "Good listening; mirrored the traveller's words (beachfront, late checkout) when confirming."]),
    nextSteps: call.outcome === "callback"
      ? `Send the revised ${dest} version today and set the callback reminder for the day they named.`
      : call.outcome === "qualified"
        ? `Send the day-by-day plan on WhatsApp within 4 hours and hold the ${ctx.enquiry?.travelMonth ? new Date(ctx.enquiry.travelMonth + "-01").toLocaleDateString("en-IN", { month: "long" }) : "requested"} dates for 48 hours.`
        : call.outcome === "handoff"
          ? "Consultant to call back within the hour with exact cancellation options; do not quote refund figures over chat."
          : "Log the agreed follow-up as a task so the drip agent doesn't double-message.",
  };
  return { score, summary, tags: Array.from(new Set(tags)), coaching, analysedAt: now.toISOString() };
}

export function transcriptToText(call: Call, lines: TranscriptLine[], agentName: string, callerName: string): string {
  const head = `Call ${call.direction} · ${new Date(call.startedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · ${Math.round(call.durationSec / 60)} min\n\n`;
  return head + lines.map((l) => `[${String(Math.floor(l.t / 60)).padStart(2, "0")}:${String(l.t % 60).padStart(2, "0")}] ${l.speaker === "agent" ? agentName : callerName}: ${l.text}`).join("\n");
}
