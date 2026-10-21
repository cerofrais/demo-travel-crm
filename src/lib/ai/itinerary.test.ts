import { describe, expect, it } from "vitest";
import { generateItinerary } from "./itinerary";
import { DESTINATIONS, PACKAGES } from "@/lib/demo/seed-static";

const pkg = PACKAGES.find((p) => p.id === "pkg_kerala_5d")!;
const destination = DESTINATIONS.find((d) => d.id === "kerala")!;
const base = { pkg, destination, pax: { adults: 2, children: 0, infants: 0 }, pace: "balanced" as const, comfort: "comfort" as const, includeFlights: false, departureCity: "Bengaluru" };

describe("generateItinerary", () => {
  it("fits the template to the requested nights", () => {
    expect(generateItinerary({ ...base, nights: 6 }).days).toHaveLength(7);
    expect(generateItinerary({ ...base, nights: 2 }).days).toHaveLength(3);
  });
  it("prices premium above comfort and adds flights when asked", () => {
    const comfort = generateItinerary({ ...base, nights: 4 });
    const premium = generateItinerary({ ...base, nights: 4, comfort: "premium" });
    const withFlights = generateItinerary({ ...base, nights: 4, includeFlights: true });
    expect(premium.pricing.totalINR).toBeGreaterThan(comfort.pricing.totalINR);
    expect(withFlights.pricing.totalINR).toBeGreaterThan(comfort.pricing.totalINR);
    expect(withFlights.flights).toHaveLength(0); // no start date → no flight legs
    expect(generateItinerary({ ...base, nights: 4, includeFlights: true, startDate: "2026-12-10" }).flights).toHaveLength(2);
  });
  it("sums the breakdown to the total", () => {
    const it = generateItinerary({ ...base, nights: 4, includeFlights: true, startDate: "2026-12-10" });
    const sum = it.pricing.breakdown.reduce((s, b) => s + b.amountINR, 0);
    expect(sum).toBe(it.pricing.totalINR);
  });
  it("explains budget fit", () => {
    const it = generateItinerary({ ...base, nights: 4, budgetINR: 10000 });
    expect(it.rationale.some((r) => r.includes("Over budget"))).toBe(true);
  });
});
