import { describe, expect, it } from "vitest";
import { classifyMessage, decideReply } from "./autoreply";
import { generateSeed } from "@/lib/demo/seed";

const db = generateSeed();
const enquiry = db.enquiries.find((e) => e.stage === "itinerary_sent")!;
const traveller = db.travellers.find((t) => t.id === enquiry.travellerId)!;
const destination = db.destinations.find((d) => d.id === enquiry.destinationId);
const base = { enquiry, traveller, destination, config: db.settings.agents.autoReply, rules: db.autoReplyRules, consultantName: "Rohan", autoRepliesSoFar: 0 };

describe("classifyMessage", () => {
  it("detects pricing questions", () => {
    expect(classifyMessage("How much for 2 people in December?").intent).toBe("pricing");
  });
  it("extracts a trip brief", () => {
    const c = classifyMessage("December, 4 of us, budget around 60k per person");
    expect(c.intent).toBe("trip_brief");
    expect(c.extracted.month).toBe("December");
    expect(c.extracted.pax).toBe(4);
    expect(c.extracted.budgetINR).toBe(60000);
  });
  it("flags cancellations", () => {
    expect(classifyMessage("I want to cancel, family emergency").intent).toBe("cancellation");
  });
});

describe("decideReply", () => {
  it("auto-sends confident FAQ answers", () => {
    const d = decideReply({ ...base, text: "Is a visa needed?" });
    expect(d.intent).toBe("visa");
    expect(d.action).toBe("auto_sent");
    expect(d.reply.length).toBeGreaterThan(20);
  });
  it("drafts discount requests for a human", () => {
    const d = decideReply({ ...base, text: "Any discount if we pay full now?" });
    expect(d.action).toBe("drafted");
    expect(d.tag).toBe("discount-asked");
  });
  it("escalates cancellations", () => {
    const d = decideReply({ ...base, text: "I want to cancel my trip" });
    expect(d.action).toBe("escalated");
  });
  it("respects the per-thread auto-reply cap", () => {
    const d = decideReply({ ...base, text: "Is a visa needed?", autoRepliesSoFar: 99 });
    expect(d.action).toBe("drafted");
  });
  it("moves a captured brief to qualified", () => {
    const d = decideReply({ ...base, text: "January, 2 of us, 50k pp" });
    expect(d.suggestedStage).toBe("qualified");
  });
});
