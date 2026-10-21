"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlaneTakeoff, MapPin, FileWarning, IndianRupee, Search, CalendarDays, ChevronRight } from "lucide-react";
import type { Trip, TripStatus } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { travellerById, userName, destinationById } from "@/lib/demo/queries";
import { TRIP_STATUS_CLASS, TRIP_STATUS_LABEL } from "@/lib/pipeline";
import { cn, formatINR, formatDate, paxCount, daysUntil } from "@/lib/utils";
import { Avatar, Card, Input, ScrollableTabs } from "@/components/ui";
import { StatCard, TripStatusBadge, EmptyState } from "@/components/shared";
import { PageHeader } from "@/components/app/page-header";
import { startOfWeek, tripTiming, tripNights } from "@/components/ops/helpers";

type Tab = "all" | "upcoming" | "on_trip" | "completed" | "cancelled";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "on_trip", label: "On trip" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const UPCOMING: TripStatus[] = ["confirmed", "docs_pending", "ready"];

export function TripsWorkspace() {
  const db = useDb();
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("all");
  const [q, setQ] = React.useState("");
  const now = new Date();

  const trips = React.useMemo(() => [...db.trips].sort((a, b) => a.startDate.localeCompare(b.startDate)), [db.trips]);

  const stats = React.useMemo(() => {
    const upcoming30 = trips.filter((t) => UPCOMING.includes(t.status) && daysUntil(t.startDate, now) >= 0 && daysUntil(t.startDate, now) <= 30).length;
    const onTrip = trips.filter((t) => t.status === "on_trip").length;
    const docsPending = trips.filter((t) => UPCOMING.includes(t.status) && t.checklist.some((c) => !c.done && ["passports", "visa", "insurance"].includes(c.key))).length;
    const outstanding = trips.filter((t) => t.status !== "cancelled" && t.status !== "completed").reduce((s, t) => s + Math.max(0, t.totalINR - t.paidINR), 0);
    return { upcoming30, onTrip, docsPending, outstanding };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return trips
      .filter((t) => {
        if (tab === "upcoming") return UPCOMING.includes(t.status);
        if (tab === "on_trip") return t.status === "on_trip";
        if (tab === "completed") return t.status === "completed";
        if (tab === "cancelled") return t.status === "cancelled";
        return true;
      })
      .filter((t) => {
        if (!needle) return true;
        const trav = travellerById(db, t.travellerId);
        return [t.ref, t.title, t.destination, trav?.fullName, trav?.phone, trav?.city].some((x) => x?.toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        // Live and upcoming first (soonest), then the rest newest-first.
        const ra = rank(a, now);
        const rb = rank(b, now);
        if (ra !== rb) return ra - rb;
        return ra === 2 ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips, tab, q, db]);

  const counts: Record<Tab, number> = {
    all: trips.length,
    upcoming: trips.filter((t) => UPCOMING.includes(t.status)).length,
    on_trip: trips.filter((t) => t.status === "on_trip").length,
    completed: trips.filter((t) => t.status === "completed").length,
    cancelled: trips.filter((t) => t.status === "cancelled").length,
  };

  return (
    <>
      <PageHeader title="Trips" subtitle="Confirmed bookings — departures, docs, payments and the on-trip loop.">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ref, traveller, destination" className="pl-9" />
        </div>
      </PageHeader>

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Departures · 30 days" value={stats.upcoming30} icon={PlaneTakeoff} hint="Confirmed, docs pending or ready" />
          <StatCard label="On trip now" value={stats.onTrip} icon={MapPin} tint="text-brand-500" hint="Mid-trip check-ins due" />
          <StatCard label="Docs pending" value={stats.docsPending} icon={FileWarning} tint="text-amber-600" hint="Passports, visa or insurance open" />
          <StatCard label="Balance outstanding" value={formatINR(stats.outstanding, { compact: true })} icon={IndianRupee} tint="text-rose-600" hint="Across upcoming & live trips" />
        </div>

        <DepartureCalendar trips={trips} />

        <Card className="overflow-hidden">
          <ScrollableTabs tabs={TABS.map((t) => ({ key: t.key, label: `${t.label} (${counts[t.key]})` }))} active={tab} onChange={(k) => setTab(k as Tab)} />
          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={PlaneTakeoff} title="No trips here" hint={q ? "Try a different search." : "Bookings appear once an enquiry's advance is paid."} />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Trip</th>
                      <th className="px-3 py-2 font-semibold">Traveller</th>
                      <th className="px-3 py-2 font-semibold">Dates</th>
                      <th className="px-3 py-2 font-semibold">Pax</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Paid</th>
                      <th className="px-3 py-2 font-semibold">Checklist</th>
                      <th className="px-3 py-2 font-semibold">Captain</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((t) => {
                      const trav = travellerById(db, t.travellerId);
                      const dest = destinationById(db, t.destinationId);
                      const timing = tripTiming(t, now);
                      const done = t.checklist.filter((c) => c.done).length;
                      const pct = t.totalINR ? Math.min(100, Math.round((t.paidINR / t.totalINR) * 100)) : 0;
                      return (
                        <tr key={t.id} onClick={() => router.push(`/trips/${t.id}`)} className="cursor-pointer transition-colors hover:bg-secondary/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg leading-none">{dest?.emoji ?? "🧳"}</span>
                              <div className="min-w-0">
                                <p className="whitespace-nowrap font-medium text-foreground">{t.ref}</p>
                                <p className="truncate text-xs text-muted-foreground">{t.destination} · {tripNights(t)}N</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar name={trav?.fullName} className="h-7 w-7" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{trav?.fullName ?? "—"}</p>
                                <p className="text-xs text-muted-foreground">{trav?.city}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <p className="text-foreground">
                              {formatDate(t.startDate, "short")} – {formatDate(t.endDate, "short")}
                            </p>
                            <p className={cn("text-xs", timing.tone === "live" ? "font-medium text-brand-700" : "text-muted-foreground")}>{timing.label}</p>
                          </td>
                          <td className="px-3 py-3 tabular-nums">{paxCount(t.pax)}</td>
                          <td className="px-3 py-3">
                            <TripStatusBadge status={t.status} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="w-28">
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{formatINR(t.paidINR, { compact: true })}</span>
                                <span>{formatINR(t.totalINR, { compact: true })}</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 tabular-nums text-muted-foreground">
                            <span className={cn(done === t.checklist.length && "text-emerald-700")}>
                              {done}/{t.checklist.length}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{userName(db, t.tripCaptain)}</td>
                          <td className="px-2 py-3 text-muted-foreground">
                            <ChevronRight className="h-4 w-4" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phone cards */}
              <ul className="divide-y divide-border md:hidden">
                {filtered.map((t) => {
                  const trav = travellerById(db, t.travellerId);
                  const dest = destinationById(db, t.destinationId);
                  const timing = tripTiming(t, now);
                  const done = t.checklist.filter((c) => c.done).length;
                  const pct = t.totalINR ? Math.min(100, Math.round((t.paidINR / t.totalINR) * 100)) : 0;
                  return (
                    <li key={t.id}>
                      <Link href={`/trips/${t.id}`} className="block p-4 active:bg-secondary/60">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-xl leading-none">{dest?.emoji ?? "🧳"}</span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{trav?.fullName ?? t.ref}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {t.ref} · {t.destination} · {paxCount(t.pax)} pax
                              </p>
                            </div>
                          </div>
                          <TripStatusBadge status={t.status} />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-foreground">
                            {formatDate(t.startDate, "short")} – {formatDate(t.endDate, "short")}
                          </span>
                          <span className={cn(timing.tone === "live" ? "font-medium text-brand-700" : "text-muted-foreground")}>{timing.label}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${pct}%` }} />
                          </div>
                          <span>{pct}% paid</span>
                          <span>
                            ✓ {done}/{t.checklist.length}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

function rank(t: Trip, now: Date): number {
  if (t.status === "on_trip") return 0;
  if (UPCOMING.includes(t.status) && daysUntil(t.startDate, now) >= 0) return 1;
  return 2;
}

function DepartureCalendar({ trips }: { trips: Trip[] }) {
  const db = useDb();
  const weeks = React.useMemo(() => {
    const start = startOfWeek(new Date());
    return Array.from({ length: 8 }, (_, i) => {
      const from = new Date(start.getTime() + i * 7 * 86400000);
      const to = new Date(from.getTime() + 7 * 86400000);
      const items = trips.filter((t) => t.status !== "cancelled" && new Date(t.startDate) >= from && new Date(t.startDate) < to);
      return { from, to, items };
    });
  }, [trips]);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarDays className="h-4 w-4 text-brand-600" /> Departure calendar · next 8 weeks
        </h3>
        <span className="text-xs text-muted-foreground">{weeks.reduce((s, w) => s + w.items.length, 0)} departures</span>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-thin">
        <div className="flex min-w-max gap-2">
          {weeks.map((w, i) => (
            <div key={i} className={cn("w-40 shrink-0 rounded-lg border p-2", i === 0 ? "border-brand-300 bg-brand-50/60" : "border-border bg-secondary/40")}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {i === 0 ? "This week" : i === 1 ? "Next week" : `Wk of ${formatDate(w.from, "short")}`}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatDate(w.from, "short")} – {formatDate(new Date(w.to.getTime() - 86400000), "short")}
              </p>
              <div className="mt-2 space-y-1">
                {w.items.length === 0 && <p className="text-[11px] text-muted-foreground/70">No departures</p>}
                {w.items.map((t) => {
                  const trav = travellerById(db, t.travellerId);
                  const dest = destinationById(db, t.destinationId);
                  return (
                    <Link key={t.id} href={`/trips/${t.id}`} className={cn("flex min-h-[36px] items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium leading-tight hover:opacity-90", TRIP_STATUS_CLASS[t.status])} title={`${t.ref} · ${TRIP_STATUS_LABEL[t.status]}`}>
                      <span>{dest?.emoji}</span>
                      <span className="min-w-0 flex-1 truncate">{trav?.fullName.split(" ")[0] ?? t.ref}</span>
                      <span className="opacity-70">{formatDate(t.startDate, "short").split(" ")[0]}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
