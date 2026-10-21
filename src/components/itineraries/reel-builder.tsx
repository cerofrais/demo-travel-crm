"use client";

import * as React from "react";
import { Film, Sparkles, Save, Check } from "lucide-react";
import type { Comfort, Pace } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { destinationById, logActivity } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { COMFORT_LABEL, PACE_LABEL } from "@/lib/pipeline";
import { formatINR } from "@/lib/utils";
import { Button, Card, Input, Select } from "@/components/ui";
import { Field } from "@/components/shared";
import { ItineraryView } from "./itinerary-view";
import { previewItinerary, slugCode } from "./package-utils";

/** Hero card: paste a reel URL, pick destination/nights/pax, and the itinerary agent rebuilds the closest package. */
export function ReelBuilder({ onToast }: { onToast: (m: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const [url, setUrl] = React.useState("");
  const [destinationId, setDestinationId] = React.useState("bali");
  const [nights, setNights] = React.useState(5);
  const [adults, setAdults] = React.useState(2);
  const [pace, setPace] = React.useState<Pace>("balanced");
  const [comfort, setComfort] = React.useState<Comfort>("comfort");
  const [built, setBuilt] = React.useState<{ pkgId: string; nights: number; adults: number; pace: Pace; comfort: Comfort; url: string } | null>(null);
  const canSave = can(me.role, "itineraries.edit");

  const dest = destinationById(db, destinationId);

  function build() {
    const candidates = db.packages.filter((p) => p.active && p.destinationId === destinationId);
    const pool = candidates.length ? candidates : db.packages.filter((p) => p.active);
    if (pool.length === 0) return;
    // Best match: closest nights, then most sold.
    const best = [...pool].sort((a, b) => Math.abs(a.nights - nights) - Math.abs(b.nights - nights) || b.timesSold - a.timesSold)[0];
    setBuilt({ pkgId: best.id, nights, adults, pace, comfort, url: url.trim() });
  }

  const pkg = built ? db.packages.find((p) => p.id === built.pkgId) : null;
  const pkgDest = pkg ? destinationById(db, pkg.destinationId) : undefined;
  const result = built && pkg && pkgDest ? previewItinerary(pkg, pkgDest, { nights: built.nights, pax: { adults: built.adults, children: 0, infants: 0 }, pace: built.pace, comfort: built.comfort }) : null;

  function saveAsPackage() {
    if (!built || !pkg || !pkgDest || !result) return;
    const id = newId("pkg");
    const code = slugCode(pkgDest, built.nights, `${built.pace}reel`);
    mutateDb((d) => {
      d.packages.unshift({
        id,
        code,
        title: `${pkgDest.name} from reel · ${built.nights}N ${PACE_LABEL[built.pace].toLowerCase()}`,
        destinationId: pkgDest.id,
        nights: built.nights,
        tripTypes: pkg.tripTypes,
        pace: built.pace,
        comfort: built.comfort,
        fromPriceINR: result.generated.pricing.perPersonINR,
        highlights: pkg.highlights,
        days: result.generated.days,
        inclusions: pkg.inclusions,
        exclusions: pkg.exclusions,
        bestMonths: pkgDest.bestMonths,
        tags: [...pkg.tags, "from-reel"],
        active: true,
        sourceReel: built.url || pkg.sourceReel || "instagram.com/reel/demo",
        timesSold: 0,
        createdAt: nowIso(),
      });
      d.agentEvents.unshift({ id: newId("evt"), agent: "itinerary", at: nowIso(), action: "Package built from reel", detail: `${code} rebuilt from ${pkg.code} for ${built.nights}N / ${built.adults} adults / ${built.pace} pace`, confidence: 0.86, status: "info" });
      logActivity(d, { actor: me.name, actorKind: "user", type: "package_created", text: `Saved reel-built package ${code} (${pkgDest.name}, ${built.nights}N)` });
    });
    onToast(`Saved as package ${code}`);
    setBuilt(null);
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-brand-700 to-brand-500 p-4 text-white md:p-5">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/80">
          <Sparkles className="h-3.5 w-3.5" /> Itinerary agent
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold md:text-xl">Build from a reel</h2>
        <p className="text-sm text-white/80">Saw a trip on a reel? Paste the link — we rebuild it for the traveller&apos;s dates, budget and pace.</p>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-7">
        <Field label="Instagram post / reel URL" className="sm:col-span-2">
          <div className="relative">
            <Film className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="instagram.com/reel/…" className="pl-9" />
          </div>
        </Field>
        <Field label="Destination">
          <Select value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
            {db.destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.emoji} {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nights">
          <Input type="number" min={1} max={14} value={nights} onChange={(e) => setNights(Math.max(1, Number(e.target.value)))} />
        </Field>
        <Field label="Adults">
          <Input type="number" min={1} max={12} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))} />
        </Field>
        <Field label="Pace">
          <Select value={pace} onChange={(e) => setPace(e.target.value as Pace)}>
            {(Object.keys(PACE_LABEL) as Pace[]).map((p) => (
              <option key={p} value={p}>
                {PACE_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Comfort">
          <Select value={comfort} onChange={(e) => setComfort(e.target.value as Comfort)}>
            {(Object.keys(COMFORT_LABEL) as Comfort[]).map((c) => (
              <option key={c} value={c}>
                {COMFORT_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end sm:col-span-2 lg:col-span-7">
          <Button onClick={build} className="w-full md:w-auto">
            <Sparkles className="h-4 w-4" /> Rebuild for these dates
          </Button>
          {dest && <span className="ml-3 hidden text-xs text-muted-foreground md:inline">Matches against {db.packages.filter((p) => p.active && p.destinationId === destinationId).length} {dest.name} packages</span>}
        </div>
      </div>

      {result && pkg && pkgDest && (
        <div className="border-t border-border p-4">
          <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-3">
            <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-brand-800">
              <Sparkles className="h-3.5 w-3.5" /> Rebuilt from reel for your dates, budget and pace
            </p>
            <ul className="space-y-1 text-xs text-brand-900">
              <li className="flex gap-1.5">
                <Check className="mt-0.5 h-3 w-3 shrink-0" /> Matched {built?.url ? "the reel" : "your request"} to <span className="font-medium">{pkg.code}</span> — {pkg.title}
                {pkg.sourceReel && ` (originally from ${pkg.sourceReel})`}.
              </li>
              {result.generated.rationale.map((r, i) => (
                <li key={i} className="flex gap-1.5">
                  <Check className="mt-0.5 h-3 w-3 shrink-0" /> {r}
                </li>
              ))}
              <li className="flex gap-1.5">
                <Check className="mt-0.5 h-3 w-3 shrink-0" /> Priced at {formatINR(result.generated.pricing.totalINR)} total ({formatINR(result.generated.pricing.perPersonINR)} per person).
              </li>
            </ul>
            {canSave && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={saveAsPackage}>
                  <Save className="h-4 w-4" /> Save as package
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBuilt(null)}>
                  Discard
                </Button>
              </div>
            )}
          </div>
          <ItineraryView itinerary={result.itinerary} destination={pkgDest} compact />
        </div>
      )}
    </Card>
  );
}
