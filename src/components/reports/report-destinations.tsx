"use client";

import { Card } from "@/components/ui";
import { BarList, SectionTitle } from "@/components/shared";
import { formatINR } from "@/lib/utils";
import { avg, nextNMonths, monthLabel, nightsOf, pct, sum, type ReportCtx } from "./report-helpers";

export function buildDestinations(ctx: ReportCtx) {
  const { db, enquiries, trips, consultant } = ctx;
  const rows = db.destinations
    .map((d) => {
      const enq = enquiries.filter((e) => e.destinationId === d.id);
      const tr = trips.filter((t) => t.destinationId === d.id);
      const value = sum(tr, (t) => t.totalINR);
      return { id: d.id, emoji: d.emoji, name: d.name, enquiries: enq.length, bookings: tr.length, conversion: pct(tr.length, enq.length), value, avgValue: tr.length ? Math.round(value / tr.length) : 0, avgNights: avg(tr.map(nightsOf)) };
    })
    .sort((a, b) => b.enquiries - a.enquiries);
  const revenueRows = rows.filter((r) => r.value > 0).map((r) => ({ label: `${r.emoji} ${r.name}`, value: r.value })).sort((a, b) => b.value - a.value);
  const months = nextNMonths(6);
  const open = db.enquiries.filter((e) => !["lost", "non_lead", "completed"].includes(e.stage) && (!consultant || e.assignedTo === consultant));
  const demandRows = months.map((m) => ({ label: monthLabel(m), value: open.filter((e) => e.travelMonth === m || (e.travelStart && e.travelStart.slice(0, 7) === m)).length }));
  const table = rows.map((r) => ({ destination: r.name, enquiries: r.enquiries, bookings: r.bookings, conversionPct: r.conversion, bookedValueINR: r.value, avgBookingINR: r.avgValue, avgNights: r.avgNights.toFixed(1) }));
  return { rows, revenueRows, demandRows, table };
}

export function DestinationsTab({ data }: { data: ReturnType<typeof buildDestinations> }) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Destination</th>
                <th className="px-3 py-2 text-right font-semibold">Enquiries</th>
                <th className="px-3 py-2 text-right font-semibold">Bookings</th>
                <th className="px-3 py-2 text-right font-semibold">Conv.</th>
                <th className="px-3 py-2 text-right font-semibold">Booked value</th>
                <th className="px-3 py-2 text-right font-semibold">Avg booking</th>
                <th className="px-3 py-2 text-right font-semibold">Avg nights</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium">
                    <span className="mr-1.5">{r.emoji}</span>
                    {r.name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.enquiries}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.bookings}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.enquiries ? `${r.conversion}%` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.value ? formatINR(r.value, { compact: true }) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.avgValue ? formatINR(r.avgValue, { compact: true }) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.bookings ? r.avgNights.toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Booked value by destination</SectionTitle>
          <BarList rows={data.revenueRows} colorClass="bg-emerald-500" format={(n) => formatINR(n, { compact: true })} />
        </Card>
        <Card className="p-4">
          <SectionTitle>Demand by travel month · open enquiries</SectionTitle>
          <BarList rows={data.demandRows} colorClass="bg-saffron-400" labelWidth="w-20" />
        </Card>
      </div>
    </div>
  );
}
