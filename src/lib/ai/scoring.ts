import type { Enquiry, Traveller } from "@/lib/demo/types";

/**
 * Lead scoring — rule-based stand-in for the scoring agent. Produces a
 * 0–100 conversion likelihood plus the reasons, so the UI can explain it.
 */
export interface ScoreContext {
  messagesCount: number;
  hasItinerary: boolean;
  traveller?: Traveller;
  now?: Date;
}

export function explainScore(e: Enquiry, ctx: ScoreContext): { score: number; reasons: { label: string; delta: number }[] } {
  const now = ctx.now ?? new Date();
  const reasons: { label: string; delta: number }[] = [];
  let score = 35;
  const add = (label: string, delta: number) => {
    reasons.push({ label, delta });
    score += delta;
  };
  if (e.travelStart) add("Concrete travel dates", 15);
  else if (e.travelMonth) add("Month known, dates flexible", 6);
  if (e.budgetINR > 0) add("Budget stated", 8);
  const days = (now.getTime() - new Date(e.lastInboundAt ?? e.createdAt).getTime()) / 86400000;
  if (days < 1) add("Replied in the last 24h", 12);
  else if (days < 3) add("Active in last 3 days", 5);
  else if (days > 7) add("No reply for 7+ days", -18);
  if (ctx.hasItinerary) add("Itinerary sent", 8);
  if (ctx.messagesCount >= 5) add("Engaged conversation (5+ messages)", 7);
  if (e.source === "referral" || e.source === "repeat") add("Referral / repeat traveller", 12);
  if (e.source === "instagram_comment") add("Comment-to-DM lead (lower intent)", -5);
  if (e.source === "website_planner") add("Built a plan on the website", 6);
  if (e.firstResponseMinutes != null && e.firstResponseMinutes <= 10) add("First response under 10 min", 5);
  if (ctx.traveller?.tripsCount) add("Has travelled with us before", 10);
  if (e.tripType === "honeymoon") add("Honeymoon — date-bound intent", 4);
  if (e.flexibility === "flexible_month" && !e.travelStart) add("Fully flexible — lower urgency", -4);
  if (["advance_paid", "docs_visa", "ready", "travelling", "completed"].includes(e.stage)) score = 100;
  if (e.stage === "lost" || e.stage === "non_lead") score = Math.min(score, 12);
  if (e.stage === "negotiation") add("In negotiation", 6);
  score = Math.max(3, Math.min(99, Math.round(score)));
  return { score, reasons };
}

export function scoreEnquiry(e: Enquiry, ctx: ScoreContext): number {
  return explainScore(e, ctx).score;
}
