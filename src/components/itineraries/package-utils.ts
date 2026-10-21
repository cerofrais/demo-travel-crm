import type { Destination, Itinerary, PackageTemplate, Pax, Pace, Comfort } from "@/lib/demo/types";
import { generateItinerary, type GeneratedItinerary } from "@/lib/ai/itinerary";

/** Build a throwaway Itinerary object from a package so ItineraryView can render a package preview. */
export function previewItinerary(pkg: PackageTemplate, destination: Destination, opts: { nights?: number; pax?: Pax; pace?: Pace; comfort?: Comfort; startDate?: string; includeFlights?: boolean; departureCity?: string; budgetINR?: number } = {}): { itinerary: Itinerary; generated: GeneratedItinerary } {
  const nights = opts.nights ?? pkg.nights;
  const pax = opts.pax ?? { adults: 2, children: 0, infants: 0 };
  const pace = opts.pace ?? pkg.pace;
  const comfort = opts.comfort ?? pkg.comfort;
  const generated = generateItinerary({
    pkg,
    destination,
    nights,
    pax,
    pace,
    comfort,
    startDate: opts.startDate,
    includeFlights: opts.includeFlights ?? false,
    departureCity: opts.departureCity ?? "Bengaluru",
    budgetINR: opts.budgetINR,
  });
  const itinerary: Itinerary = {
    id: `preview_${pkg.id}`,
    enquiryId: "",
    version: 1,
    title: generated.title,
    destinationId: destination.id,
    nights,
    startDate: opts.startDate,
    pax,
    pace,
    comfort,
    days: generated.days,
    stays: generated.stays,
    flights: generated.flights,
    inclusions: generated.inclusions,
    exclusions: generated.exclusions,
    pricing: generated.pricing,
    status: "draft",
    generatedByAI: true,
    basedOnPackageId: pkg.id,
    shareSlug: pkg.code.toLowerCase(),
    createdBy: "ai",
    createdAt: pkg.createdAt,
  };
  return { itinerary, generated };
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthsLabel(months: number[]): string {
  if (months.length === 0) return "Year-round";
  return months.map((m) => MONTHS[m - 1]).join(" · ");
}

export function slugCode(destination: Destination | undefined, nights: number, hint: string): string {
  const d = (destination?.id ?? "trip").toUpperCase().slice(0, 4);
  const h = hint
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 6) || "CUSTOM";
  return `${d}-${nights + 1}D-${h}`;
}
