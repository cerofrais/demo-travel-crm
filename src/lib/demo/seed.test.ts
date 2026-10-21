import { describe, expect, it } from "vitest";
import { generateSeed } from "./seed";
import { STAGE_IDS } from "@/lib/pipeline";

describe("generateSeed", () => {
  const db = generateSeed();

  it("produces a populated, internally consistent dataset", () => {
    expect(db.enquiries.length).toBeGreaterThan(50);
    expect(db.travellers.length).toBe(db.enquiries.length);
    expect(db.trips.length).toBeGreaterThan(15);
    expect(db.itineraries.length).toBeGreaterThan(25);
    expect(db.payments.length).toBe(db.trips.length * 3);
    expect(db.messages.length).toBeGreaterThan(150);
    expect(db.calls.length).toBeGreaterThan(8);
    expect(db.tasks.length).toBeGreaterThan(25);
    expect(db.agentEvents.length).toBeGreaterThan(60);
    expect(db.campaigns.length).toBe(6);
  });

  it("keeps every foreign key resolvable", () => {
    const travellerIds = new Set(db.travellers.map((t) => t.id));
    const enquiryIds = new Set(db.enquiries.map((e) => e.id));
    const tripIds = new Set(db.trips.map((t) => t.id));
    for (const e of db.enquiries) {
      expect(travellerIds.has(e.travellerId)).toBe(true);
      expect(STAGE_IDS).toContain(e.stage);
      if (e.tripId) expect(tripIds.has(e.tripId)).toBe(true);
      expect(e.aiScore).not.toBeNull();
    }
    for (const t of db.trips) {
      expect(enquiryIds.has(t.enquiryId)).toBe(true);
      expect(db.itineraries.some((i) => i.id === t.itineraryId)).toBe(true);
      expect(t.paidINR).toBeLessThanOrEqual(t.totalINR);
    }
    for (const m of db.messages) expect(travellerIds.has(m.travellerId)).toBe(true);
    for (const p of db.payments) expect(tripIds.has(p.tripId)).toBe(true);
  });

  it("has every won enquiry linked to a trip and every stage represented", () => {
    const won = db.enquiries.filter((e) => ["advance_paid", "docs_visa", "ready", "travelling", "completed"].includes(e.stage));
    expect(won.every((e) => e.tripId)).toBe(true);
    for (const s of STAGE_IDS) expect(db.enquiries.some((e) => e.stage === s)).toBe(true);
  });

  it("has agent drafts that need review and overdue payments", () => {
    expect(db.messages.some((m) => m.status === "draft")).toBe(true);
    expect(db.agentEvents.some((e) => e.status === "needs_review")).toBe(true);
    expect(db.payments.some((p) => p.status === "overdue")).toBe(true);
  });
});
