import type { EnquiryStage, LeadSource, TripType, Pace, Comfort, FoodPref, Flexibility, Channel, TaskKind, TripStatus, PaymentStatus, SupplierType, DocumentCategory } from "@/lib/demo/types";

export interface StageDef {
  id: EnquiryStage;
  label: string;
  description: string;
  accent: string;
  badge: string;
  /** Shown on the kanban board by default. */
  board: boolean;
  /** Counts as "won". */
  won?: boolean;
  closed?: boolean;
}

export const STAGES: StageDef[] = [
  { id: "new", label: "New Enquiry", description: "Just arrived — awaiting first response", accent: "bg-brand-300", badge: "bg-brand-100 text-brand-800", board: true },
  { id: "contacted", label: "Contacted", description: "First reply sent (agent or consultant)", accent: "bg-brand-400", badge: "bg-brand-100 text-brand-800", board: true },
  { id: "qualified", label: "Qualified", description: "Dates, pax, budget and destination captured", accent: "bg-brand-500", badge: "bg-brand-100 text-brand-800", board: true },
  { id: "itinerary_sent", label: "Itinerary Sent", description: "Day-by-day plan + price shared", accent: "bg-saffron-400", badge: "bg-saffron-100 text-saffron-700", board: true },
  { id: "negotiation", label: "Revision / Negotiation", description: "Traveller asked for changes or a better price", accent: "bg-amber-500", badge: "bg-amber-100 text-amber-800", board: true },
  { id: "advance_paid", label: "Advance Paid", description: "Token received — booking confirmed", accent: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800", board: true, won: true },
  { id: "docs_visa", label: "Docs & Visa", description: "Passports, visa, vouchers in progress", accent: "bg-indigo-400", badge: "bg-indigo-100 text-indigo-800", board: true, won: true },
  { id: "ready", label: "Ready to Travel", description: "Balance paid, vouchers issued", accent: "bg-cyan-500", badge: "bg-cyan-100 text-cyan-800", board: true, won: true },
  { id: "travelling", label: "Travelling", description: "On the trip right now", accent: "bg-brand-600", badge: "bg-brand-200 text-brand-900", board: true, won: true },
  { id: "completed", label: "Completed", description: "Back home — review & referral loop", accent: "bg-brand-800", badge: "bg-brand-800 text-white", board: true, won: true, closed: true },
  { id: "lost", label: "Lost", description: "Not travelling with us this time", accent: "bg-rose-400", badge: "bg-rose-100 text-rose-700", board: true, closed: true },
  { id: "non_lead", label: "Non-lead", description: "Spam, vendors, wrong number", accent: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-700", board: false, closed: true },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<EnquiryStage, StageDef>;
export const STAGE_IDS = STAGES.map((s) => s.id);
export const WON_STAGES = STAGES.filter((s) => s.won).map((s) => s.id);
export const OPEN_STAGES = STAGES.filter((s) => !s.closed && !s.won).map((s) => s.id);
export const stageLabel = (s: EnquiryStage) => STAGE_MAP[s]?.label ?? s;
export const stageIndex = (s: EnquiryStage) => STAGE_IDS.indexOf(s);

export const SOURCE_LABEL: Record<LeadSource, string> = {
  instagram_comment: "Instagram · comment PLAN",
  instagram_dm: "Instagram DM",
  website_planner: "Website planner",
  whatsapp: "WhatsApp",
  meta_lead_form: "Meta lead form",
  google: "Google",
  referral: "Referral",
  email: "Email",
  phone: "Phone call",
  repeat: "Repeat traveller",
};

export const SOURCE_SHORT: Record<LeadSource, string> = {
  instagram_comment: "IG PLAN",
  instagram_dm: "IG DM",
  website_planner: "Web",
  whatsapp: "WhatsApp",
  meta_lead_form: "Lead form",
  google: "Google",
  referral: "Referral",
  email: "Email",
  phone: "Call",
  repeat: "Repeat",
};

export const SOURCE_CLASS: Record<LeadSource, string> = {
  instagram_comment: "bg-pink-100 text-pink-700",
  instagram_dm: "bg-fuchsia-100 text-fuchsia-700",
  website_planner: "bg-brand-100 text-brand-700",
  whatsapp: "bg-green-100 text-green-700",
  meta_lead_form: "bg-blue-100 text-blue-700",
  google: "bg-sky-100 text-sky-700",
  referral: "bg-saffron-100 text-saffron-700",
  email: "bg-slate-100 text-slate-700",
  phone: "bg-violet-100 text-violet-700",
  repeat: "bg-emerald-100 text-emerald-700",
};

export const TRIP_TYPE_LABEL: Record<TripType, string> = {
  couple: "Couple",
  honeymoon: "Honeymoon",
  family: "Family",
  friends: "Friends",
  solo: "Solo",
  parents: "With parents",
  corporate: "Corporate",
};

export const PACE_LABEL: Record<Pace, string> = { slow: "Slow", balanced: "Balanced", packed: "Packed" };
export const COMFORT_LABEL: Record<Comfort, string> = { budget: "Budget", comfort: "Comfort", premium: "Premium", luxury: "Luxury" };
export const FOOD_LABEL: Record<FoodPref, string> = {
  veg: "Vegetarian",
  non_veg: "Non-veg",
  jain: "Jain",
  vegan: "Vegan",
  halal: "Halal",
  no_preference: "No preference",
};
export const FLEX_LABEL: Record<Flexibility, string> = { fixed: "Fixed dates", plus_minus_3: "± 3 days", flexible_month: "Flexible in month" };

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "Email",
  sms: "SMS",
  phone: "Phone",
};

export const CHANNEL_CLASS: Record<Channel, string> = {
  whatsapp: "bg-green-100 text-green-700",
  instagram: "bg-pink-100 text-pink-700",
  email: "bg-slate-100 text-slate-700",
  sms: "bg-violet-100 text-violet-700",
  phone: "bg-sky-100 text-sky-700",
};

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  follow_up: "Follow-up",
  callback: "Call back",
  payment_reminder: "Payment reminder",
  document: "Collect document",
  visa: "Visa",
  pre_departure: "Pre-departure",
  mid_trip: "Mid-trip check-in",
  post_trip: "Post-trip",
  review: "Review request",
  approval: "Approval",
  custom: "Custom",
};

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  confirmed: "Confirmed",
  docs_pending: "Docs pending",
  ready: "Ready to travel",
  on_trip: "On trip",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const TRIP_STATUS_CLASS: Record<TripStatus, string> = {
  confirmed: "bg-emerald-100 text-emerald-800",
  docs_pending: "bg-indigo-100 text-indigo-800",
  ready: "bg-cyan-100 text-cyan-800",
  on_trip: "bg-brand-100 text-brand-800",
  completed: "bg-zinc-100 text-zinc-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  overdue: "bg-rose-100 text-rose-700",
  refunded: "bg-zinc-100 text-zinc-700",
  failed: "bg-rose-100 text-rose-700",
};

export const SUPPLIER_TYPE_LABEL: Record<SupplierType, string> = {
  hotel: "Hotel / Stay",
  dmc: "DMC / Ground handler",
  transport: "Transport",
  activity: "Activity / Experience",
  airline: "Airline / Consolidator",
  visa: "Visa agent",
  insurance: "Insurance",
};

export const DOC_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  passport: "Passport",
  photo: "Photo",
  visa: "Visa",
  ticket: "Air ticket",
  voucher: "Voucher",
  insurance: "Insurance",
  invoice: "Invoice",
  receipt: "Receipt",
  itinerary: "Itinerary",
  other: "Other",
};

export const INTERESTS = [
  "beaches",
  "mountains",
  "food",
  "nightlife",
  "culture",
  "wildlife",
  "adventure",
  "wellness",
  "shopping",
  "photography",
  "islands",
  "road trip",
  "temples",
  "cafes",
  "autumn colours",
  "snow",
];

export const TAG_CLASS: Record<string, string> = {
  intent: "bg-brand-100 text-brand-700",
  destination: "bg-sky-100 text-sky-700",
  stage: "bg-amber-100 text-amber-700",
  campaign: "bg-pink-100 text-pink-700",
  ops: "bg-indigo-100 text-indigo-700",
  custom: "bg-zinc-100 text-zinc-700",
};
