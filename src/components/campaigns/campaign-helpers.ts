import type { Campaign, DemoData, EnquiryStage } from "@/lib/demo/types";

export const CAMPAIGN_TYPE_LABEL: Record<Campaign["type"], string> = {
  broadcast: "WhatsApp broadcast",
  comment_automation: "Comment automation",
  drip: "Drip sequence",
  story_reply: "Story reply automation",
};

export const CAMPAIGN_STATUS_CLASS: Record<Campaign["status"], string> = {
  running: "bg-emerald-100 text-emerald-800",
  scheduled: "bg-amber-100 text-amber-800",
  completed: "bg-zinc-100 text-zinc-700",
  paused: "bg-sand-200 text-ink-600",
  draft: "bg-sky-100 text-sky-800",
};

export const CAMPAIGN_STATUS_LABEL: Record<Campaign["status"], string> = {
  running: "Running",
  scheduled: "Scheduled",
  completed: "Completed",
  paused: "Paused",
  draft: "Draft",
};

export interface AudienceSpec {
  tags: string[];
  stages: EnquiryStage[];
  destinationIds: string[];
}

/** Count distinct travellers matching the audience builder — live from the db. */
export function audienceCount(db: DemoData, a: AudienceSpec): number {
  const hasFilter = a.tags.length + a.stages.length + a.destinationIds.length > 0;
  if (!hasFilter) return db.travellers.filter((t) => !t.blocked).length;
  const travellerIds = new Set<string>();
  for (const e of db.enquiries) {
    const t = db.travellers.find((x) => x.id === e.travellerId);
    if (!t || t.blocked) continue;
    if (a.stages.length && !a.stages.includes(e.stage)) continue;
    if (a.destinationIds.length && !a.destinationIds.includes(e.destinationId)) continue;
    if (a.tags.length) {
      const all = new Set([...e.tags, ...t.tags]);
      if (!a.tags.some((tag) => all.has(tag))) continue;
    }
    travellerIds.add(t.id);
  }
  // Tag-only audiences also include travellers without an enquiry match.
  if (a.tags.length && !a.stages.length && !a.destinationIds.length) {
    for (const t of db.travellers) if (!t.blocked && a.tags.some((tag) => t.tags.includes(tag))) travellerIds.add(t.id);
  }
  return travellerIds.size;
}

export function describeAudience(db: DemoData, a: AudienceSpec): string {
  const parts: string[] = [];
  if (a.stages.length) parts.push(`in ${a.stages.map((s) => s.replace("_", " ")).join(" / ")}`);
  if (a.destinationIds.length) parts.push(`interested in ${a.destinationIds.map((d) => db.destinations.find((x) => x.id === d)?.name ?? d).join(", ")}`);
  if (a.tags.length) parts.push(`tagged ${a.tags.join(", ")}`);
  return parts.length ? `Travellers ${parts.join(", ")}` : "All travellers";
}

/** Simulated delivery funnel for a broadcast that just went out. */
export function simulateSend(count: number): Campaign["stats"] {
  const sent = Math.max(0, count);
  return {
    sent,
    delivered: Math.round(sent * 0.95),
    read: Math.round(sent * 0.7),
    replied: Math.round(sent * 0.12),
    leadsCreated: Math.round(sent * 0.07),
    bookings: Math.round(sent * 0.01),
  };
}

export const SAMPLE_VARS: Record<string, string> = {
  first_name: "Ananya",
  destination: "Bali",
  agent_name: "Rohan",
  month: "December",
};

export function fillSample(body: string): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => SAMPLE_VARS[k] ?? `{{${k}}}`);
}
