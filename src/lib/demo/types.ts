/**
 * wishtrip Travel CRM — demo data model.
 *
 * Everything the app shows lives in one `DemoData` document persisted to the
 * browser's localStorage (see store.ts). The shape mirrors what a Postgres /
 * Prisma schema would hold in production (docs/03-data-model.md), so swapping
 * the store for real API routes is a mechanical change.
 */
import type { AppRole } from "@/lib/rbac";

// ---------- Enums ----------

export type EnquiryStage =
  | "new"
  | "contacted"
  | "qualified"
  | "itinerary_sent"
  | "negotiation"
  | "advance_paid"
  | "docs_visa"
  | "ready"
  | "travelling"
  | "completed"
  | "lost"
  | "non_lead";

export type LeadSource =
  | "instagram_comment"
  | "instagram_dm"
  | "website_planner"
  | "whatsapp"
  | "meta_lead_form"
  | "google"
  | "referral"
  | "email"
  | "phone"
  | "repeat";

export type TripType = "couple" | "honeymoon" | "family" | "friends" | "solo" | "parents" | "corporate";
export type Pace = "slow" | "balanced" | "packed";
export type Comfort = "budget" | "comfort" | "premium" | "luxury";
export type FoodPref = "veg" | "non_veg" | "jain" | "vegan" | "halal" | "no_preference";
export type Flexibility = "fixed" | "plus_minus_3" | "flexible_month";
export type Channel = "whatsapp" | "instagram" | "email" | "sms" | "phone";
export type Language = "en" | "hi" | "hinglish" | "te" | "ta" | "mr" | "gu";

export type TripStatus = "confirmed" | "docs_pending" | "ready" | "on_trip" | "completed" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "overdue" | "refunded" | "failed";
export type PaymentMode = "upi" | "razorpay_link" | "bank_transfer" | "card" | "cash";
export type ItineraryStatus = "draft" | "sent" | "viewed" | "accepted" | "revised" | "rejected";
export type SupplierType = "hotel" | "dmc" | "transport" | "activity" | "airline" | "visa" | "insurance";
export type DocumentCategory =
  | "passport"
  | "photo"
  | "visa"
  | "ticket"
  | "voucher"
  | "insurance"
  | "invoice"
  | "receipt"
  | "itinerary"
  | "other";
export type VisaType = "none" | "visa_free" | "voa" | "evisa" | "embassy";

export type TaskKind =
  | "follow_up"
  | "callback"
  | "payment_reminder"
  | "document"
  | "visa"
  | "pre_departure"
  | "mid_trip"
  | "post_trip"
  | "review"
  | "approval"
  | "custom";
export type TaskStatus = "open" | "done" | "snoozed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";

export type AgentKind = "voice" | "autoreply" | "scoring" | "itinerary" | "followup" | "assignment";
export type AgentEventStatus = "auto" | "needs_review" | "approved" | "rejected" | "info";

export type CallOutcome = "qualified" | "callback" | "not_interested" | "booked" | "handoff" | "info" | "voicemail" | "no_answer";
export type CallStatus = "completed" | "missed" | "voicemail" | "no_answer" | "in_progress";

// ---------- Core records ----------

export interface Pax {
  adults: number;
  children: number;
  infants: number;
}

export interface User {
  sub: string;
  name: string;
  email: string;
  role: AppRole;
  phone?: string;
  title: string;
  /** Destinations this consultant specialises in (destination ids). */
  specialities: string[];
  languages: Language[];
  online: boolean;
  active: boolean;
  createdAt: string;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  region: "domestic" | "international";
  emoji: string;
  tagline: string;
  fromPriceINR: number;
  bestMonths: number[]; // 1-12
  visa: { type: VisaType; processingDays: number; note: string };
  currency: string;
  flightHours: number;
  coverImage?: string;
}

export interface Traveller {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  city: string;
  instagramHandle?: string;
  preferredChannel: Channel;
  language: Language;
  dob?: string;
  gender?: "female" | "male" | "other";
  nationality: string;
  passportNo?: string;
  passportExpiry?: string;
  anniversary?: string;
  foodPref: FoodPref;
  pace: Pace;
  comfort: Comfort;
  interests: string[];
  tags: string[];
  notes?: string;
  blocked: boolean;
  referralCode?: string;
  referredById?: string;
  tripsCount: number;
  lifetimeValueINR: number;
  lastTripAt?: string;
  createdAt: string;
}

export interface Enquiry {
  id: string;
  ref: string; // WT-1042
  travellerId: string;
  stage: EnquiryStage;
  source: LeadSource;
  campaign?: string;
  /** The Instagram post / reel the traveller reacted to, if any. */
  reelRef?: string;
  destinationId: string;
  destination: string;
  altDestinations: string[];
  travelStart?: string;
  travelEnd?: string;
  travelMonth?: string; // "2026-12"
  nights: number;
  flexibility: Flexibility;
  pax: Pax;
  rooms: number;
  tripType: TripType;
  pace: Pace;
  comfort: Comfort;
  foodPref: FoodPref;
  budgetINR: number; // total
  includeFlights: boolean;
  departureCity: string;
  interests: string[];
  notes?: string;
  assignedTo?: string; // user sub
  tags: string[];
  aiScore: number | null;
  aiSummary?: string;
  aiNextAction?: string;
  needsAttention: boolean;
  handledByAgent: boolean;
  lostReason?: string;
  whatsappWindowExpiresAt?: string;
  firstResponseMinutes?: number;
  tripId?: string;
  /** Enquiries that belong to the same travel party (family / friends each
   *  messaging separately) share a link group. */
  linkGroupId?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  lastInboundAt?: string;
  lastStageChangeAt: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  location: string;
  summary: string;
  activities: string[];
  meals: { b: boolean; l: boolean; d: boolean };
  stay?: string;
  transfer?: string;
}

export interface Stay {
  id: string;
  name: string;
  location: string;
  category: string; // "4★", "Homestay", "Villa"
  checkIn: string;
  checkOut: string;
  roomType: string;
  supplierId?: string;
  confirmationNo?: string;
}

export interface Flight {
  id: string;
  airline: string;
  flightNo: string;
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
  pnr?: string;
  baggage: string;
}

export interface PriceLine {
  label: string;
  amountINR: number;
}

export interface Itinerary {
  id: string;
  enquiryId: string;
  version: number;
  title: string;
  destinationId: string;
  nights: number;
  startDate?: string;
  pax: Pax;
  pace: Pace;
  comfort: Comfort;
  days: ItineraryDay[];
  stays: Stay[];
  flights: Flight[];
  inclusions: string[];
  exclusions: string[];
  pricing: {
    perPersonINR: number;
    totalINR: number;
    breakdown: PriceLine[];
    marginINR: number;
    gstINR: number;
  };
  status: ItineraryStatus;
  generatedByAI: boolean;
  basedOnPackageId?: string;
  shareSlug: string;
  createdBy: string;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  changeNote?: string;
}

export interface PackageTemplate {
  id: string;
  code: string;
  title: string;
  destinationId: string;
  nights: number;
  tripTypes: TripType[];
  pace: Pace;
  comfort: Comfort;
  fromPriceINR: number; // per person
  highlights: string[];
  days: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  bestMonths: number[];
  tags: string[];
  active: boolean;
  sourceReel?: string;
  timesSold: number;
  createdAt: string;
}

export interface ChecklistItem {
  key: string;
  label: string;
  /** Days relative to trip start (negative = before). */
  offsetDays: number;
  done: boolean;
  doneAt?: string;
  auto: boolean;
}

export interface Trip {
  id: string;
  ref: string; // WTB-2026-031
  enquiryId: string;
  travellerId: string;
  travellerIds: string[];
  itineraryId: string;
  destinationId: string;
  destination: string;
  title: string;
  startDate: string;
  endDate: string;
  pax: Pax;
  status: TripStatus;
  totalINR: number;
  paidINR: number;
  marginINR: number;
  checklist: ChecklistItem[];
  tripCaptain?: string; // user sub
  specialRequests?: string;
  cancellationPolicy: string;
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string;
  refundINR?: number;
}

export interface Payment {
  id: string;
  tripId: string;
  travellerId: string;
  label: string;
  amountINR: number;
  dueAt: string;
  status: PaymentStatus;
  paidAt?: string;
  mode?: PaymentMode;
  reference?: string;
  linkUrl?: string;
  invoiceNo?: string;
  receiptNo?: string;
  reminderCount: number;
  lastReminderAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  type: SupplierType;
  destinationId?: string;
  city: string;
  contactName: string;
  phone: string;
  email: string;
  rating: number; // 1-5
  paymentTerms: string;
  ratesNote: string;
  payableINR: number;
  bookingsCount: number;
  tags: string[];
  notes?: string;
  active: boolean;
}

export interface Document {
  id: string;
  travellerId?: string;
  tripId?: string;
  enquiryId?: string;
  category: DocumentCategory;
  name: string;
  fileName: string;
  sizeKB: number;
  uploadedAt: string;
  uploadedBy: string;
  verified: boolean;
  expiresAt?: string;
}

export interface AiMessageMeta {
  intent: string;
  confidence: number; // 0-1
  action: "auto_sent" | "drafted" | "escalated";
  reason: string;
}

export interface Message {
  id: string;
  travellerId: string;
  enquiryId?: string;
  channel: Channel;
  direction: "inbound" | "outbound";
  body: string;
  at: string;
  /** "traveller" | "ai" | "system" | user sub */
  sentBy: string;
  status: "sent" | "delivered" | "read" | "failed" | "draft";
  attachmentName?: string;
  templateId?: string;
  ai?: AiMessageMeta;
}

export interface TranscriptLine {
  speaker: "agent" | "caller";
  text: string;
  t: number; // seconds offset
}

export interface CallAnalysis {
  score: number; // 0-100 call quality
  summary: string;
  tags: string[];
  coaching: { opening: string; explanation: string; professionalism: string; nextSteps: string };
  analysedAt: string;
}

export interface Call {
  id: string;
  enquiryId?: string;
  travellerId?: string;
  direction: "inbound" | "outbound";
  kind: "voice_agent" | "human";
  handledBy: string; // "ai" | user sub
  phone: string;
  startedAt: string;
  durationSec: number;
  status: CallStatus;
  language: Language;
  transcript: TranscriptLine[];
  /** English rendering of a Hindi / Hinglish transcript, line for line. */
  translation?: TranscriptLine[];
  transcribedAt?: string;
  analysis?: CallAnalysis;
  summary?: string;
  extracted?: Partial<{
    destination: string;
    travelMonth: string;
    nights: number;
    pax: Pax;
    budgetINR: number;
    tripType: TripType;
    departureCity: string;
  }>;
  outcome?: CallOutcome;
  sentiment?: "positive" | "neutral" | "negative";
  qualityScore?: number;
  recordingAvailable: boolean;
}

export interface Task {
  id: string;
  title: string;
  kind: TaskKind;
  enquiryId?: string;
  tripId?: string;
  travellerId?: string;
  assignedTo?: string;
  dueAt: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: string; // "system" | "ai" | user sub
  createdAt: string;
  doneAt?: string;
  notes?: string;
  /** For approval tasks: what is being approved and by whom. */
  approval?: { kind: "lost" | "refund" | "discount" | "ai_draft"; payload: string; decidedBy?: string; decision?: "approved" | "denied" };
}

export interface Campaign {
  id: string;
  name: string;
  channel: Channel;
  type: "broadcast" | "comment_automation" | "drip" | "story_reply";
  status: "draft" | "scheduled" | "running" | "completed" | "paused";
  keyword?: string;
  postRef?: string;
  audience: { description: string; count: number; tags: string[]; stages: EnquiryStage[]; destinationIds: string[] };
  templateId?: string;
  body: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  stats: { sent: number; delivered: number; read: number; replied: number; leadsCreated: number; bookings: number };
  createdBy: string;
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: Channel;
  folder: string;
  category: "marketing" | "utility" | "service";
  language: Language;
  body: string;
  variables: string[];
  approved: boolean;
  usageCount: number;
  archived: boolean;
  updatedAt: string;
}

export interface AutoReplyRule {
  id: string;
  name: string;
  channels: Channel[];
  trigger: "keyword" | "intent" | "out_of_hours" | "new_enquiry" | "no_reply";
  keywords: string[];
  intent?: string;
  response: string;
  mode: "auto" | "draft" | "off";
  tagOnMatch?: string;
  hits: number;
  active: boolean;
  updatedAt: string;
}

export interface AgentEvent {
  id: string;
  agent: AgentKind;
  at: string;
  enquiryId?: string;
  travellerId?: string;
  tripId?: string;
  action: string;
  detail: string;
  confidence?: number;
  status: AgentEventStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  payload?: Record<string, unknown>;
  /** Audit trail of the inference behind this event (AI Audit page). */
  model?: string;
  latencyMs?: number;
  tokens?: { in: number; out: number };
  prompt?: { system: string; user: string };
  output?: string;
  outcome?: "success" | "failed" | "skipped";
}

export interface Review {
  id: string;
  tripId: string;
  travellerId: string;
  rating: number;
  text?: string;
  platform: "google" | "instagram" | "internal";
  status: "requested" | "received" | "published" | "resolution";
  at: string;
  responseText?: string;
}

export interface Referral {
  id: string;
  code: string;
  travellerId: string;
  discountPct: number;
  uses: number;
  maxUses: number;
  active: boolean;
  referredEnquiryIds: string[];
  createdAt: string;
}

export interface Activity {
  id: string;
  at: string;
  actor: string; // display name
  /** User sub when actorKind is "user" — drives the team activity monitor. */
  actorSub?: string;
  actorKind: "user" | "ai" | "system" | "traveller";
  type: string;
  enquiryId?: string;
  tripId?: string;
  travellerId?: string;
  text: string;
}

/** One question asked of the data on the Ask page, with its answer. */
export interface AskEntry {
  id: string;
  at: string;
  by: string; // user sub
  question: string;
  answer: {
    mode: "table" | "narrative" | "choose" | "unknown";
    text: string;
    columns?: string[];
    rows?: Record<string, string | number | null>[];
    chart?: { label: string; value: number }[];
    /** The equivalent query over the data model, shown for transparency. */
    query: string;
    entityId?: string;
    entityKind?: "enquiry" | "traveller" | "trip";
    durationMs: number;
  };
  saved: boolean;
}

/** A shareable link in the library (review page, visa checklist, brochure…). */
export interface ResourceLink {
  id: string;
  name: string;
  url: string;
  description?: string;
  folder: string;
  usageCount: number;
  archived: boolean;
  createdAt: string;
}

export interface Tag {
  name: string;
  category: "intent" | "destination" | "stage" | "campaign" | "ops" | "custom";
  color: string;
}

export interface VoiceAgentConfig {
  enabled: boolean;
  name: string;
  voice: string;
  languages: Language[];
  greeting: string;
  hours: { start: string; end: string; days: number[] };
  afterHoursMode: "answer" | "voicemail" | "whatsapp_fallback";
  maxCallMinutes: number;
  escalateOn: string[];
  outboundEnabled: boolean;
  callNewLeadsWithinMin: number;
  phoneNumber: string;
  tone: string;
}

export interface AutoReplyAgentConfig {
  enabled: boolean;
  channels: Channel[];
  mode: "auto" | "draft" | "hybrid";
  confidenceThreshold: number; // 0-1
  handoffTopics: string[];
  tone: string;
  maxAutoRepliesPerThread: number;
  quietHours: { start: string; end: string } | null;
  signature: string;
  allowItineraryDraft: boolean;
  allowPaymentLinks: boolean;
  persona: string;
}

export interface Settings {
  company: {
    name: string;
    legalName: string;
    supportEmail: string;
    phone: string;
    instagram: string;
    website: string;
    gstin: string;
    address: string;
  };
  businessHours: { start: string; end: string; timezone: string };
  assignment: { strategy: "round_robin" | "destination" | "least_busy" | "manual"; autoAssign: boolean };
  payment: {
    tokenPct: number;
    schedule: { label: string; pct: number; offsetDays: number }[];
    gstPct: number;
    cancellationSlabs: { minDaysBefore: number; feePct: number }[];
  };
  sla: { firstResponseMin: number; itineraryHours: number; followUpCadenceDays: number[] };
  /** stage → roles allowed to see the enquiries in that column. A stage
   *  missing from the map is visible to everyone; ADMIN always sees all. */
  stageVisibility: Partial<Record<EnquiryStage, AppRole[]>>;
  agents: {
    voice: VoiceAgentConfig;
    autoReply: AutoReplyAgentConfig;
    scoring: { enabled: boolean };
    itinerary: { enabled: boolean; requireReview: boolean };
    followUp: { enabled: boolean; maxAttempts: number };
  };
}

export interface DemoData {
  version: number;
  seededAt: string;
  users: User[];
  destinations: Destination[];
  packages: PackageTemplate[];
  travellers: Traveller[];
  enquiries: Enquiry[];
  itineraries: Itinerary[];
  trips: Trip[];
  payments: Payment[];
  suppliers: Supplier[];
  documents: Document[];
  messages: Message[];
  calls: Call[];
  tasks: Task[];
  campaigns: Campaign[];
  templates: MessageTemplate[];
  autoReplyRules: AutoReplyRule[];
  agentEvents: AgentEvent[];
  reviews: Review[];
  referrals: Referral[];
  activities: Activity[];
  resourceLinks: ResourceLink[];
  askHistory: AskEntry[];
  tags: Tag[];
  settings: Settings;
}
