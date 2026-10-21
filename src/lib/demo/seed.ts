import type {
  Activity,
  AgentEvent,
  Call,
  Campaign,
  ChecklistItem,
  DemoData,
  Document,
  Enquiry,
  EnquiryStage,
  Itinerary,
  LeadSource,
  Message,
  Payment,
  Referral,
  Review,
  Task,
  TranscriptLine,
  Traveller,
  Trip,
  TripType,
  Comfort,
  Pace,
} from "./types";
import { AUTO_REPLY_RULES, DEMO_USERS, DESTINATIONS, PACKAGES, SETTINGS, SUPPLIERS, TAGS, TEMPLATES } from "./seed-static";
import { generateItinerary } from "@/lib/ai/itinerary";
import { scoreEnquiry } from "@/lib/ai/scoring";

export { DEMO_USERS } from "./seed-static";

// ---------- deterministic PRNG ----------
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261021);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const chance = (p: number) => rand() < p;

let idc = 0;
const id = (p: string) => `${p}_${(++idc).toString(36).padStart(4, "0")}`;

const NOW = new Date();
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number, hour = between(9, 20), minute = between(0, 59)) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, between(0, 59), 0);
  return d;
};
const daysAhead = (n: number, hour = 10) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const minutesAfter = (d: Date | string, m: number) => new Date(new Date(d).getTime() + m * 60000);

// ---------- name pools ----------
const FIRST_F = ["Ananya", "Priya", "Shreya", "Neha", "Divya", "Pooja", "Kavya", "Riya", "Aditi", "Sakshi", "Meghna", "Isha", "Tanvi", "Nikita", "Swati", "Ritika", "Anjali", "Simran", "Bhavna", "Deepika"];
const FIRST_M = ["Rahul", "Arjun", "Rohit", "Siddharth", "Aman", "Karthik", "Vivek", "Nikhil", "Akash", "Varun", "Manish", "Saurabh", "Ankit", "Harsh", "Yash", "Pranav", "Abhishek", "Gaurav", "Tarun", "Aditya"];
const LAST = ["Sharma", "Reddy", "Patel", "Iyer", "Nair", "Gupta", "Verma", "Rao", "Menon", "Desai", "Joshi", "Kapoor", "Malhotra", "Bhat", "Chawla", "Sinha", "Mishra", "Pillai", "Banerjee", "Khanna", "Agarwal", "Das", "Jain", "Shetty"];
const CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"];
const CITY_W = [0.28, 0.2, 0.16, 0.12, 0.08, 0.08, 0.04, 0.04];
const wpick = <T,>(arr: readonly T[], w: number[]): T => {
  let r = rand();
  for (let i = 0; i < arr.length; i++) {
    r -= w[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
};

const SOURCES: LeadSource[] = ["instagram_comment", "instagram_dm", "website_planner", "whatsapp", "meta_lead_form", "google", "referral", "email", "phone", "repeat"];
const SOURCE_W = [0.3, 0.17, 0.17, 0.1, 0.06, 0.05, 0.06, 0.03, 0.04, 0.02];
const STAGE_PLAN: [EnquiryStage, number][] = [
  ["new", 6],
  ["contacted", 7],
  ["qualified", 8],
  ["itinerary_sent", 9],
  ["negotiation", 5],
  ["advance_paid", 5],
  ["docs_visa", 4],
  ["ready", 3],
  ["travelling", 2],
  ["completed", 9],
  ["lost", 6],
  ["non_lead", 2],
];
const TRIP_TYPES: TripType[] = ["couple", "honeymoon", "family", "friends", "solo", "parents", "corporate"];
const TRIP_TYPE_W = [0.3, 0.14, 0.18, 0.2, 0.06, 0.1, 0.02];
const PACES: Pace[] = ["slow", "balanced", "packed"];
const COMFORTS: Comfort[] = ["budget", "comfort", "premium", "luxury"];
const COMFORT_W = [0.2, 0.45, 0.27, 0.08];
const INTEREST_POOL = ["beaches", "mountains", "food", "nightlife", "culture", "wildlife", "adventure", "wellness", "shopping", "photography", "islands", "road trip", "temples", "cafes", "autumn colours"];

const REEL_BY_DEST: Record<string, string> = {
  goa: "instagram.com/p/DePC3B3jeYy · Goa 4 days: couple / friends / parents",
  kerala: "instagram.com/p/DeUdm5UkxwG · Kerala slow 5 days",
  thailand: "instagram.com/p/DeRwRD3BATd · Phuket without the crowds",
  japan: "instagram.com/p/DehMc7UNAA7 · Japan autumn colours",
  vietnam: "instagram.com/p/DeKXtM9Tv_7 · ₹1 lakh, 7 days, pick a country",
  bali: "instagram.com/p/DeKXtM9Tv_7 · ₹1 lakh, 7 days, pick a country",
  malaysia: "instagram.com/p/DeKXtM9Tv_7 · ₹1 lakh, 7 days, pick a country",
  dharamshala: "instagram.com/p/DeZf3b1N3ne · Diwali: how many days can you take off?",
};

const DEST_W: Record<string, number> = { goa: 0.2, kerala: 0.14, thailand: 0.15, japan: 0.1, vietnam: 0.08, bali: 0.1, dharamshala: 0.07, malaysia: 0.05, dubai: 0.04, kashmir: 0.03, ladakh: 0.02, andaman: 0.02 };

function destFor(): string {
  return wpick(Object.keys(DEST_W), Object.values(DEST_W));
}

function phone(): string {
  return `+91 ${between(70, 99)}${between(100, 999)} ${between(10000, 99999)}`;
}

function passport(): string {
  return `${String.fromCharCode(65 + between(0, 25))}${between(1000000, 9999999)}`;
}

function pkgFor(destId: string, tripType: TripType) {
  const cands = PACKAGES.filter((p) => p.destinationId === destId);
  if (cands.length === 0) return undefined;
  return cands.find((p) => p.tripTypes.includes(tripType)) ?? cands[0];
}

const SALES = DEMO_USERS.filter((u) => u.role === "SALES" || u.role === "MANAGER");
function consultantFor(destId: string): string {
  const spec = SALES.filter((u) => u.specialities.includes(destId));
  return (spec.length ? pick(spec) : pick(SALES)).sub;
}
const userName = (sub: string) => DEMO_USERS.find((u) => u.sub === sub)?.name ?? "wishtrip";

// ---------- message copy ----------
const OPENERS: Record<LeadSource, string[]> = {
  instagram_comment: ["PLAN", "PLAN 🙌", "PLAN — for 2, early Dec", "PLAN please!! 4 of us"],
  instagram_dm: ["Hi! Saw your {dest} reel. Can you plan something like that for us?", "Hey, how much would the {dest} trip cost for 2 people?", "Is {dest} doable in {nights} days? We're thinking {month}."],
  website_planner: ["[Website planner] New plan request: {dest}, {nights} nights, {pax} travellers, {tripType}, budget ₹{budget}.", "[Website planner] Built a {dest} plan on the site — wants a human to confirm stays and flights."],
  whatsapp: ["Hi, got your number from Instagram. Looking at {dest} for {month}.", "Hello, is this wishtrip? Need a {dest} package for {pax} people.", "Hi wishtrip, planning {dest} with family in {month}, please share options"],
  meta_lead_form: ["[Meta lead form] {dest} · {month} · {pax} pax · budget ₹{budget}"],
  google: ["Hi, found you on Google. Do you do customised {dest} trips?"],
  referral: ["Hi! {referrer} travelled with you and recommended you. We want to do {dest} in {month}."],
  email: ["Subject: {dest} trip enquiry\n\nHello, we are a group of {pax} planning {dest} for {nights} nights in {month}. Could you share a day-wise itinerary with pricing?"],
  phone: ["[Inbound call] Caller asked about {dest} for {month}; wants a plan on WhatsApp."],
  repeat: ["Hi {agent}! It's us again 😄 Thinking {dest} this time, {month}."],
};

const AI_FIRST_REPLY = [
  "Hi {first}! 👋 Saw your interest in {dest}. Tell me three things and I'll rebuild it for you: your dates (or month), who's travelling, and a rough budget per person.",
  "Hey {first}, Wish here from wishtrip 🌴 Love that you picked {dest}. Quick ones: which month, how many travellers, and budget per person roughly?",
];
const TRAVELLER_DETAILS = [
  "{month}, {pax} of us ({tripType}). Around ₹{pp} per person would be ideal. We like {interests}.",
  "Dates are flexible in {month}. {pax} people. Budget max ₹{budget} total. Prefer {pace} pace, {comfort} stays.",
  "Thinking {nights} nights in {month}. {pax} travelling. ₹{pp} pp is our range, flights from {city}.",
];
const AI_ACK = [
  "Perfect, {first}. {nights} nights in {dest} for {pax}, {pace} pace, ~₹{pp} per person — got it. Your consultant {agent} will send a day-by-day plan with transparent pricing within a few hours. Anything you'd like to avoid (long drives, early mornings)?",
  "Got it 🙌 {dest} · {month} · {pax} travellers · {comfort} stays. I've passed this to {agent}, who knows {dest} well. You'll have a plan on this chat today.",
];
const CONSULTANT_SEND = [
  "Hi {first}, {agent} here 🙂 Your {nights}-night {dest} plan is ready: {link}. Total ₹{total} for {pax} travellers — stays, transfers and breakfast included. Tell me what to tweak!",
  "{first}, sharing your {dest} plan (v{v}): {link}. I kept it {pace}, with {stays} stays. ₹{total} all-in. Happy to swap any stay or shift the dates.",
];
const NEGOTIATION_IN = [
  "Looks great! Can we do it under ₹{budget}? Maybe drop one night?",
  "Love the plan. Is there any discount if we pay full upfront?",
  "Can you change the second stay to something closer to the beach? And add a late checkout on the last day.",
  "Friends want to join — can you redo it for {pax2} people?",
];
const ADVANCE_IN = ["Paid the advance just now, UPI ref {ref}. Please confirm 🙏", "Done! Transferred ₹{amount}. Sending passports tonight."];
const LOST_IN = ["Thanks, but we've decided to postpone to next year.", "Found a cheaper option elsewhere, sorry!", "Plans changed, won't be travelling this time.", "Going with a friend's recommendation instead. Thank you for the effort though!"];
const LOST_REASONS = ["Postponed", "Price — chose cheaper option", "Plans changed", "Went with competitor", "No response after 3 follow-ups", "Dates unavailable"];

function fill(t: string, v: Record<string, string | number>): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? `{${k}}`));
}

// ---------- generator ----------
export function generateSeed(): DemoData {
  idc = 0;
  const travellers: Traveller[] = [];
  const enquiries: Enquiry[] = [];
  const itineraries: Itinerary[] = [];
  const trips: Trip[] = [];
  const payments: Payment[] = [];
  const documents: Document[] = [];
  const messages: Message[] = [];
  const calls: Call[] = [];
  const tasks: Task[] = [];
  const agentEvents: AgentEvent[] = [];
  const reviews: Review[] = [];
  const referrals: Referral[] = [];
  const activities: Activity[] = [];

  const act = (at: Date | string, actorKind: Activity["actorKind"], actor: string, type: string, text: string, refs: Partial<Pick<Activity, "enquiryId" | "tripId" | "travellerId">> = {}) => {
    activities.push({ id: id("act"), at: typeof at === "string" ? at : iso(at), actor, actorKind, type, text, ...refs });
  };
  const evt = (e: Omit<AgentEvent, "id">) => agentEvents.push({ id: id("evt"), ...e });

  let refNo = 1040;
  let tripNo = 18;

  // Returning travellers (completed trips earlier in the year) make the base.
  const makeTraveller = (opts: { createdAt: Date; tripsCount?: number; ltv?: number; lastTripAt?: string }): Traveller => {
    const female = chance(0.5);
    const first = female ? pick(FIRST_F) : pick(FIRST_M);
    const last = pick(LAST);
    const city = wpick(CITIES, CITY_W);
    const t: Traveller = {
      id: id("trv"),
      fullName: `${first} ${last}`,
      phone: phone(),
      email: chance(0.8) ? `${first.toLowerCase()}.${last.toLowerCase()}${between(1, 99)}@gmail.com` : undefined,
      city,
      instagramHandle: chance(0.7) ? `@${first.toLowerCase()}${pick(["", ".", "_"])}${last.toLowerCase().slice(0, 4)}${between(1, 999)}` : undefined,
      preferredChannel: wpick(["whatsapp", "instagram", "email"] as const, [0.75, 0.2, 0.05]),
      language: wpick(["en", "hinglish", "hi", "te", "ta", "mr"] as const, [0.5, 0.25, 0.1, 0.05, 0.05, 0.05]),
      dob: chance(0.6) ? iso(new Date(between(1978, 2002), between(0, 11), between(1, 28))) : undefined,
      gender: female ? "female" : "male",
      nationality: "Indian",
      passportNo: chance(0.55) ? passport() : undefined,
      passportExpiry: undefined,
      anniversary: chance(0.3) ? iso(new Date(2024, between(0, 11), between(1, 28))) : undefined,
      foodPref: wpick(["no_preference", "veg", "non_veg", "jain", "vegan", "halal"] as const, [0.45, 0.3, 0.15, 0.05, 0.02, 0.03]),
      pace: pick(PACES),
      comfort: wpick(COMFORTS, COMFORT_W),
      interests: Array.from(new Set([pick(INTEREST_POOL), pick(INTEREST_POOL), pick(INTEREST_POOL)])),
      tags: [],
      blocked: false,
      tripsCount: opts.tripsCount ?? 0,
      lifetimeValueINR: opts.ltv ?? 0,
      lastTripAt: opts.lastTripAt,
      createdAt: iso(opts.createdAt),
    };
    if (t.passportNo) {
      // A few passports expire soon to trigger the 6-month rule.
      t.passportExpiry = chance(0.15) ? iso(daysAhead(between(40, 170))) : iso(new Date(between(2027, 2034), between(0, 11), between(1, 28)));
    }
    travellers.push(t);
    return t;
  };

  const checklistFor = (start: Date, destId: string): ChecklistItem[] => {
    const dest = DESTINATIONS.find((d) => d.id === destId)!;
    const items: ChecklistItem[] = [
      { key: "advance", label: "Advance received & booking confirmed", offsetDays: -60, done: false, auto: true },
      { key: "passports", label: "Passport copies for all travellers", offsetDays: -50, done: false, auto: false },
      ...(dest.visa.type === "embassy" || dest.visa.type === "evisa" ? [{ key: "visa", label: `Visa ${dest.visa.type === "embassy" ? "appointment & submission" : "e-visa applied"}`, offsetDays: -40, done: false, auto: false }] : []),
      { key: "stays", label: "Stays confirmed with suppliers", offsetDays: -35, done: false, auto: false },
      { key: "flights", label: "Flights ticketed (PNR shared)", offsetDays: -30, done: false, auto: false },
      { key: "insurance", label: "Travel insurance issued", offsetDays: -21, done: false, auto: false },
      { key: "balance", label: "Balance payment received", offsetDays: -21, done: false, auto: true },
      { key: "vouchers", label: "Vouchers & tickets sent on WhatsApp", offsetDays: -7, done: false, auto: false },
      { key: "predeparture", label: "Pre-departure call / message", offsetDays: -1, done: false, auto: true },
      { key: "midtrip", label: "Mid-trip check-in", offsetDays: 2, done: false, auto: true },
      { key: "review", label: "Review & referral request", offsetDays: 99, done: false, auto: true },
    ];
    return items;
  };

  // ----- build enquiries per stage plan -----
  for (const [stage, count] of STAGE_PLAN) {
    for (let i = 0; i < count; i++) {
      const ageDays =
        stage === "new" ? between(0, 1)
        : stage === "contacted" ? between(1, 4)
        : stage === "qualified" ? between(2, 7)
        : stage === "itinerary_sent" ? between(3, 12)
        : stage === "negotiation" ? between(5, 18)
        : stage === "advance_paid" ? between(10, 30)
        : stage === "docs_visa" ? between(20, 45)
        : stage === "ready" ? between(30, 60)
        : stage === "travelling" ? between(35, 70)
        : stage === "completed" ? between(60, 200)
        : stage === "lost" ? between(10, 60)
        : between(1, 20);
      const createdAt = daysAgo(ageDays);
      const source: LeadSource = stage === "non_lead" ? pick(["whatsapp", "instagram_dm", "email"] as LeadSource[]) : wpick(SOURCES, SOURCE_W);
      const isRepeat = source === "repeat" || (stage === "completed" && chance(0.15));
      const traveller = makeTraveller({ createdAt: isRepeat ? daysAgo(ageDays + between(120, 400)) : createdAt, tripsCount: isRepeat ? 1 : 0, ltv: isRepeat ? between(60, 180) * 1000 : 0, lastTripAt: isRepeat ? iso(daysAgo(ageDays + between(120, 400))) : undefined });
      const needsPkg = ["itinerary_sent", "negotiation", "advance_paid", "docs_visa", "ready", "travelling", "completed"].includes(stage);
      let destId = destFor();
      while (needsPkg && !PACKAGES.some((p) => p.destinationId === destId)) destId = destFor();
      const dest = DESTINATIONS.find((d) => d.id === destId)!;
      const tripType = wpick(TRIP_TYPES, TRIP_TYPE_W);
      const adults = tripType === "solo" ? 1 : tripType === "couple" || tripType === "honeymoon" ? 2 : tripType === "friends" ? between(3, 6) : tripType === "corporate" ? between(6, 12) : between(2, 4);
      const children = tripType === "family" ? between(1, 2) : tripType === "parents" && chance(0.3) ? 1 : 0;
      const pax = { adults, children, infants: tripType === "family" && chance(0.2) ? 1 : 0 };
      const pkg = pkgFor(destId, tripType);
      const nights = pkg ? pkg.nights + between(-1, 2) : between(3, 7);
      const n = Math.max(2, nights);
      const comfort = traveller.comfort;
      const pace = tripType === "parents" || tripType === "honeymoon" ? (chance(0.7) ? "slow" : "balanced") : traveller.pace;
      // Travel dates: won stages have concrete dates relative to stage.
      let travelStart: Date | undefined;
      if (stage === "travelling") travelStart = daysAgo(between(1, 3));
      else if (stage === "completed") travelStart = daysAgo(between(10, ageDays - 15 > 10 ? ageDays - 15 : 11));
      else if (stage === "ready") travelStart = daysAhead(between(2, 14));
      else if (stage === "docs_visa") travelStart = daysAhead(between(15, 50));
      else if (stage === "advance_paid") travelStart = daysAhead(between(30, 90));
      else if (chance(0.65)) travelStart = daysAhead(between(14, 120));
      const travelEnd = travelStart ? addDays(travelStart, n) : undefined;
      const month = travelStart ?? daysAhead(between(20, 120));
      const monthLabel = month.toLocaleString("en-IN", { month: "long" });
      const pp = Math.round(((pkg?.fromPriceINR ?? dest.fromPriceINR) * (comfort === "luxury" ? 1.8 : comfort === "premium" ? 1.3 : comfort === "budget" ? 0.85 : 1)) / 1000) * 1000;
      const budget = pp * (adults + children);
      const owner = stage === "new" && chance(0.5) ? undefined : stage === "non_lead" ? undefined : consultantFor(destId);
      const handledByAgent = ["new", "contacted", "qualified"].includes(stage) && chance(0.8);
      const lastStageChange = stage === "new" ? createdAt : daysAgo(Math.max(0, Math.floor(ageDays * 0.3)));
      const whatsappWindow = ["new", "contacted", "qualified", "itinerary_sent", "negotiation"].includes(stage) && chance(0.6) ? iso(minutesAfter(NOW, between(30, 23 * 60))) : undefined;

      const enquiry: Enquiry = {
        id: id("enq"),
        ref: `WT-${refNo++}`,
        travellerId: traveller.id,
        stage,
        source,
        campaign: source === "instagram_comment" ? (destId === "japan" ? "japan-autumn" : destId === "dharamshala" || chance(0.3) ? "diwali-2026" : "ig-plan") : source === "meta_lead_form" ? "ctwa-bali-oct" : undefined,
        reelRef: source === "instagram_comment" || source === "instagram_dm" ? REEL_BY_DEST[destId] : undefined,
        destinationId: destId,
        destination: dest.name,
        altDestinations: chance(0.3) ? [DESTINATIONS.find((d) => d.id === destFor() && d.id !== destId)?.name ?? "Bali"].filter(Boolean) : [],
        travelStart: travelStart ? iso(travelStart) : undefined,
        travelEnd: travelEnd ? iso(travelEnd) : undefined,
        travelMonth: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
        nights: n,
        flexibility: travelStart ? (chance(0.6) ? "fixed" : "plus_minus_3") : "flexible_month",
        pax,
        rooms: Math.ceil((adults + children) / 2),
        tripType,
        pace,
        comfort,
        foodPref: traveller.foodPref,
        budgetINR: budget,
        includeFlights: chance(0.6),
        departureCity: traveller.city,
        interests: traveller.interests,
        notes: stage === "non_lead" ? pick(["Vendor pitching hotel inventory", "Wrong number", "Spam — crypto promo"]) : chance(0.4) ? pick(["Wants late checkout on last day", "Vegetarian only, no seafood", "Anniversary on day 2 — surprise cake", "Elderly parents — avoid long drives", "Needs invoice in company name"]) : undefined,
        assignedTo: owner,
        tags: [
          ...(source === "instagram_comment" ? ["ig-plan"] : []),
          ...(tripType === "honeymoon" ? ["honeymoon"] : []),
          ...(tripType === "parents" ? ["parents"] : []),
          ...(isRepeat ? ["repeat"] : []),
          ...(source === "referral" ? ["referral"] : []),
          ...(stage === "docs_visa" ? ["docs-pending", ...(dest.visa.type === "embassy" ? ["visa-pending"] : [])] : []),
          ...(stage === "negotiation" && chance(0.5) ? ["discount-asked"] : []),
          ...(!travelStart ? ["flexible-dates"] : []),
        ],
        aiScore: null,
        needsAttention: false,
        handledByAgent,
        lostReason: stage === "lost" ? pick(LOST_REASONS) : undefined,
        whatsappWindowExpiresAt: whatsappWindow,
        firstResponseMinutes: stage === "new" ? undefined : handledByAgent || source === "instagram_comment" ? between(0, 3) : between(4, 95),
        createdAt: iso(createdAt),
        updatedAt: iso(lastStageChange),
        lastActivityAt: iso(stage === "new" ? createdAt : daysAgo(between(0, Math.min(ageDays, 5)))),
        lastInboundAt: iso(createdAt),
        lastStageChangeAt: iso(lastStageChange),
      };
      enquiries.push(enquiry);
      act(createdAt, source === "website_planner" || source === "meta_lead_form" ? "system" : "traveller", traveller.fullName, "enquiry_created", `New enquiry ${enquiry.ref} for ${dest.name} via ${source.replace("_", " ")}`, { enquiryId: enquiry.id, travellerId: traveller.id });

      // ----- conversation -----
      const chan = source === "instagram_comment" || source === "instagram_dm" ? "instagram" : source === "email" ? "email" : "whatsapp";
      const v = {
        first: traveller.fullName.split(" ")[0],
        dest: dest.name,
        nights: n,
        pax: adults + children + pax.infants,
        pax2: adults + children + 2,
        tripType,
        budget: budget.toLocaleString("en-IN"),
        pp: pp.toLocaleString("en-IN"),
        month: monthLabel,
        interests: traveller.interests.slice(0, 2).join(" and "),
        pace,
        comfort,
        city: traveller.city,
        agent: owner ? userName(owner).split(" ")[0] : "Priya",
        referrer: pick(travellers.filter((t) => t.tripsCount > 0).map((t) => t.fullName)) ?? "A friend",
        link: `wishtrip.co/i/${enquiry.ref.toLowerCase()}`,
        v: 1,
        stays: Math.max(1, Math.floor(n / 2)),
        total: "",
        ref: `UPI${between(100000000, 999999999)}`,
        amount: "",
      };
      let t = createdAt;
      const msg = (direction: Message["direction"], body: string, sentBy: string, extra: Partial<Message> = {}) => {
        const m: Message = { id: id("msg"), travellerId: traveller.id, enquiryId: enquiry.id, channel: chan, direction, body, at: iso(t), sentBy, status: direction === "inbound" ? "read" : chance(0.9) ? "read" : "delivered", ...extra };
        messages.push(m);
        return m;
      };
      if (source !== "phone") msg("inbound", fill(pick(OPENERS[source]), v), "traveller");

      if (stage !== "new" && stage !== "non_lead") {
        // AI agent first reply (auto) for chat channels.
        t = minutesAfter(t, between(1, 3));
        const auto = chan !== "email";
        if (auto) {
          msg("outbound", fill(pick(AI_FIRST_REPLY), v), "ai", { ai: { intent: "new_enquiry", confidence: 0.96, action: "auto_sent", reason: "New enquiry greeting — within policy" } });
          evt({ agent: "autoreply", at: iso(t), enquiryId: enquiry.id, travellerId: traveller.id, action: "Auto-replied to new enquiry", detail: `Sent welcome + 3 qualifying questions on ${chan} (${between(40, 170)}s after message)`, confidence: 0.96, status: "auto" });
          act(t, "ai", "Wish (auto-reply agent)", "auto_reply", "Welcome + qualifying questions sent", { enquiryId: enquiry.id });
        } else {
          msg("outbound", fill("Hi {first}, thanks for writing in! {agent} here from wishtrip. To build your {dest} plan I need your dates or month, number of travellers and a rough budget per person.", v), owner ?? "u_priya");
        }
        if (stage !== "contacted" || chance(0.5)) {
          t = minutesAfter(t, between(10, 240));
          msg("inbound", fill(pick(TRAVELLER_DETAILS), v), "traveller");
          t = minutesAfter(t, between(1, 4));
          if (auto) {
            msg("outbound", fill(pick(AI_ACK), v), "ai", { ai: { intent: "trip_brief_captured", confidence: 0.91, action: "auto_sent", reason: "Extracted dates/pax/budget; handed to consultant" } });
            evt({ agent: "autoreply", at: iso(t), enquiryId: enquiry.id, travellerId: traveller.id, action: "Captured trip brief", detail: `Extracted: ${dest.name} · ${monthLabel} · ${v.pax} pax · ₹${v.pp}/pp · ${pace} pace → stage Qualified`, confidence: 0.91, status: "auto", payload: { destination: dest.name, month: monthLabel, pax: v.pax, budgetPP: pp } });
            act(t, "ai", "Wish (auto-reply agent)", "stage_change", "Moved to Qualified after capturing dates, pax and budget", { enquiryId: enquiry.id });
          }
        }
      }

      // ----- itineraries for itinerary_sent+ -----
      const needsItin = ["itinerary_sent", "negotiation", "advance_paid", "docs_visa", "ready", "travelling", "completed"].includes(stage) || (stage === "lost" && chance(0.6));
      let acceptedItin: Itinerary | undefined;
      if (needsItin && pkg) {
        const versions = stage === "negotiation" ? 2 : ["advance_paid", "docs_visa", "ready", "travelling", "completed"].includes(stage) && chance(0.4) ? 2 : 1;
        for (let vi = 1; vi <= versions; vi++) {
          t = minutesAfter(t, between(60, 60 * 6));
          const gen = generateItinerary({ pkg, destination: dest, nights: n, pax, pace, comfort: vi === 2 && chance(0.5) ? "comfort" : comfort, startDate: enquiry.travelStart, includeFlights: enquiry.includeFlights, departureCity: traveller.city, budgetINR: budget });
          const isLast = vi === versions;
          const status: Itinerary["status"] = !isLast ? "revised" : stage === "itinerary_sent" ? (chance(0.6) ? "viewed" : "sent") : stage === "negotiation" ? "viewed" : stage === "lost" ? "rejected" : "accepted";
          const itin: Itinerary = {
            id: id("itin"),
            enquiryId: enquiry.id,
            version: vi,
            title: gen.title,
            destinationId: destId,
            nights: n,
            startDate: enquiry.travelStart,
            pax,
            pace,
            comfort,
            days: gen.days,
            stays: gen.stays,
            flights: gen.flights,
            inclusions: gen.inclusions,
            exclusions: gen.exclusions,
            pricing: gen.pricing,
            status,
            generatedByAI: true,
            basedOnPackageId: pkg.id,
            shareSlug: `${enquiry.ref.toLowerCase()}-v${vi}`,
            createdBy: owner ?? "u_priya",
            createdAt: iso(t),
            sentAt: iso(minutesAfter(t, 20)),
            viewedAt: status === "sent" ? undefined : iso(minutesAfter(t, between(40, 600))),
            changeNote: vi === 2 ? pick(["Dropped to comfort stays to fit budget", "Swapped second stay for beachfront", "Added one night; late checkout on last day", "Rebuilt for 2 extra travellers"]) : undefined,
          };
          itineraries.push(itin);
          evt({ agent: "itinerary", at: iso(t), enquiryId: enquiry.id, travellerId: traveller.id, action: `Drafted itinerary v${vi}`, detail: `${gen.title} · ₹${gen.pricing.totalINR.toLocaleString("en-IN")} · ${gen.rationale[0]}`, confidence: 0.88, status: "approved", reviewedBy: owner ?? "u_priya", reviewedAt: iso(minutesAfter(t, 15)) });
          act(minutesAfter(t, 20), "user", userName(owner ?? "u_priya"), "itinerary_sent", `Itinerary v${vi} sent — ₹${gen.pricing.totalINR.toLocaleString("en-IN")}`, { enquiryId: enquiry.id });
          t = minutesAfter(t, 20);
          v.total = gen.pricing.totalINR.toLocaleString("en-IN");
          v.v = vi;
          msg("outbound", fill(pick(CONSULTANT_SEND), v), owner ?? "u_priya", { templateId: "tpl_itinerary_sent" });
          if (vi < versions || stage === "negotiation") {
            t = minutesAfter(t, between(120, 1800));
            msg("inbound", fill(pick(NEGOTIATION_IN), v), "traveller");
            if (stage === "negotiation" && vi === versions) {
              t = minutesAfter(t, 2);
              msg("outbound", "Let me check what we can do on the stays for your dates — give me a little while and I'll come back with options.", "ai", { status: "draft", ai: { intent: "discount", confidence: 0.62, action: "drafted", reason: "Discount request is a hand-off topic — drafted for consultant review" } });
              evt({ agent: "autoreply", at: iso(t), enquiryId: enquiry.id, travellerId: traveller.id, action: "Drafted reply (needs review)", detail: "Traveller asked for a discount — hand-off topic. Draft waiting for consultant.", confidence: 0.62, status: "needs_review" });
              enquiry.needsAttention = true;
            }
          }
          if (status === "accepted") acceptedItin = itin;
          if (status === "rejected") {
            t = minutesAfter(t, between(600, 4000));
            msg("inbound", pick(LOST_IN), "traveller");
          }
        }
      }
      if (stage === "lost" && !needsItin) {
        t = minutesAfter(t, between(600, 4000));
        if (chance(0.5)) msg("inbound", pick(LOST_IN), "traveller");
        else {
          // No response: follow-up agent exhausted attempts.
          for (let k = 1; k <= 3; k++) {
            t = minutesAfter(t, 60 * 24 * [1, 2, 4][k - 1]);
            msg("outbound", fill("Hi {first}, did you get a chance to look at the {dest} plan? Happy to adjust dates, stays or budget — just reply here 😊", v), "ai", { ai: { intent: "no_reply_followup", confidence: 0.9, action: "auto_sent", reason: `Follow-up ${k}/3 (no reply ${[1, 3, 7][k - 1]}d)` } });
          }
          evt({ agent: "followup", at: iso(t), enquiryId: enquiry.id, travellerId: traveller.id, action: "Follow-up sequence exhausted", detail: "3 nudges over 7 days, no reply — marked Lost (no response)", confidence: 0.9, status: "auto" });
        }
        act(t, "user", userName(owner ?? "u_priya"), "stage_change", `Marked Lost — ${enquiry.lostReason}`, { enquiryId: enquiry.id });
      }
      if (stage === "itinerary_sent" && chance(0.5)) {
        t = minutesAfter(t, 60 * 24);
        msg("outbound", fill("Hi {first}, did you get a chance to look at the {dest} plan? Happy to adjust dates, stays or budget — just reply here 😊", v), "ai", { ai: { intent: "no_reply_followup", confidence: 0.9, action: "auto_sent", reason: "Follow-up 1/3 (no reply 24h)" } });
        evt({ agent: "followup", at: iso(t), enquiryId: enquiry.id, travellerId: traveller.id, action: "Sent 24h follow-up", detail: "No reply to itinerary for 24h — nudge 1/3 sent on WhatsApp", confidence: 0.9, status: "auto" });
      }

      // ----- trips / payments / docs for won stages -----
      if (acceptedItin && travelStart && travelEnd) {
        const total = acceptedItin.pricing.totalINR;
        const tripStatus: Trip["status"] =
          stage === "advance_paid" ? "confirmed" : stage === "docs_visa" ? "docs_pending" : stage === "ready" ? "ready" : stage === "travelling" ? "on_trip" : "completed";
        const checklist = checklistFor(travelStart, destId);
        const doneUpTo = stage === "advance_paid" ? ["advance"] : stage === "docs_visa" ? ["advance", "passports", ...(chance(0.5) ? ["stays"] : [])] : stage === "ready" ? checklist.filter((c) => c.offsetDays <= -1).map((c) => c.key) : stage === "travelling" ? checklist.filter((c) => c.offsetDays <= 0).map((c) => c.key) : checklist.map((c) => c.key);
        for (const c of checklist) {
          if (doneUpTo.includes(c.key)) {
            c.done = true;
            c.doneAt = iso(addDays(travelStart, c.offsetDays));
          }
        }
        if (stage === "completed" && chance(0.15)) {
          const idx = checklist.findIndex((c) => c.key === "review");
          checklist[idx].done = false;
          checklist[idx].doneAt = undefined;
        }
        const trip: Trip = {
          id: id("trip"),
          ref: `WTB-2026-${String(tripNo++).padStart(3, "0")}`,
          enquiryId: enquiry.id,
          travellerId: traveller.id,
          travellerIds: [traveller.id],
          itineraryId: acceptedItin.id,
          destinationId: destId,
          destination: dest.name,
          title: acceptedItin.title,
          startDate: iso(travelStart),
          endDate: iso(travelEnd),
          pax,
          status: tripStatus,
          totalINR: total,
          paidINR: 0,
          marginINR: acceptedItin.pricing.marginINR,
          checklist,
          tripCaptain: "u_meera",
          specialRequests: enquiry.notes,
          cancellationPolicy: "Token non-refundable · 61+ days 10% · 31–60 days 25% · 15–30 days 50% · <15 days 100% · GST non-refundable",
          createdAt: iso(t),
        };
        trips.push(trip);
        enquiry.tripId = trip.id;
        traveller.tripsCount += 1;
        traveller.lifetimeValueINR += total;
        if (stage === "completed") traveller.lastTripAt = iso(travelEnd);
        t = minutesAfter(t, between(120, 2000));
        v.amount = Math.round(total * 0.25).toLocaleString("en-IN");
        msg("inbound", fill(pick(ADVANCE_IN), v), "traveller");
        t = minutesAfter(t, 5);
        msg("outbound", fill("You're booked, {first}! 🎉 {dest} · " + `${travelStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}–${travelEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` + " · ref " + trip.ref + ". Next: please send passport copies for all travellers here. Your trip captain Meera will be on this chat.", v), owner ?? "u_priya", { templateId: "tpl_booking_confirmed" });
        act(t, "system", "System", "booking_confirmed", `Booking ${trip.ref} confirmed — advance received`, { enquiryId: enquiry.id, tripId: trip.id, travellerId: traveller.id });

        // payment schedule
        const sched = SETTINGS.payment.schedule;
        const bookingDate = new Date(t);
        sched.forEach((s, si) => {
          const due = si === 0 ? bookingDate : addDays(travelStart, s.offsetDays);
          const amount = si === sched.length - 1 ? total - sched.slice(0, -1).reduce((acc, x) => acc + Math.round((total * x.pct) / 100), 0) : Math.round((total * s.pct) / 100);
          const isPaid = si === 0 || (stage === "ready" || stage === "travelling" || stage === "completed") || (stage === "docs_visa" && si === 1 && chance(0.5));
          const overdue = !isPaid && due < NOW;
          const p: Payment = {
            id: id("pay"),
            tripId: trip.id,
            travellerId: traveller.id,
            label: s.label,
            amountINR: amount,
            dueAt: iso(due < bookingDate ? bookingDate : due),
            status: isPaid ? "paid" : overdue ? "overdue" : "pending",
            paidAt: isPaid ? iso(si === 0 ? bookingDate : addDays(due, -between(0, 5))) : undefined,
            mode: isPaid ? wpick(["upi", "razorpay_link", "bank_transfer", "card"] as const, [0.45, 0.3, 0.15, 0.1]) : undefined,
            reference: isPaid ? `UPI${between(100000000, 999999999)}` : undefined,
            linkUrl: `https://rzp.io/l/wt-${trip.ref.toLowerCase()}-${si + 1}`,
            invoiceNo: isPaid ? `INV/26-27/${between(100, 999)}` : undefined,
            receiptNo: isPaid ? `RCP/26-27/${between(100, 999)}` : undefined,
            reminderCount: overdue ? between(1, 2) : 0,
            lastReminderAt: overdue ? iso(daysAgo(between(1, 4))) : undefined,
          };
          payments.push(p);
          if (isPaid) trip.paidINR += amount;
          if (overdue) {
            if (!enquiry.tags.includes("balance-due")) enquiry.tags.push("balance-due");
            tasks.push({ id: id("task"), title: `Chase ${s.label.toLowerCase()} ₹${amount.toLocaleString("en-IN")} — ${trip.ref}`, kind: "payment_reminder", enquiryId: enquiry.id, tripId: trip.id, travellerId: traveller.id, assignedTo: "u_vikram", dueAt: iso(daysAgo(1)), status: "open", priority: "high", createdBy: "system", createdAt: iso(due) });
            evt({ agent: "followup", at: iso(daysAgo(between(1, 4))), enquiryId: enquiry.id, tripId: trip.id, travellerId: traveller.id, action: "Payment reminder sent", detail: `${s.label} ₹${amount.toLocaleString("en-IN")} overdue — WhatsApp utility reminder with Pay Now link`, confidence: 1, status: "auto" });
          }
        });

        // documents
        const docAt = addDays(bookingDate, between(1, 6));
        if (checklist.find((c) => c.key === "passports")?.done || chance(0.5)) {
          documents.push({ id: id("doc"), travellerId: traveller.id, tripId: trip.id, enquiryId: enquiry.id, category: "passport", name: `Passport — ${traveller.fullName}`, fileName: `passport_${traveller.fullName.split(" ")[0].toLowerCase()}.jpg`, sizeKB: between(400, 1800), uploadedAt: iso(docAt), uploadedBy: traveller.fullName, verified: chance(0.8), expiresAt: traveller.passportExpiry });
          if (pax.adults > 1) documents.push({ id: id("doc"), travellerId: traveller.id, tripId: trip.id, enquiryId: enquiry.id, category: "passport", name: `Passport — co-traveller`, fileName: `passport_2.jpg`, sizeKB: between(400, 1800), uploadedAt: iso(docAt), uploadedBy: traveller.fullName, verified: chance(0.7) });
        }
        documents.push({ id: id("doc"), tripId: trip.id, enquiryId: enquiry.id, travellerId: traveller.id, category: "itinerary", name: `Itinerary v${acceptedItin.version} — ${dest.name}`, fileName: `${trip.ref}_itinerary.pdf`, sizeKB: between(300, 900), uploadedAt: iso(bookingDate), uploadedBy: "System", verified: true });
        documents.push({ id: id("doc"), tripId: trip.id, enquiryId: enquiry.id, travellerId: traveller.id, category: "invoice", name: `Advance invoice`, fileName: `${trip.ref}_INV_advance.pdf`, sizeKB: between(80, 200), uploadedAt: iso(bookingDate), uploadedBy: "System", verified: true });
        if (checklist.find((c) => c.key === "flights")?.done) documents.push({ id: id("doc"), tripId: trip.id, enquiryId: enquiry.id, travellerId: traveller.id, category: "ticket", name: `E-tickets ${acceptedItin.flights[0]?.from ?? "BLR"}–${acceptedItin.flights[0]?.to ?? "GOI"}`, fileName: `${trip.ref}_tickets.pdf`, sizeKB: between(120, 400), uploadedAt: iso(addDays(travelStart, -30)), uploadedBy: "Meera Pillai", verified: true });
        if (checklist.find((c) => c.key === "vouchers")?.done) documents.push({ id: id("doc"), tripId: trip.id, enquiryId: enquiry.id, travellerId: traveller.id, category: "voucher", name: `Hotel vouchers (${acceptedItin.stays.length})`, fileName: `${trip.ref}_vouchers.pdf`, sizeKB: between(200, 600), uploadedAt: iso(addDays(travelStart, -7)), uploadedBy: "Meera Pillai", verified: true });
        if (checklist.find((c) => c.key === "visa")?.done) documents.push({ id: id("doc"), tripId: trip.id, enquiryId: enquiry.id, travellerId: traveller.id, category: "visa", name: `${dest.name} visa — approved`, fileName: `${trip.ref}_visa.pdf`, sizeKB: between(150, 500), uploadedAt: iso(addDays(travelStart, -25)), uploadedBy: "VisaDesk India", verified: true });

        // ops tasks
        if (stage === "docs_visa") {
          if (!checklist.find((c) => c.key === "passports")?.done) tasks.push({ id: id("task"), title: `Collect passport copies — ${trip.ref}`, kind: "document", enquiryId: enquiry.id, tripId: trip.id, travellerId: traveller.id, assignedTo: "u_meera", dueAt: iso(daysAhead(between(0, 3))), status: "open", priority: "high", createdBy: "system", createdAt: iso(bookingDate) });
          if (checklist.find((c) => c.key === "visa") && !checklist.find((c) => c.key === "visa")?.done) tasks.push({ id: id("task"), title: `${dest.name} visa: ${dest.visa.type === "embassy" ? "book VFS appointment" : "apply e-visa"} — ${trip.ref}`, kind: "visa", enquiryId: enquiry.id, tripId: trip.id, travellerId: traveller.id, assignedTo: "u_meera", dueAt: iso(daysAhead(between(1, 5))), status: "open", priority: "high", createdBy: "system", createdAt: iso(bookingDate), notes: dest.visa.note });
          if (!checklist.find((c) => c.key === "stays")?.done) tasks.push({ id: id("task"), title: `Confirm stays with suppliers — ${trip.ref}`, kind: "custom", enquiryId: enquiry.id, tripId: trip.id, travellerId: traveller.id, assignedTo: "u_meera", dueAt: iso(daysAhead(between(2, 7))), status: "open", priority: "normal", createdBy: "system", createdAt: iso(bookingDate) });
        }
        if (stage === "ready") tasks.push({ id: id("task"), title: `Pre-departure message + local contact — ${trip.ref}`, kind: "pre_departure", enquiryId: enquiry.id, tripId: trip.id, travellerId: traveller.id, assignedTo: "u_meera", dueAt: iso(addDays(travelStart, -1)), status: "open", priority: "normal", createdBy: "system", createdAt: iso(bookingDate) });
        if (stage === "travelling") tasks.push({ id: id("task"), title: `Mid-trip check-in — ${traveller.fullName.split(" ")[0]} in ${dest.name}`, kind: "mid_trip", enquiryId: enquiry.id, tripId: trip.id, travellerId: traveller.id, assignedTo: "u_meera", dueAt: iso(daysAhead(0, 11)), status: "open", priority: "normal", createdBy: "ai", createdAt: iso(travelStart) });
        if (stage === "completed") {
          const rating = wpick([5, 4, 3, 2], [0.55, 0.3, 0.1, 0.05]);
          const reviewAt = addDays(travelEnd, 2);
          const received = chance(0.8);
          reviews.push({ id: id("rev"), tripId: trip.id, travellerId: traveller.id, rating: received ? rating : 0, text: received ? (rating >= 4 ? pick(["Everything was planned around us — no rush, great stays. Will book again!", "Loved that the plan was built around our pace. Trip captain was super responsive on WhatsApp.", "Transparent pricing, zero surprises. Munnar stay was the highlight.", "Best trip we've done. The itinerary felt like it was made for us, because it was."]) : pick(["Good trip overall but the second hotel was far from the beach.", "Transfers were late twice. Rest was fine."])) : undefined, platform: received && rating >= 4 ? (chance(0.6) ? "google" : "instagram") : "internal", status: !received ? "requested" : rating >= 4 ? "published" : "resolution", at: iso(reviewAt) });
          if (received && rating >= 4) {
            const code = `${traveller.fullName.split(" ")[0].toUpperCase().slice(0, 5)}${between(10, 99)}`;
            traveller.referralCode = code;
            referrals.push({ id: id("ref"), code, travellerId: traveller.id, discountPct: 5, uses: between(0, 2), maxUses: 10, active: true, referredEnquiryIds: [], createdAt: iso(reviewAt) });
          }
          if (received && rating <= 3) tasks.push({ id: id("task"), title: `Resolve ${rating}★ feedback — ${traveller.fullName}`, kind: "review", enquiryId: enquiry.id, tripId: trip.id, travellerId: traveller.id, assignedTo: "u_priya", dueAt: iso(addDays(reviewAt, 1)), status: addDays(reviewAt, 1) < daysAgo(10) ? "done" : "open", priority: "high", createdBy: "ai", createdAt: iso(reviewAt), doneAt: addDays(reviewAt, 1) < daysAgo(10) ? iso(addDays(reviewAt, 1)) : undefined });
          evt({ agent: "followup", at: iso(reviewAt), enquiryId: enquiry.id, tripId: trip.id, travellerId: traveller.id, action: "Review + referral request sent", detail: received ? `Traveller rated ${rating}★ → ${rating >= 4 ? "routed to Google/Instagram review + referral code issued" : "routed to private resolution task"}` : "Awaiting rating", confidence: 1, status: "auto" });
          messages.push({ id: id("msg"), travellerId: traveller.id, enquiryId: enquiry.id, channel: "whatsapp", direction: "outbound", body: fill("Welcome home, {first}! How was {dest}? Rate us 1–5 here and we'll send your referral code — friends get 5% off, you get ₹2,000 off your next trip.", v), at: iso(reviewAt), sentBy: "ai", status: "read", templateId: "tpl_review", ai: { intent: "post_trip_review", confidence: 1, action: "auto_sent", reason: "Return +48h review trigger" } });
          if (received) messages.push({ id: id("msg"), travellerId: traveller.id, enquiryId: enquiry.id, channel: "whatsapp", direction: "inbound", body: `${rating} ⭐ ${rating >= 4 ? "Thank you so much, it was perfect!" : "It was okay, a few hiccups."}`, at: iso(minutesAfter(reviewAt, between(30, 600))), sentBy: "traveller", status: "read" });
        }
      }

      // ----- follow-up tasks for open stages -----
      if (["contacted", "qualified", "itinerary_sent", "negotiation"].includes(stage)) {
        const due = daysAhead(between(-2, 3), between(10, 18));
        tasks.push({ id: id("task"), title: stage === "negotiation" ? `Revise ${dest.name} quote for ${traveller.fullName.split(" ")[0]}` : stage === "itinerary_sent" ? `Follow up on ${dest.name} itinerary — ${traveller.fullName.split(" ")[0]}` : `Send ${dest.name} itinerary — ${traveller.fullName.split(" ")[0]}`, kind: stage === "negotiation" ? "custom" : "follow_up", enquiryId: enquiry.id, travellerId: traveller.id, assignedTo: owner, dueAt: iso(due), status: "open", priority: due < NOW ? "high" : "normal", createdBy: stage === "qualified" ? "ai" : "system", createdAt: iso(lastStageChange) });
        if (due < NOW) enquiry.needsAttention = true;
      }
      if (stage === "new") enquiry.needsAttention = !handledByAgent;
      if (stage === "new" && chance(0.4)) {
        // Voice agent called the new lead within minutes.
        const callAt = minutesAfter(createdAt, between(2, 6));
        const answered = chance(0.7);
        const lines: TranscriptLine[] = answered
          ? [
              { speaker: "agent", text: `Hi ${v.first}, this is Aanya from wishtrip. You just asked about ${dest.name} — is now a good time for two quick questions?`, t: 0 },
              { speaker: "caller", text: pick(["Yes sure, go ahead.", "Haan bolo, quick please.", "Yeah, two minutes."]), t: 8 },
              { speaker: "agent", text: "Which month are you looking at, and how many of you are travelling?", t: 12 },
              { speaker: "caller", text: `${monthLabel} most likely, ${v.pax} of us. ${tripType === "family" ? "Two kids." : ""}`, t: 19 },
              { speaker: "agent", text: `Lovely. And a rough budget per person — around ₹${Math.round(pp / 1000)}k, or should I plan ${comfort === "premium" || comfort === "luxury" ? "more premium" : "value-first"}?`, t: 26 },
              { speaker: "caller", text: `Around ₹${Math.round(pp / 1000)}k is fine, ${pace === "slow" ? "nothing too hectic" : "we like to see a lot"}.`, t: 35 },
              { speaker: "agent", text: `Perfect — ${n} nights in ${dest.name}, ${v.pax} travellers, ${pace} pace. ${v.agent} will send a day-by-day plan on WhatsApp within a few hours. Anything else?`, t: 42 },
              { speaker: "caller", text: "No that's it, thanks!", t: 52 },
            ]
          : [{ speaker: "agent", text: `Hi, this is Aanya from wishtrip calling about your ${dest.name} enquiry. I'll message you on WhatsApp instead — reply there whenever convenient.`, t: 0 }];
        calls.push({ id: id("call"), enquiryId: enquiry.id, travellerId: traveller.id, direction: "outbound", kind: "voice_agent", handledBy: "ai", phone: traveller.phone, startedAt: iso(callAt), durationSec: answered ? between(55, 140) : 18, status: answered ? "completed" : "voicemail", language: traveller.language === "hi" || traveller.language === "hinglish" ? "hinglish" : "en", transcript: lines, summary: answered ? `Qualified: ${dest.name} in ${monthLabel}, ${v.pax} pax, ~₹${Math.round(pp / 1000)}k pp, ${pace} pace. Promised itinerary on WhatsApp.` : "No answer — left voicemail and fell back to WhatsApp.", extracted: answered ? { destination: dest.name, travelMonth: enquiry.travelMonth, nights: n, pax, budgetINR: budget, tripType, departureCity: traveller.city } : undefined, outcome: answered ? "qualified" : "voicemail", sentiment: answered ? "positive" : "neutral", qualityScore: answered ? between(78, 96) : undefined, recordingAvailable: true });
        evt({ agent: "voice", at: iso(callAt), enquiryId: enquiry.id, travellerId: traveller.id, action: answered ? "Outbound qualification call completed" : "Outbound call — voicemail", detail: answered ? `Called ${between(2, 6)} min after enquiry · ${between(55, 140)}s · captured month, pax, budget` : "No answer after 18s, WhatsApp fallback sent", confidence: answered ? 0.93 : 0.5, status: "auto" });
        if (answered) {
          enquiry.stage = "qualified";
          enquiry.handledByAgent = true;
          enquiry.needsAttention = false;
          enquiry.firstResponseMinutes = between(2, 6);
          enquiry.assignedTo = enquiry.assignedTo ?? consultantFor(destId);
          act(callAt, "ai", "Aanya (voice agent)", "call", "Outbound qualification call — moved to Qualified", { enquiryId: enquiry.id });
        }
      }

      // ----- scoring -----
      enquiry.aiScore = scoreEnquiry(enquiry, { messagesCount: messages.filter((m) => m.enquiryId === enquiry.id).length, hasItinerary: itineraries.some((x) => x.enquiryId === enquiry.id), traveller });
      if (!["completed", "lost", "non_lead"].includes(stage)) {
        evt({ agent: "scoring", at: iso(daysAgo(0, between(5, 7))), enquiryId: enquiry.id, travellerId: traveller.id, action: "Scored conversion likelihood", detail: `${enquiry.aiScore}/100 — ${enquiry.aiScore >= 70 ? "hot: concrete dates, budget fits, fast replies" : enquiry.aiScore >= 40 ? "warm: brief captured, no dates yet" : "cool: no reply in 3+ days"}`, confidence: 0.8, status: "info" });
        if (enquiry.aiScore >= 75 && !enquiry.tags.includes("hot")) enquiry.tags.push("hot");
      }
    }
  }

  // ----- inbound voice-agent calls not tied to a lead yet, and human calls -----
  const inboundNew = ["Hi, I saw your Japan post. Do you do visa also?", "Hello, booking ke baare mein poochna tha — we booked Kerala for December.", "Is Thailand visa-free right now for Indians?"];
  inboundNew.forEach((q, i) => {
    const at = daysAgo(between(0, 3), between(8, 22));
    const existing = i === 1 ? enquiries.find((e) => e.destinationId === "kerala" && e.tripId) : undefined;
    const trv = existing ? travellers.find((t) => t.id === existing.travellerId) : undefined;
    calls.push({
      id: id("call"), enquiryId: existing?.id, travellerId: trv?.id, direction: "inbound", kind: "voice_agent", handledBy: "ai", phone: trv?.phone ?? phone(), startedAt: iso(at), durationSec: between(60, 190), status: "completed", language: i === 1 ? "hinglish" : "en",
      transcript: [
        { speaker: "agent", text: "Hi, this is Aanya from wishtrip. I can help plan your trip or answer questions about an existing booking. Which one is it today?", t: 0 },
        { speaker: "caller", text: q, t: 9 },
        { speaker: "agent", text: i === 0 ? "Yes — for Japan we handle the embassy visa file end-to-end; you just send passport copies, bank statements and ITR on WhatsApp. Apply 4–6 weeks before departure. Which month were you thinking?" : i === 1 ? `Haan bilkul. Aapki ${existing?.destination ?? "Kerala"} booking ${existing ? existing.tripId ? "confirmed hai" : "" : ""} — balance ${existing ? "" : ""}aur vouchers ka status main WhatsApp pe bhej deti hoon. Kuch aur?` : "Yes — Thailand is visa-free for Indian passport holders for stays up to 60 days. Carry a return ticket and hotel booking. Want me to start a Thailand plan for you?", t: 16 },
        { speaker: "caller", text: i === 0 ? "November. Two of us." : i === 1 ? "Haan, bas voucher kab milega?" : "Yes please, for February, 4 friends.", t: 34 },
        { speaker: "agent", text: i === 0 ? "Great, November is peak autumn colour. I'll create your enquiry and a consultant will send a plan today. Could I have your name and WhatsApp number?" : i === 1 ? "Vouchers departure se 7 din pehle WhatsApp pe aa jayenge. Trip captain Meera aapko update karengi." : "Done — February, 4 friends, Thailand. I'll message you on WhatsApp with three questions and a plan follows today.", t: 44 },
      ],
      summary: i === 0 ? "New Japan enquiry (Nov, 2 pax). Visa process explained. Lead created, consultant assigned." : i === 1 ? "Existing booking query (Kerala, Dec). Explained voucher timeline (T-7). No action needed." : "New Thailand enquiry (Feb, 4 friends). Visa-free confirmed. Lead created.",
      extracted: i === 1 ? undefined : i === 0 ? { destination: "Japan", travelMonth: "2026-11", pax: { adults: 2, children: 0, infants: 0 } } : { destination: "Thailand", travelMonth: "2027-02", pax: { adults: 4, children: 0, infants: 0 }, tripType: "friends" },
      outcome: i === 1 ? "info" : "qualified", sentiment: "positive", qualityScore: between(80, 95), recordingAvailable: true,
    });
    evt({ agent: "voice", at: iso(at), enquiryId: existing?.id, travellerId: trv?.id, action: i === 1 ? "Answered booking question" : "Answered inbound enquiry → lead created", detail: i === 0 ? "Japan visa question; captured Nov · 2 pax; created enquiry" : i === 1 ? "Explained voucher timeline for existing Kerala booking" : "Thailand visa-free info; captured Feb · 4 pax; created enquiry", confidence: 0.9, status: "auto" });
  });
  // Escalated call
  {
    const e = enquiries.find((x) => x.stage === "docs_visa") ?? enquiries[0];
    const trv = travellers.find((t) => t.id === e.travellerId)!;
    const at = daysAgo(1, 19, 20);
    calls.push({ id: id("call"), enquiryId: e.id, travellerId: trv.id, direction: "inbound", kind: "voice_agent", handledBy: "ai", phone: trv.phone, startedAt: iso(at), durationSec: 74, status: "completed", language: "en", transcript: [
      { speaker: "agent", text: "Hi, this is Aanya from wishtrip. How can I help today?", t: 0 },
      { speaker: "caller", text: "I want to cancel my trip, there's a family emergency. What's the refund?", t: 6 },
      { speaker: "agent", text: "I'm really sorry to hear that. Cancellations and refunds are handled by your consultant directly so you get an exact figure — I'm connecting you now and also flagging it as urgent. They'll call within the hour if we get disconnected.", t: 15 },
      { speaker: "caller", text: "Okay, thank you.", t: 30 },
    ], summary: "Cancellation request (family emergency). Escalated to consultant per policy — no refund figure quoted.", outcome: "handoff", sentiment: "negative", qualityScore: 88, recordingAvailable: true });
    evt({ agent: "voice", at: iso(at), enquiryId: e.id, travellerId: trv.id, action: "Escalated to human (cancellation)", detail: "Caller asked to cancel — hand-off topic. Urgent callback task created for consultant.", confidence: 0.97, status: "needs_review" });
    tasks.push({ id: id("task"), title: `URGENT callback: cancellation request — ${trv.fullName}`, kind: "callback", enquiryId: e.id, tripId: e.tripId, travellerId: trv.id, assignedTo: e.assignedTo ?? "u_priya", dueAt: iso(minutesAfter(at, 60)), status: "open", priority: "high", createdBy: "ai", createdAt: iso(at) });
    e.needsAttention = true;
    e.tags.push("needs-human");
  }
  // Human calls
  for (let i = 0; i < 6; i++) {
    const e = pick(enquiries.filter((x) => ["itinerary_sent", "negotiation", "qualified"].includes(x.stage) && x.assignedTo));
    const trv = travellers.find((t) => t.id === e.travellerId)!;
    const at = daysAgo(between(0, 6), between(10, 19));
    const dur = between(120, 540);
    calls.push({ id: id("call"), enquiryId: e.id, travellerId: trv.id, direction: chance(0.6) ? "outbound" : "inbound", kind: "human", handledBy: e.assignedTo!, phone: trv.phone, startedAt: iso(at), durationSec: dur, status: "completed", language: trv.language === "hi" ? "hi" : "en", transcript: [], summary: pick([`Walked through the ${e.destination} plan; traveller wants a beachfront swap on stay 2.`, `Discussed dates — may shift by a week. Will confirm by Friday.`, `Price discussion: asked for 5% off; offered a free airport upgrade instead.`, `Confirmed pax count; adding one child. Revised quote needed.`]), outcome: pick(["callback", "qualified", "info"]), sentiment: "positive", qualityScore: between(62, 94), recordingAvailable: true });
    act(at, "user", userName(e.assignedTo!), "call", `Call with ${trv.fullName.split(" ")[0]} (${Math.round(dur / 60)} min)`, { enquiryId: e.id });
  }

  // ----- approvals & misc tasks -----
  {
    const lostCand = pick(enquiries.filter((x) => x.stage === "itinerary_sent"));
    tasks.push({ id: id("task"), title: `Approve marking ${lostCand.ref} as Lost (no response, 3 follow-ups)`, kind: "approval", enquiryId: lostCand.id, travellerId: lostCand.travellerId, assignedTo: undefined, dueAt: iso(daysAhead(1)), status: "open", priority: "normal", createdBy: "ai", createdAt: iso(daysAgo(0)), approval: { kind: "lost", payload: "Follow-up agent exhausted 3 attempts over 7 days" } });
    const disc = enquiries.find((x) => x.stage === "negotiation");
    if (disc) tasks.push({ id: id("task"), title: `Approve 5% discount on ${disc.ref} (${disc.destination})`, kind: "approval", enquiryId: disc.id, travellerId: disc.travellerId, assignedTo: "u_priya", dueAt: iso(daysAhead(0, 17)), status: "open", priority: "high", createdBy: disc.assignedTo ?? "u_rohan", createdAt: iso(daysAgo(0, 9)), approval: { kind: "discount", payload: "Traveller comparing with a competitor quote ₹4,000 lower; repeat traveller" } });
  }
  // Passport expiry tasks
  for (const t of travellers.filter((x) => x.passportExpiry && new Date(x.passportExpiry) < daysAhead(180))) {
    const e = enquiries.find((x) => x.travellerId === t.id);
    if (e && !["lost", "non_lead", "completed"].includes(e.stage)) {
      tasks.push({ id: id("task"), title: `Passport expires ${new Date(t.passportExpiry!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — ${t.fullName} (6-month rule)`, kind: "document", enquiryId: e.id, travellerId: t.id, assignedTo: "u_meera", dueAt: iso(daysAhead(2)), status: "open", priority: "high", createdBy: "ai", createdAt: iso(daysAgo(1)) });
      evt({ agent: "assignment", at: iso(daysAgo(1)), enquiryId: e.id, travellerId: t.id, action: "Flagged passport validity risk", detail: `Passport expires within 6 months of return — renewal task created for Ops`, confidence: 1, status: "info" });
    }
  }
  // Some done tasks for history
  for (let i = 0; i < 12; i++) {
    const e = pick(enquiries);
    const at = daysAgo(between(2, 20));
    tasks.push({ id: id("task"), title: pick(["Send welcome + brochure", "Confirm dates on call", "Share revised quote", "Collect passport copies", "Send payment link"]) + ` — ${travellers.find((t) => t.id === e.travellerId)!.fullName.split(" ")[0]}`, kind: pick(["follow_up", "document", "payment_reminder", "custom"] as const), enquiryId: e.id, travellerId: e.travellerId, assignedTo: e.assignedTo ?? "u_rohan", dueAt: iso(at), status: "done", priority: "normal", createdBy: "system", createdAt: iso(addDays(at, -1)), doneAt: iso(minutesAfter(at, between(10, 400))) });
  }

  // ----- campaigns -----
  const campaigns: Campaign[] = [
    { id: id("cmp"), name: "Comment PLAN → DM (all posts)", channel: "instagram", type: "comment_automation", status: "running", keyword: "PLAN", postRef: "All posts & reels", audience: { description: "Anyone commenting PLAN on any wishtrip.ai post", count: 0, tags: ["ig-plan"], stages: [], destinationIds: [] }, body: AUTO_REPLY_RULES[0].response, startedAt: iso(daysAgo(45)), stats: { sent: 412, delivered: 409, read: 371, replied: 214, leadsCreated: 186, bookings: 23 }, createdBy: "u_aarav", createdAt: iso(daysAgo(45)) },
    { id: id("cmp"), name: "Diwali long weekend — how many days off?", channel: "whatsapp", type: "broadcast", status: "completed", audience: { description: "All open enquiries + travellers with no trip in last 6 months", count: 640, tags: [], stages: ["contacted", "qualified", "itinerary_sent"], destinationIds: [] }, templateId: "tpl_diwali", body: TEMPLATES.find((t) => t.id === "tpl_diwali")!.body, scheduledAt: iso(daysAgo(9, 10)), startedAt: iso(daysAgo(9, 10)), completedAt: iso(daysAgo(9, 11)), stats: { sent: 640, delivered: 612, read: 448, replied: 97, leadsCreated: 61, bookings: 9 }, createdBy: "u_priya", createdAt: iso(daysAgo(10)) },
    { id: id("cmp"), name: "Japan autumn: Diwali → Fuji lakes", channel: "instagram", type: "story_reply", status: "running", keyword: "JAPAN", postRef: "instagram.com/p/DehMc7UNAA7", audience: { description: "Story viewers replying JAPAN", count: 0, tags: ["japan-autumn"], stages: [], destinationIds: ["japan"] }, body: "Konnichiwa 🍁 Which window works — Diwali week (Fuji lakes) or late Nov (Kyoto + Tokyo)? Reply with dates and pax and I'll build it.", startedAt: iso(daysAgo(6)), stats: { sent: 88, delivered: 88, read: 80, replied: 41, leadsCreated: 29, bookings: 2 }, createdBy: "u_sneha", createdAt: iso(daysAgo(6)) },
    { id: id("cmp"), name: "Itinerary no-reply drip (24h / 72h / 7d)", channel: "whatsapp", type: "drip", status: "running", audience: { description: "Enquiries in Itinerary Sent with no reply", count: 23, tags: [], stages: ["itinerary_sent"], destinationIds: [] }, body: TEMPLATES.find((t) => t.id === "tpl_followup_24h")!.body, startedAt: iso(daysAgo(60)), stats: { sent: 1180, delivered: 1151, read: 902, replied: 318, leadsCreated: 0, bookings: 47 }, createdBy: "u_aarav", createdAt: iso(daysAgo(60)) },
    { id: id("cmp"), name: "Dec school holidays — Kerala & Andaman for families", channel: "whatsapp", type: "broadcast", status: "scheduled", audience: { description: "Travellers tagged family/parents, no trip booked for Dec", count: 212, tags: ["parents"], stages: [], destinationIds: ["kerala", "andaman"] }, body: "Hi {{first_name}}, December school holidays are 6 weeks away 🎒 Kerala backwaters (5 days from ₹44,500) or Andaman beaches (6 days from ₹52,000) — both easy with kids. Reply KERALA or ANDAMAN and we'll build it for your dates.", scheduledAt: iso(daysAhead(3, 10)), stats: { sent: 0, delivered: 0, read: 0, replied: 0, leadsCreated: 0, bookings: 0 }, createdBy: "u_priya", createdAt: iso(daysAgo(1)) },
    { id: id("cmp"), name: "Anniversary nudges (honeymooners → anniversary trip)", channel: "whatsapp", type: "drip", status: "paused", audience: { description: "Past honeymoon travellers, 11 months after trip", count: 14, tags: ["honeymoon"], stages: ["completed"], destinationIds: [] }, body: "Hi {{first_name}}, one year since {{destination}} 💛 Shall we plan the anniversary edition? Reply with a month and we'll surprise you with options.", stats: { sent: 14, delivered: 14, read: 12, replied: 5, leadsCreated: 4, bookings: 1 }, createdBy: "u_karan", createdAt: iso(daysAgo(30)) },
  ];

  // ----- some extra agent events for the feed -----
  for (let i = 0; i < 6; i++) {
    const e = pick(enquiries.filter((x) => x.assignedTo));
    evt({ agent: "assignment", at: iso(daysAgo(between(0, 5), between(8, 21))), enquiryId: e.id, travellerId: e.travellerId, action: "Auto-assigned consultant", detail: `${e.destination} enquiry → ${userName(e.assignedTo!)} (destination specialist, ${between(3, 9)} open leads)`, confidence: 1, status: "auto" });
  }

  // Sort everything newest-first where it matters.
  messages.sort((a, b) => a.at.localeCompare(b.at));
  activities.sort((a, b) => b.at.localeCompare(a.at));
  agentEvents.sort((a, b) => b.at.localeCompare(a.at));
  calls.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return {
    version: 1,
    seededAt: iso(NOW),
    users: DEMO_USERS,
    destinations: DESTINATIONS,
    packages: PACKAGES,
    travellers,
    enquiries,
    itineraries,
    trips,
    payments,
    suppliers: SUPPLIERS,
    documents,
    messages,
    calls,
    tasks,
    campaigns,
    templates: TEMPLATES,
    autoReplyRules: AUTO_REPLY_RULES,
    agentEvents,
    reviews,
    referrals,
    activities,
    tags: TAGS,
    settings: SETTINGS,
  };
}
