import { describe, expect, it } from "vitest";
import { auditFor, hashId, inboundTopics, maskPII, suggestTemplateFor } from "./audit";
import { generateSeed } from "@/lib/demo/seed";
import { classifyMessage } from "./autoreply";

const db = generateSeed();

describe("auditFor", () => {
  it("is deterministic for the same event", () => {
    const ev = db.agentEvents[0];
    const a = auditFor(ev, db);
    const b = auditFor(ev, db);
    expect(a.model).toBe(b.model);
    expect(a.latencyMs).toBe(b.latencyMs);
    expect(a.tokens).toEqual(b.tokens);
    expect(a.prompt).toEqual(b.prompt);
    expect(a.output).toBe(b.output);
    expect(a.outcome).toBe(b.outcome);
  });

  it("picks the model and latency band per agent", () => {
    for (const ev of db.agentEvents) {
      const r = auditFor(ev, db);
      if (ev.agent === "voice") {
        expect(r.model).toContain("realtime voice");
        expect(r.latencyMs).toBeGreaterThanOrEqual(1800);
        expect(r.latencyMs).toBeLessThanOrEqual(4200);
      } else if (ev.agent === "itinerary") {
        expect(r.model).toBe("claude-opus-5-5");
        expect(r.latencyMs).toBeGreaterThanOrEqual(6000);
        expect(r.latencyMs).toBeLessThanOrEqual(14000);
      } else if (ev.agent === "scoring") {
        expect(r.model).toContain("rules-v2");
      } else if (r.outcome !== "failed") {
        expect(r.latencyMs).toBeGreaterThanOrEqual(400);
        expect(r.latencyMs).toBeLessThanOrEqual(1600);
      }
      expect(r.tokens.in).toBeGreaterThan(0);
      expect(r.tokens.out).toBeGreaterThan(0);
    }
  });

  it("builds a travel-specific prompt from the linked enquiry and masks passports", () => {
    const ev = db.agentEvents.find((e) => e.enquiryId && db.travellers.some((t) => t.id === e.travellerId && t.passportNo))!;
    const r = auditFor(ev, db);
    const enquiry = db.enquiries.find((e) => e.id === ev.enquiryId)!;
    const traveller = db.travellers.find((t) => t.id === ev.travellerId)!;
    expect(r.prompt.user).toContain(enquiry.ref);
    expect(r.prompt.user).toContain(enquiry.destination);
    expect(r.prompt.user).toContain(ev.action);
    expect(r.prompt.user).not.toContain(traveller.passportNo!);
    expect(r.prompt.system.length).toBeGreaterThan(100);
    expect(r.entityLabel).toContain(traveller.fullName);
    expect(r.entityHref).toBe(`/enquiries?enquiry=${enquiry.id}`);
  });

  it("prefers the event's own audit fields when present", () => {
    const ev = { ...db.agentEvents[0], model: "test-model", latencyMs: 42, tokens: { in: 1, out: 2 }, prompt: { system: "S", user: "U" }, output: "O", outcome: "failed" as const };
    const r = auditFor(ev, db);
    expect(r).toMatchObject({ model: "test-model", latencyMs: 42, tokens: { in: 1, out: 2 }, prompt: { system: "S", user: "U" }, output: "O", outcome: "failed" });
  });

  it("marks rejected events skipped and roughly 1 in 15 as failed", () => {
    const records = db.agentEvents.map((e) => auditFor(e, db));
    for (const r of records) if (r.event.status === "rejected") expect(r.outcome).toBe("skipped");
    const failed = records.filter((r) => r.outcome === "failed");
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.length).toBeLessThan(records.length / 5);
    for (const r of failed) {
      expect(r.failureNote).toBeTruthy();
      expect(r.output).toContain(r.failureNote!);
    }
  });

  it("appends a JSON block when the event has a payload", () => {
    const ev = db.agentEvents.find((e) => e.payload && Object.keys(e.payload).length)!;
    const r = auditFor(ev, db);
    if (r.outcome !== "failed") expect(r.output).toContain("```json");
  });
});

describe("hashId / maskPII", () => {
  it("hashes stably", () => {
    expect(hashId("evt_1")).toBe(hashId("evt_1"));
    expect(hashId("evt_1")).not.toBe(hashId("evt_2"));
  });
  it("masks passport-like tokens only", () => {
    expect(maskPII("Passport: L7430325 ref WT-1042")).toBe("Passport: ••••0325 ref WT-1042");
  });
});

describe("inboundTopics", () => {
  it("counts every inbound message exactly once", () => {
    const a = inboundTopics(db);
    const inbound = db.messages.filter((m) => m.direction === "inbound");
    expect(a.total).toBe(inbound.length);
    const sum = a.topics.reduce((s, t) => s + t.count, 0) + a.unrecognised;
    expect(sum).toBe(inbound.length);
    expect(a.unrecognised).toBe(inbound.filter((m) => classifyMessage(m.body).intent === "other").length);
  });

  it("sorts topics by count and gives up to 3 samples", () => {
    const a = inboundTopics(db);
    for (let i = 1; i < a.topics.length; i++) expect(a.topics[i - 1].count).toBeGreaterThanOrEqual(a.topics[i].count);
    for (const t of a.topics) {
      expect(t.samples.length).toBeGreaterThan(0);
      expect(t.samples.length).toBeLessThanOrEqual(3);
      expect(t.share).toBeGreaterThanOrEqual(0);
    }
  });

  it("links rules and templates and reports gaps", () => {
    const a = inboundTopics(db);
    const discount = a.topics.find((t) => t.intent === "discount");
    expect(discount?.rule?.id).toBe("rule_discount");
    const payment = a.topics.find((t) => t.intent === "payment");
    expect(payment?.templates.map((t) => t.id)).toContain("tpl_payment_link");
    expect(a.gaps.every((g) => g.templates.length === 0 && g.templateExpected)).toBe(true);
    expect(a.gaps.length).toBeGreaterThan(0);
  });

  it("respects the since filter", () => {
    const all = inboundTopics(db);
    const recent = inboundTopics(db, { sinceIso: new Date(Date.now() - 7 * 86400000).toISOString() });
    expect(recent.total).toBeLessThanOrEqual(all.total);
  });
});

describe("suggestTemplateFor", () => {
  it("drafts a body with variables for any topic", () => {
    const a = inboundTopics(db);
    for (const t of a.topics) {
      const s = suggestTemplateFor(t);
      expect(s.body.length).toBeGreaterThan(40);
      expect(s.name.length).toBeGreaterThan(3);
      for (const v of s.variables) expect(s.body).toContain(`{{${v}}}`);
    }
  });
});
