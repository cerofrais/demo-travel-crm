"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Circle, Plane } from "lucide-react";
import type { Enquiry } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { tripById, userName } from "@/lib/demo/queries";
import { Button, Card } from "@/components/ui";
import { EmptyState, KV, SectionTitle, TripStatusBadge } from "@/components/shared";
import { cn, daysUntil, formatDate, formatINR, paxLabel } from "@/lib/utils";
import { PaymentSchedule } from "@/components/payments/payment-schedule";

export function TripTab({ enquiry: e }: { enquiry: Enquiry }) {
  const db = useDb();
  const trip = tripById(db, e.tripId);
  if (!trip) {
    return (
      <div className="p-4">
        <EmptyState icon={Plane} title="No booking yet" hint="Mark an itinerary accepted or move the enquiry to Advance Paid — the trip, checklist and instalment schedule are created automatically." />
      </div>
    );
  }
  const pct = trip.totalINR ? Math.min(100, Math.round((trip.paidINR / trip.totalINR) * 100)) : 0;
  const days = daysUntil(trip.startDate);
  const done = trip.checklist.filter((c) => c.done).length;
  return (
    <div className="space-y-4 p-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{trip.ref}</span>
              <TripStatusBadge status={trip.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{trip.title}</p>
          </div>
          <Link href={`/trips/${trip.id}`}><Button size="sm" variant="outline">Open trip<ArrowUpRight className="h-3.5 w-3.5" /></Button></Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KV label="Dates" value={`${formatDate(trip.startDate, "short")} → ${formatDate(trip.endDate, "short")}`} />
          <KV label="Departs" value={days < 0 ? `${-days}d ago` : days === 0 ? "Today" : `in ${days}d`} />
          <KV label="Travellers" value={paxLabel(trip.pax)} />
          <KV label="Trip captain" value={trip.tripCaptain ? userName(db, trip.tripCaptain) : "—"} />
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Paid {formatINR(trip.paidINR)} of {formatINR(trip.totalINR)}</span>
            <span className="font-semibold tabular-nums">{pct}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </Card>

      <section>
        <SectionTitle action={<span className="text-xs text-muted-foreground">{done}/{trip.checklist.length} done</span>}>Checklist</SectionTitle>
        <ul className="space-y-1.5">
          {trip.checklist.slice(0, 6).map((c) => (
            <li key={c.key} className="flex items-center gap-2 text-sm">
              {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
              <span className={cn(c.done && "text-muted-foreground line-through")}>{c.label}</span>
              {c.auto && <span className="rounded bg-brand-50 px-1 text-[10px] font-medium text-brand-700">auto</span>}
            </li>
          ))}
          {trip.checklist.length > 6 && <li className="text-xs text-muted-foreground">+{trip.checklist.length - 6} more on the trip page</li>}
        </ul>
      </section>

      <section>
        <SectionTitle>Payments</SectionTitle>
        <PaymentSchedule tripId={trip.id} compact />
      </section>
    </div>
  );
}
