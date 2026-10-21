import type { Comfort, Destination, Itinerary, ItineraryDay, Pace, PackageTemplate, Pax, PriceLine, Stay, Flight } from "@/lib/demo/types";

/**
 * Itinerary generator — rule-based stand-in for the LLM itinerary agent.
 * Takes a package template (built from a reel) and rebuilds it for the
 * traveller's nights, pax, pace, comfort and budget, with a transparent price
 * breakdown. Deterministic so the demo is stable.
 */

export interface GenerateParams {
  pkg: PackageTemplate;
  destination: Destination;
  nights: number;
  pax: Pax;
  pace: Pace;
  comfort: Comfort;
  startDate?: string;
  includeFlights: boolean;
  departureCity: string;
  budgetINR?: number;
}

const COMFORT_MULT: Record<Comfort, number> = { budget: 0.82, comfort: 1, premium: 1.35, luxury: 1.9 };
const COMFORT_STAY: Record<Comfort, string> = { budget: "3★ / homestay", comfort: "4★ boutique", premium: "5★ / villa", luxury: "Luxury resort" };

function seasonMult(destination: Destination, startDate?: string): number {
  if (!startDate) return 1;
  const m = new Date(startDate).getMonth() + 1;
  return destination.bestMonths.includes(m) ? 1.08 : 0.94;
}

function fitDays(days: ItineraryDay[], nights: number, pace: Pace): ItineraryDay[] {
  const target = nights + 1;
  let out = days.map((x) => ({ ...x, activities: [...x.activities], meals: { ...x.meals } }));
  if (out.length > target) {
    // Drop middle days first, keep arrival + departure.
    while (out.length > target) out.splice(Math.floor(out.length / 2), 1);
  } else if (out.length < target) {
    const last = out[out.length - 1];
    const fillers = ["Free day — slow morning, optional spa", "Explore on your own — café hopping and local markets", "Beach / lake day with no plan"];
    let i = 0;
    while (out.length < target) {
      out.splice(out.length - 1, 0, {
        day: 0,
        title: "Slow day",
        location: out[out.length - 2]?.location ?? last.location,
        summary: fillers[i % fillers.length],
        activities: ["Free day"],
        meals: { b: true, l: false, d: false },
        stay: out[out.length - 2]?.stay,
      });
      i += 1;
    }
  }
  out = out.map((x, idx) => ({ ...x, day: idx + 1 }));
  if (pace === "slow") {
    out = out.map((x) => ({ ...x, activities: x.activities.slice(0, Math.max(1, x.activities.length - 1)) }));
  } else if (pace === "packed") {
    out = out.map((x, idx) =>
      idx === 0 || idx === out.length - 1 ? x : { ...x, activities: [...x.activities, "Evening food walk"] },
    );
  }
  return out;
}

export function buildStays(days: ItineraryDay[], comfort: Comfort, startDate: string | undefined): Stay[] {
  const stays: Stay[] = [];
  let i = 0;
  while (i < days.length) {
    const name = days[i].stay;
    if (!name) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < days.length && days[j + 1].stay === name) j += 1;
    const nights = j - i + 1;
    const base = startDate ? new Date(startDate) : undefined;
    const checkIn = base ? new Date(base.getTime() + i * 86400000).toISOString() : "";
    const checkOut = base ? new Date(base.getTime() + (i + nights) * 86400000).toISOString() : "";
    stays.push({
      id: `stay_${stays.length + 1}`,
      name,
      location: days[i].location,
      category: COMFORT_STAY[comfort],
      checkIn,
      checkOut,
      roomType: comfort === "luxury" || comfort === "premium" ? "Suite / pool villa" : "Deluxe double",
    });
    i = j + 1;
  }
  return stays;
}

function buildFlights(destination: Destination, departureCity: string, nights: number, startDate?: string): Flight[] {
  if (!startDate) return [];
  const start = new Date(startDate);
  const end = new Date(start.getTime() + nights * 86400000);
  const hubs: Record<string, string> = { goa: "GOI", kerala: "COK", dharamshala: "DHM", thailand: "HKT", japan: "HND", vietnam: "HAN", bali: "DPS", malaysia: "KUL", dubai: "DXB", kashmir: "SXR", ladakh: "IXL", andaman: "IXZ" };
  const cityCode: Record<string, string> = { Bengaluru: "BLR", Mumbai: "BOM", Delhi: "DEL", Hyderabad: "HYD", Chennai: "MAA", Pune: "PNQ", Kolkata: "CCU", Ahmedabad: "AMD" };
  const from = cityCode[departureCity] ?? "BLR";
  const to = hubs[destination.id] ?? "XXX";
  const airline = destination.region === "international" ? "IndiGo" : "Air India";
  const dep = new Date(start);
  dep.setHours(6, 40, 0, 0);
  const arr = new Date(dep.getTime() + destination.flightHours * 3600000);
  const dep2 = new Date(end);
  dep2.setHours(15, 10, 0, 0);
  const arr2 = new Date(dep2.getTime() + destination.flightHours * 3600000);
  return [
    { id: "fl_out", airline, flightNo: `${airline === "IndiGo" ? "6E" : "AI"} ${1200 + (to.charCodeAt(0) % 90)}`, from, to, departAt: dep.toISOString(), arriveAt: arr.toISOString(), baggage: "15 kg check-in + 7 kg cabin" },
    { id: "fl_ret", airline, flightNo: `${airline === "IndiGo" ? "6E" : "AI"} ${1300 + (from.charCodeAt(0) % 90)}`, from: to, to: from, departAt: dep2.toISOString(), arriveAt: arr2.toISOString(), baggage: "15 kg check-in + 7 kg cabin" },
  ];
}

export function priceItinerary(params: GenerateParams): Itinerary["pricing"] {
  const { pkg, destination, nights, pax, comfort, includeFlights, startDate } = params;
  const perNightBase = (pkg.fromPriceINR / Math.max(1, pkg.nights)) * COMFORT_MULT[comfort] * seasonMult(destination, startDate);
  const adultPP = Math.round((perNightBase * nights) / 100) * 100;
  const childPP = Math.round(adultPP * 0.7);
  const infantPP = Math.round(adultPP * 0.1);
  const groundTotal = adultPP * pax.adults + childPP * pax.children + infantPP * pax.infants;
  const flightPP = includeFlights ? Math.round(destination.flightHours * (destination.region === "international" ? 3600 : 2600)) : 0;
  const flightsTotal = flightPP * (pax.adults + pax.children);
  const stays = Math.round(groundTotal * 0.52);
  const transport = Math.round(groundTotal * 0.17);
  const experiences = Math.round(groundTotal * 0.16);
  const meals = Math.round(groundTotal * 0.07);
  const fee = groundTotal - stays - transport - experiences - meals;
  const subtotal = groundTotal + flightsTotal;
  const gst = Math.round(subtotal * 0.05);
  const total = subtotal + gst;
  const breakdown: PriceLine[] = [
    { label: "Stays", amountINR: stays },
    { label: "Transfers & transport", amountINR: transport },
    { label: "Experiences & entries", amountINR: experiences },
    { label: "Meals included", amountINR: meals },
    ...(includeFlights ? [{ label: `Flights (${pax.adults + pax.children} pax)`, amountINR: flightsTotal }] : []),
    { label: "wishtrip planning & support", amountINR: fee },
    { label: "GST (5%)", amountINR: gst },
  ];
  const payingPax = Math.max(1, pax.adults + pax.children);
  return {
    perPersonINR: Math.round(total / payingPax),
    totalINR: total,
    breakdown,
    marginINR: Math.round(groundTotal * 0.14),
    gstINR: gst,
  };
}

export interface GeneratedItinerary {
  title: string;
  days: ItineraryDay[];
  stays: Stay[];
  flights: Flight[];
  inclusions: string[];
  exclusions: string[];
  pricing: Itinerary["pricing"];
  rationale: string[];
}

export function generateItinerary(params: GenerateParams): GeneratedItinerary {
  const { pkg, destination, nights, pax, pace, comfort, startDate, includeFlights, budgetINR } = params;
  const days = fitDays(pkg.days, nights, pace);
  const stays = buildStays(days, comfort, startDate);
  const flights = includeFlights ? buildFlights(destination, params.departureCity, nights, startDate) : [];
  const pricing = priceItinerary(params);
  const rationale: string[] = [];
  rationale.push(`Rebuilt "${pkg.title}" for ${nights} nights (template is ${pkg.nights}).`);
  rationale.push(`${pace === "slow" ? "Dropped one activity per day" : pace === "packed" ? "Added an evening food walk on full days" : "Kept the template pace"} for a ${pace} pace.`);
  rationale.push(`Stays set to ${COMFORT_STAY[comfort]} for ${pax.adults} adult${pax.adults === 1 ? "" : "s"}${pax.children ? ` + ${pax.children} child${pax.children === 1 ? "" : "ren"}` : ""}.`);
  if (startDate) {
    const m = new Date(startDate).getMonth() + 1;
    rationale.push(destination.bestMonths.includes(m) ? "Peak-season rates applied (+8%)." : "Off-peak rates applied (−6%).");
  }
  if (budgetINR) {
    const diff = pricing.totalINR - budgetINR;
    if (diff > budgetINR * 0.1) rationale.push(`Over budget by ₹${diff.toLocaleString("en-IN")} — suggest dropping to ${comfort === "luxury" ? "premium" : comfort === "premium" ? "comfort" : "budget"} stays or ${nights - 1} nights.`);
    else if (diff < -budgetINR * 0.15) rationale.push(`Under budget by ₹${(-diff).toLocaleString("en-IN")} — room to upgrade one stay or add a private experience.`);
    else rationale.push("Within ±10% of the stated budget.");
  }
  const title = `${destination.name} · ${nights}N/${nights + 1}D · ${pace} pace`;
  return {
    title,
    days,
    stays,
    flights,
    inclusions: [...pkg.inclusions, ...(includeFlights ? [`Return flights ex-${params.departureCity}`] : [])],
    exclusions: pkg.exclusions.filter((e) => !(includeFlights && e.startsWith("Flights"))),
    pricing,
    rationale,
  };
}

export function itineraryToText(it: Pick<Itinerary, "title" | "days" | "pricing" | "inclusions" | "exclusions" | "nights">): string {
  const lines: string[] = [it.title, ""];
  for (const d of it.days) {
    lines.push(`Day ${d.day} — ${d.title} (${d.location})`);
    lines.push(`  ${d.summary}`);
    if (d.activities.length) lines.push(`  • ${d.activities.join(" · ")}`);
    if (d.stay) lines.push(`  Stay: ${d.stay}`);
    lines.push("");
  }
  lines.push("Pricing");
  for (const b of it.pricing.breakdown) lines.push(`  ${b.label}: ₹${b.amountINR.toLocaleString("en-IN")}`);
  lines.push(`  Total: ₹${it.pricing.totalINR.toLocaleString("en-IN")} (₹${it.pricing.perPersonINR.toLocaleString("en-IN")} per person)`);
  lines.push("", "Inclusions: " + it.inclusions.join("; "), "Exclusions: " + it.exclusions.join("; "));
  return lines.join("\n");
}
