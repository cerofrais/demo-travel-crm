"use client";

import * as React from "react";
import { BedDouble, Plane, Car, Sparkles, Check, X as XIcon, Moon, Users } from "lucide-react";
import type { Destination, Itinerary, ItineraryStatus } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { destinationById } from "@/lib/demo/queries";
import { PACE_LABEL, COMFORT_LABEL } from "@/lib/pipeline";
import { cn, formatINR, formatDate, formatTime, paxLabel } from "@/lib/utils";
import { Badge, Card } from "@/components/ui";

export const ITINERARY_STATUS_CLASS: Record<ItineraryStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  sent: "bg-sky-100 text-sky-800",
  viewed: "bg-indigo-100 text-indigo-800",
  accepted: "bg-emerald-100 text-emerald-800",
  revised: "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-700",
};

export function ItineraryStatusBadge({ status }: { status: ItineraryStatus }) {
  return <Badge className={cn("capitalize", ITINERARY_STATUS_CLASS[status])}>{status}</Badge>;
}

function MealDots({ meals }: { meals: { b: boolean; l: boolean; d: boolean } }) {
  const items: [string, boolean][] = [
    ["B", meals.b],
    ["L", meals.l],
    ["D", meals.d],
  ];
  return (
    <span className="inline-flex items-center gap-1" title="Meals: breakfast / lunch / dinner">
      {items.map(([k, on]) => (
        <span
          key={k}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold",
            on ? "border-brand-500 bg-brand-100 text-brand-800" : "border-border text-muted-foreground/60",
          )}
        >
          {k}
        </span>
      ))}
    </span>
  );
}

/**
 * Read-only day-by-day itinerary view. Cross-area contract component — the
 * enquiry drawer, trip detail and package library all render it.
 */
export function ItineraryView({ itinerary, destination, compact = false }: { itinerary: Itinerary; destination?: Destination; compact?: boolean }) {
  const db = useDb();
  const me = useCurrentUser();
  const dest = destination ?? destinationById(db, itinerary.destinationId);
  const showMargin = me.role === "ADMIN" || me.role === "MANAGER" || me.role === "FINANCE";
  const p = itinerary.pricing;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {dest && <span className="text-2xl leading-none">{dest.emoji}</span>}
            <h2 className="font-display text-lg font-semibold leading-tight text-foreground">{itinerary.title}</h2>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Moon className="h-3.5 w-3.5" /> {itinerary.nights}N / {itinerary.nights + 1}D
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {paxLabel(itinerary.pax)}
            </span>
            {itinerary.startDate && <span>From {formatDate(itinerary.startDate)}</span>}
            {itinerary.generatedByAI && (
              <span className="inline-flex items-center gap-1 text-brand-700">
                <Sparkles className="h-3.5 w-3.5" /> AI-built
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className="bg-secondary text-secondary-foreground">{PACE_LABEL[itinerary.pace]} pace</Badge>
          <Badge className="bg-secondary text-secondary-foreground">{COMFORT_LABEL[itinerary.comfort]}</Badge>
          <ItineraryStatusBadge status={itinerary.status} />
          <Badge className="border border-border bg-card text-muted-foreground">v{itinerary.version}</Badge>
        </div>
      </div>

      {/* Day-by-day timeline */}
      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Day by day</h3>
        <ol className="relative space-y-4 border-l border-border pl-6">
          {itinerary.days.map((d) => (
            <li key={d.day} className="relative">
              <span className="absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground ring-4 ring-background">
                {d.day}
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-semibold text-foreground">{d.title}</p>
                <p className="text-xs text-muted-foreground">{d.location}</p>
              </div>
              {!compact && <p className="mt-0.5 text-sm text-muted-foreground">{d.summary}</p>}
              {d.activities.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {d.activities.map((a, i) => (
                    <span key={`${a}-${i}`} className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">
                      {a}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <MealDots meals={d.meals} />
                {d.stay && (
                  <span className="inline-flex items-center gap-1">
                    <BedDouble className="h-3.5 w-3.5" /> {d.stay}
                  </span>
                )}
                {d.transfer && (
                  <span className="inline-flex items-center gap-1">
                    <Car className="h-3.5 w-3.5" /> {d.transfer}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Stays */}
      {itinerary.stays.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stays</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {itinerary.stays.map((s) => (
              <Card key={s.id} className="flex items-start gap-3 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                  <BedDouble className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.category} · {s.roomType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.checkIn ? `${formatDate(s.checkIn, "short")} → ${formatDate(s.checkOut, "short")}` : s.location}
                  </p>
                  {s.confirmationNo && <p className="mt-0.5 text-[11px] font-medium text-emerald-700">Conf. {s.confirmationNo}</p>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Flights */}
      {!compact && itinerary.flights.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Flights</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {itinerary.flights.map((f) => (
              <Card key={f.id} className="flex items-start gap-3 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                  <Plane className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {f.airline} {f.flightNo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.from} {formatTime(f.departAt)} → {f.to} {formatTime(f.arriveAt)} · {formatDate(f.departAt, "short")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{f.baggage}</p>
                  {f.pnr && <p className="mt-0.5 text-[11px] font-medium text-emerald-700">PNR {f.pnr}</p>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Inclusions / exclusions */}
      {!compact && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Inclusions</h3>
            <ul className="space-y-1">
              {itinerary.inclusions.map((x, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {x}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Exclusions</h3>
            <ul className="space-y-1">
              {itinerary.exclusions.map((x, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" /> {x}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Pricing */}
      <Card className="p-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pricing</h3>
        <div className="space-y-1">
          {p.breakdown.map((b) => (
            <div key={b.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{b.label}</span>
              <span className="tabular-nums text-foreground">{formatINR(b.amountINR)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-border pt-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="font-display text-2xl font-semibold text-foreground">{formatINR(p.totalINR)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Per person</p>
            <p className="text-base font-semibold text-foreground">{formatINR(p.perPersonINR)}</p>
          </div>
        </div>
        {showMargin && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-secondary px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              Margin <span className="font-semibold text-emerald-700">{formatINR(p.marginINR)}</span>{" "}
              <span className="text-muted-foreground">({p.totalINR ? Math.round((p.marginINR / p.totalINR) * 100) : 0}%)</span>
            </span>
            <span className="text-muted-foreground">
              GST <span className="font-semibold text-foreground">{formatINR(p.gstINR)}</span>
            </span>
            <span className="ml-auto text-muted-foreground">Internal — not shown to traveller</span>
          </div>
        )}
      </Card>
    </div>
  );
}
