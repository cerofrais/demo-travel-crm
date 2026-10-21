import { describe, expect, it } from "vitest";
import { generateSeed } from "@/lib/demo/seed";
import { visibleEnquiries } from "@/lib/demo/queries";
import { EXAMPLE_QUESTIONS, askData, handlerIdFor, parseQuestion } from "./ask";
import { parseRange } from "./ask-parse";

const db = generateSeed();
const admin = { sub: "u_aarav", role: "ADMIN" };
const now = new Date();

describe("parseQuestion", () => {
  it("picks entity, metric, filters and group-by from synonyms", () => {
    const q = parseQuestion("How many leads came from IG this week by source?", db, now);
    expect(q.entity).toBe("enquiries");
    expect(q.metric).toBe("count");
    expect(q.groupBy).toBe("source");
    expect(q.filters.source).toBe("instagram");
    expect(q.range.label).toBe("this week");
  });

  it("maps destination aliases and consultant first names", () => {
    const q = parseQuestion("Show me Sneha's open Phuket honeymoon leads", db, now);
    expect(q.filters.destination).toBe("thailand");
    expect(q.filters.consultantSub).toBe("u_sneha");
    expect(q.filters.tripType).toBe("honeymoon");
    expect(q.filters.stage).toBe("open");
  });

  it("parses relative date ranges", () => {
    const base = new Date(2026, 9, 22, 12, 0, 0); // Thu 22 Oct 2026
    const last30 = parseRange("enquiries in the last 30 days", base);
    expect(last30.label).toBe("last 30 days");
    expect(last30.from?.getDate()).toBe(22);
    expect(last30.from?.getMonth()).toBe(8);
    const lastMonth = parseRange("bookings last month", base);
    expect(lastMonth.from?.getMonth()).toBe(8);
    expect(lastMonth.to?.getMonth()).toBe(8);
    const week = parseRange("calls this week", base);
    expect(week.from?.getDay()).toBe(1);
    const next14 = parseRange("departures in the next 14 days", base, "future");
    expect(next14.future).toBe(true);
    expect(next14.to && next14.to.getTime() - base.getTime()).toBeGreaterThan(13 * 86400000);
    const dec = parseRange("departures in december", base, "future");
    expect(dec.from?.getMonth()).toBe(11);
    expect(dec.from?.getFullYear()).toBe(2026);
    const none = parseRange("overdue payments", base);
    expect(none.from).toBeUndefined();
    expect(none.label).toBe("all time");
  });

  it("extracts no-reply windows and refs", () => {
    const q = parseQuestion("Enquiries with no reply for 3 days", db, now);
    expect(q.filters.noReplyDays).toBe(3);
    expect(q.range.from).toBeUndefined();
    expect(parseQuestion("what's up with wt-1045 and WTB-2026-021?", db, now).refs).toEqual(["WT-1045", "WTB-2026-021"]);
  });
});

describe("askData", () => {
  it("answers a count-by-source question with a chart and rows", () => {
    const a = askData("How many enquiries by source last 30 days?", db, admin, now);
    expect(a.mode).toBe("table");
    expect(a.chart?.length).toBeGreaterThan(0);
    expect(a.rows?.length).toBe(a.chart?.length);
    expect(a.columns?.[0]).toBe("Source");
    expect(a.query).toMatch(/^SELECT source, COUNT\(\*\) FROM enquiries WHERE .*GROUP BY source ORDER BY 2 DESC$/);
    expect(a.durationMs).toBeGreaterThanOrEqual(1);
    const total = a.chart!.reduce((s, c) => s + c.value, 0);
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    expect(total).toBe(db.enquiries.filter((e) => new Date(e.createdAt) >= from).length);
  });

  it("applies the date range to the query", () => {
    const a = askData("How many enquiries came from Instagram this week?", db, admin, now);
    expect(a.query).toContain("created_at >= '");
    expect(a.query).toContain("source IN ('instagram_comment','instagram_dm')");
    expect(a.text).toMatch(/from Instagram \(this week\)/);
  });

  it("looks up an enquiry by ref and returns a narrative with entityId", () => {
    const e = db.enquiries[5];
    const a = askData(`What's happening with ${e.ref}?`, db, admin, now);
    expect(a.mode).toBe("narrative");
    expect(a.entityId).toBe(e.id);
    expect(a.entityKind).toBe("enquiry");
    expect(a.text).toContain(e.ref);
    expect(a.query).toContain(e.ref);
  });

  it("looks up a trip by ref and a traveller by full name", () => {
    const trip = db.trips[0];
    const a = askData(trip.ref, db, admin, now);
    expect(a.mode).toBe("narrative");
    expect(a.entityId).toBe(trip.id);
    expect(a.entityKind).toBe("trip");
    const t = db.travellers[3];
    const b = askData(`Show me ${t.fullName}`, db, admin, now);
    expect(b.mode).toBe("narrative");
    expect(b.text).toContain(t.fullName);
  });

  it("offers candidates when a first name is ambiguous", () => {
    const first = db.travellers[0].fullName.split(" ")[0];
    const matches = db.travellers.filter((t) => t.fullName.split(" ")[0] === first);
    const a = askData(`Show me ${first}`, db, admin, now);
    if (matches.length > 1) {
      expect(a.mode).toBe("choose");
      expect(a.rows?.length).toBe(Math.min(12, matches.length));
      expect(a.columns).toContain("Ref");
    } else {
      expect(a.mode).toBe("narrative");
    }
  });

  it("returns unknown with example questions for gibberish", () => {
    const a = askData("flibbertigibbet wombat", db, admin, now);
    expect(a.mode).toBe("unknown");
    expect(a.text).toContain("•");
    expect(a.query).toContain("no matching handler");
  });

  it("scopes SALES to own and unassigned enquiries", () => {
    const sales = { sub: "u_rohan", role: "SALES" };
    const mine = askData("How many enquiries this year?", db, sales, now);
    const all = askData("How many enquiries this year?", db, admin, now);
    const visible = visibleEnquiries(db, sales).length;
    expect(mine.text).toMatch(new RegExp(`^${visible} enquir`));
    expect(mine.text).toContain("Scoped to your own and unassigned enquiries");
    expect(visible).toBeLessThan(db.enquiries.length);
    expect(all.text).not.toContain("Scoped");
    expect(mine.query).toContain(`assigned_to = 'u_rohan'`);
  });

  it("answers every example question with a non-unknown mode", () => {
    for (const q of EXAMPLE_QUESTIONS) {
      const a = askData(q, db, admin, now);
      expect(a.mode, q).not.toBe("unknown");
      expect(a.query.length, q).toBeGreaterThan(10);
    }
  });

  it("routes the operational questions to the right handlers", () => {
    expect(handlerIdFor("Overdue payments", db, now)).toBe("payments");
    expect(handlerIdFor("Who has the most overdue tasks?", db, now)).toBe("tasks");
    expect(handlerIdFor("Calls handled by Aanya this week", db, now)).toBe("calls");
    expect(handlerIdFor("Itineraries sent but not viewed", db, now)).toBe("itineraries");
    expect(handlerIdFor("Conversion rate by source last 30 days", db, now)).toBe("conversion");
    expect(handlerIdFor("Booked value by destination this month", db, now)).toBe("revenue");
    expect(handlerIdFor("Departures in the next 14 days", db, now)).toBe("trips");
    expect(handlerIdFor("Which travellers have passports expiring in the next 6 months?", db, now)).toBe("passports");
    const overdue = askData("Overdue payments", db, admin, now);
    expect(overdue.columns).toEqual(expect.arrayContaining(["Traveller", "Trip ref", "Amount", "Due"]));
    const tasks = askData("Who has the most overdue tasks?", db, admin, now);
    expect(tasks.chart?.length).toBeGreaterThan(0);
  });
});
