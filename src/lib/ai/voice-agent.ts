import type { Call, Destination, Enquiry, Traveller, TranscriptLine, VoiceAgentConfig } from "@/lib/demo/types";

/**
 * Voice agent simulator. Produces a plausible call record for the demo —
 * an outbound qualification call to a new enquiry, or an inbound call about
 * an existing booking. In production this is a telephony webhook (Plivo /
 * Twilio / Exotel) driving a realtime speech model with the same policy.
 */
export function simulateOutboundQualification(opts: {
  enquiry: Enquiry;
  traveller: Traveller;
  destination?: Destination;
  config: VoiceAgentConfig;
  consultantName: string;
  answered?: boolean;
  now?: Date;
}): Omit<Call, "id"> {
  const { enquiry: e, traveller, destination, config, consultantName } = opts;
  const now = opts.now ?? new Date();
  const first = traveller.fullName.split(" ")[0];
  const answered = opts.answered ?? true;
  const pax = e.pax.adults + e.pax.children + e.pax.infants;
  const month = e.travelMonth ? new Date(e.travelMonth + "-01").toLocaleDateString("en-IN", { month: "long" }) : "soon";
  const pp = Math.round(e.budgetINR / Math.max(1, e.pax.adults + e.pax.children) / 1000);
  const hinglish = traveller.language === "hi" || traveller.language === "hinglish";
  const lines: TranscriptLine[] = answered
    ? [
        { speaker: "agent", text: `${hinglish ? "Namaste" : "Hi"} ${first}, this is ${config.name} from wishtrip. You just asked about ${e.destination} — is now a good time for two quick questions?`, t: 0 },
        { speaker: "caller", text: hinglish ? "Haan bolo, quick please." : "Sure, go ahead.", t: 8 },
        { speaker: "agent", text: "Which month are you looking at, and how many of you are travelling?", t: 12 },
        { speaker: "caller", text: `${month}, ${pax} of us.`, t: 19 },
        { speaker: "agent", text: `Lovely. And a rough budget per person — around ₹${pp}k, or should I plan differently?`, t: 26 },
        { speaker: "caller", text: `₹${pp}k is fine. ${e.pace === "slow" ? "Nothing too hectic." : "We want to see a lot."}`, t: 35 },
        ...(destination && destination.visa.type !== "none"
          ? [{ speaker: "agent" as const, text: `Noted. On visas: ${destination.visa.note}. We handle the file for you.`, t: 42 }, { speaker: "caller" as const, text: "Okay, good to know.", t: 50 }]
          : []),
        { speaker: "agent", text: `Perfect — ${e.nights} nights in ${e.destination}, ${pax} travellers, ${e.pace} pace. ${consultantName} will send a day-by-day plan on WhatsApp within a few hours. Anything else?`, t: 54 },
        { speaker: "caller", text: "No that's it, thanks!", t: 63 },
        { speaker: "agent", text: "Thank you, have a great day!", t: 66 },
      ]
    : [{ speaker: "agent", text: `Hi, this is ${config.name} from wishtrip calling about your ${e.destination} enquiry. I'll message you on WhatsApp instead — reply there whenever convenient.`, t: 0 }];
  return {
    enquiryId: e.id,
    travellerId: traveller.id,
    direction: "outbound",
    kind: "voice_agent",
    handledBy: "ai",
    phone: traveller.phone,
    startedAt: now.toISOString(),
    durationSec: answered ? 70 + lines.length * 4 : 18,
    status: answered ? "completed" : "voicemail",
    language: hinglish ? "hinglish" : "en",
    transcript: lines,
    summary: answered
      ? `Qualified: ${e.destination} in ${month}, ${pax} pax, ~₹${pp}k pp, ${e.pace} pace. Promised itinerary on WhatsApp.`
      : "No answer — left voicemail and fell back to WhatsApp.",
    extracted: answered ? { destination: e.destination, travelMonth: e.travelMonth, nights: e.nights, pax: e.pax, budgetINR: e.budgetINR, tripType: e.tripType, departureCity: e.departureCity } : undefined,
    outcome: answered ? "qualified" : "voicemail",
    sentiment: answered ? "positive" : "neutral",
    qualityScore: answered ? 86 : undefined,
    recordingAvailable: true,
  };
}
