"use client";

import * as React from "react";
import { Sparkles, ChevronLeft, Film, Check } from "lucide-react";
import type { Comfort, Pace, PackageTemplate } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { destinationById, enquiryById, itinerariesForEnquiry, logActivity, travellerById } from "@/lib/demo/queries";
import { generateItinerary } from "@/lib/ai/itinerary";
import { PACE_LABEL, COMFORT_LABEL, TRIP_TYPE_LABEL } from "@/lib/pipeline";
import { cn, formatINR, toDateInput } from "@/lib/utils";
import { Button, Card, Dialog, Input, Select } from "@/components/ui";
import { Field, Toggle } from "@/components/shared";

const CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"];

interface Params {
  nights: number;
  adults: number;
  children: number;
  infants: number;
  pace: Pace;
  comfort: Comfort;
  startDate: string;
  includeFlights: boolean;
  departureCity: string;
  budgetINR: number;
}

/**
 * "Build from reel / package" dialog. Cross-area contract component used by
 * the enquiry drawer. Step 1 picks a package template, step 2 tunes the
 * parameters with a live AI preview, then saves a draft Itinerary version.
 */
export function ItineraryBuilderDialog({ open, onClose, enquiryId, onCreated }: { open: boolean; onClose: () => void; enquiryId: string; onCreated?: (itineraryId: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const enquiry = enquiryById(db, enquiryId);
  const [pkgId, setPkgId] = React.useState<string | null>(null);
  const [params, setParams] = React.useState<Params | null>(null);

  // Reset when (re)opened.
  React.useEffect(() => {
    if (open) {
      setPkgId(null);
      setParams(null);
    }
  }, [open, enquiryId]);

  if (!enquiry) return null;

  const dest = destinationById(db, enquiry.destinationId);
  const active = db.packages.filter((p) => p.active);
  const matching = active.filter((p) => p.destinationId === enquiry.destinationId);
  const others = active.filter((p) => p.destinationId !== enquiry.destinationId);
  const pkg = db.packages.find((p) => p.id === pkgId) ?? null;
  const pkgDest = pkg ? destinationById(db, pkg.destinationId) : undefined;

  function choose(p: PackageTemplate) {
    setPkgId(p.id);
    if (!enquiry) return;
    setParams({
      nights: enquiry.nights || p.nights,
      adults: enquiry.pax.adults,
      children: enquiry.pax.children,
      infants: enquiry.pax.infants,
      pace: enquiry.pace,
      comfort: enquiry.comfort,
      startDate: enquiry.travelStart ? toDateInput(enquiry.travelStart) : enquiry.travelMonth ? `${enquiry.travelMonth}-10` : "",
      includeFlights: enquiry.includeFlights,
      departureCity: enquiry.departureCity || "Bengaluru",
      budgetINR: enquiry.budgetINR,
    });
  }

  const preview =
    pkg && pkgDest && params
      ? generateItinerary({
          pkg,
          destination: pkgDest,
          nights: Math.max(1, params.nights),
          pax: { adults: Math.max(1, params.adults), children: params.children, infants: params.infants },
          pace: params.pace,
          comfort: params.comfort,
          startDate: params.startDate ? new Date(params.startDate).toISOString() : undefined,
          includeFlights: params.includeFlights,
          departureCity: params.departureCity,
          budgetINR: params.budgetINR || undefined,
        })
      : null;

  const nextVersion = Math.max(0, ...itinerariesForEnquiry(db, enquiryId).map((i) => i.version)) + 1;

  function save() {
    if (!pkg || !pkgDest || !params || !preview || !enquiry) return;
    const id = newId("itin");
    const pax = { adults: Math.max(1, params.adults), children: params.children, infants: params.infants };
    const n = nextVersion;
    mutateDb((d) => {
      const e = enquiryById(d, enquiryId);
      if (!e) return;
      const requireReview = d.settings.agents.itinerary.requireReview;
      d.itineraries.push({
        id,
        enquiryId,
        version: n,
        title: preview.title,
        destinationId: pkgDest.id,
        nights: Math.max(1, params.nights),
        startDate: params.startDate ? new Date(params.startDate).toISOString() : undefined,
        pax,
        pace: params.pace,
        comfort: params.comfort,
        days: preview.days,
        stays: preview.stays,
        flights: preview.flights,
        inclusions: preview.inclusions,
        exclusions: preview.exclusions,
        pricing: preview.pricing,
        status: "draft",
        generatedByAI: true,
        basedOnPackageId: pkg.id,
        shareSlug: `${e.ref.toLowerCase()}-v${n}`,
        createdBy: me.sub || "ai",
        createdAt: nowIso(),
        changeNote: n > 1 ? `Rebuilt from ${pkg.code} with updated parameters` : undefined,
      });
      d.agentEvents.unshift({
        id: newId("evt"),
        agent: "itinerary",
        at: nowIso(),
        enquiryId,
        travellerId: e.travellerId,
        action: `Drafted itinerary v${n}`,
        detail: `${preview.title} from ${pkg.code} · ${formatINR(preview.pricing.totalINR)} total · ${preview.rationale[0] ?? ""}`,
        confidence: 0.88,
        status: requireReview ? "needs_review" : "auto",
        payload: { itineraryId: id, packageId: pkg.id, rationale: preview.rationale },
      });
      e.updatedAt = nowIso();
      e.lastActivityAt = nowIso();
      const traveller = travellerById(d, e.travellerId);
      logActivity(d, {
        actor: me.name || "AI agent",
        actorKind: me.sub ? "user" : "ai",
        type: "itinerary_drafted",
        text: `Drafted itinerary v${n} for ${traveller?.fullName ?? e.ref} — ${preview.title} (${formatINR(preview.pricing.totalINR)})`,
        enquiryId,
        travellerId: e.travellerId,
      });
    });
    onCreated?.(id);
    onClose();
  }

  const budgetPct = preview && params?.budgetINR ? Math.min(150, Math.round((preview.pricing.totalINR / params.budgetINR) * 100)) : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="md:max-w-3xl"
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-600" />
          {pkg ? `Build itinerary · ${enquiry.ref}` : `Pick a package · ${enquiry.ref}`}
        </span>
      }
    >
      {!pkg ? (
        <div className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            {dest ? `${dest.emoji} ${dest.name}` : enquiry.destination} · {enquiry.nights} nights · {TRIP_TYPE_LABEL[enquiry.tripType]} · budget {formatINR(enquiry.budgetINR, { compact: true })}
          </p>
          {matching.length > 0 && (
            <section>
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Matches this destination</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {matching.map((p) => (
                  <PackageCard key={p.id} pkg={p} emoji={destinationById(db, p.destinationId)?.emoji} onPick={() => choose(p)} highlight />
                ))}
              </div>
            </section>
          )}
          <section>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">All packages</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {others.map((p) => (
                <PackageCard key={p.id} pkg={p} emoji={destinationById(db, p.destinationId)?.emoji} onPick={() => choose(p)} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        params && (
          <div className="grid gap-0 md:grid-cols-5">
            {/* Parameters */}
            <div className="space-y-3 border-b border-border p-4 md:col-span-2 md:border-b-0 md:border-r">
              <button type="button" onClick={() => setPkgId(null)} className="inline-flex min-h-[40px] items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                <ChevronLeft className="h-4 w-4" /> Change package
              </button>
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{pkg.code}</p>
                <p className="text-sm font-medium text-foreground">{pkg.title}</p>
                {pkg.sourceReel && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-pink-700">
                    <Film className="h-3 w-3" /> from reel
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nights">
                  <Input type="number" min={1} max={21} value={params.nights} onChange={(e) => setParams({ ...params, nights: Number(e.target.value) })} />
                </Field>
                <Field label="Start date">
                  <Input type="date" value={params.startDate} onChange={(e) => setParams({ ...params, startDate: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Adults">
                  <Input type="number" min={1} value={params.adults} onChange={(e) => setParams({ ...params, adults: Number(e.target.value) })} />
                </Field>
                <Field label="Children">
                  <Input type="number" min={0} value={params.children} onChange={(e) => setParams({ ...params, children: Number(e.target.value) })} />
                </Field>
                <Field label="Infants">
                  <Input type="number" min={0} value={params.infants} onChange={(e) => setParams({ ...params, infants: Number(e.target.value) })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pace">
                  <Select value={params.pace} onChange={(e) => setParams({ ...params, pace: e.target.value as Pace })}>
                    {(Object.keys(PACE_LABEL) as Pace[]).map((k) => (
                      <option key={k} value={k}>
                        {PACE_LABEL[k]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Comfort">
                  <Select value={params.comfort} onChange={(e) => setParams({ ...params, comfort: e.target.value as Comfort })}>
                    {(Object.keys(COMFORT_LABEL) as Comfort[]).map((k) => (
                      <option key={k} value={k}>
                        {COMFORT_LABEL[k]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Departure city">
                  <Select value={params.departureCity} onChange={(e) => setParams({ ...params, departureCity: e.target.value })}>
                    {CITIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Budget (total ₹)">
                  <Input type="number" min={0} step={1000} value={params.budgetINR} onChange={(e) => setParams({ ...params, budgetINR: Number(e.target.value) })} />
                </Field>
              </div>
              <Toggle checked={params.includeFlights} onChange={(v) => setParams({ ...params, includeFlights: v })} label="Include flights" />
            </div>

            {/* Preview */}
            <div className="space-y-3 p-4 md:col-span-3">
              {preview && (
                <>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview · draft v{nextVersion}</p>
                    <p className="font-display text-base font-semibold text-foreground">{preview.title}</p>
                  </div>
                  <ol className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2 text-xs">
                    {preview.days.map((d) => (
                      <li key={d.day} className="flex gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{d.day}</span>
                        <span className="min-w-0">
                          <span className="font-medium text-foreground">{d.title}</span> <span className="text-muted-foreground">· {d.location}</span>
                          {d.stay && <span className="text-muted-foreground"> · {d.stay}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <Card className="flex items-end justify-between gap-3 p-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
                      <p className="font-display text-xl font-semibold">{formatINR(preview.pricing.totalINR)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Per person</p>
                      <p className="text-sm font-semibold">{formatINR(preview.pricing.perPersonINR)}</p>
                    </div>
                  </Card>
                  {budgetPct !== null && (
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>Budget fit</span>
                        <span className={cn("font-medium", budgetPct > 110 ? "text-rose-600" : budgetPct < 85 ? "text-sky-700" : "text-emerald-700")}>
                          {budgetPct}% of {formatINR(params.budgetINR, { compact: true })}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", budgetPct > 110 ? "bg-rose-500" : budgetPct < 85 ? "bg-sky-500" : "bg-emerald-500")} style={{ width: `${Math.min(100, (budgetPct / 150) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
                    <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-brand-800">
                      <Sparkles className="h-3.5 w-3.5" /> AI notes
                    </p>
                    <ul className="space-y-1 text-xs text-brand-900">
                      {preview.rationale.map((r, i) => (
                        <li key={i} className="flex gap-1.5">
                          <Check className="mt-0.5 h-3 w-3 shrink-0" /> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button onClick={save}>Save as draft v{nextVersion}</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      )}
    </Dialog>
  );
}

function PackageCard({ pkg, emoji, onPick, highlight }: { pkg: PackageTemplate; emoji?: string; onPick: () => void; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex min-h-[64px] items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-secondary",
        highlight ? "border-brand-300 bg-brand-50/60" : "border-border bg-card",
      )}
    >
      <span className="text-xl leading-none">{emoji ?? "🧳"}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{pkg.code}</span>
        <span className="block truncate text-sm font-medium text-foreground">{pkg.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>{pkg.nights}N</span>
          <span>from {formatINR(pkg.fromPriceINR, { compact: true })} pp</span>
          {pkg.sourceReel && (
            <span className="inline-flex items-center gap-0.5 rounded bg-pink-100 px-1 text-[10px] font-semibold text-pink-700">
              <Film className="h-3 w-3" /> from reel
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
