"use client";

import { Card } from "@/components/ui";
import { BarList, SectionTitle } from "@/components/shared";
import { formatINR } from "@/lib/utils";
import { lastNMonths, monthKey, monthLabel, pct, sum, type ReportCtx } from "./report-helpers";

export function buildRevenue(ctx: ReportCtx) {
  const { db, trips, consultant, canAll } = ctx;
  const months = lastNMonths(6);
  const allTrips = db.trips.filter((t) => !consultant || db.enquiries.find((e) => e.id === t.enquiryId)?.assignedTo === consultant);
  const monthly = months.map((m) => ({ label: monthLabel(m), value: sum(allTrips.filter((t) => monthKey(t.createdAt) === m && t.status !== "cancelled"), (t) => t.totalINR) }));
  const tripIds = new Set(trips.map((t) => t.id));
  const pays = db.payments.filter((p) => tripIds.has(p.tripId));
  const collected = sum(pays.filter((p) => p.status === "paid"), (p) => p.amountINR);
  const outstanding = sum(pays.filter((p) => p.status === "pending" || p.status === "overdue"), (p) => p.amountINR);
  const overdue = sum(pays.filter((p) => p.status === "overdue"), (p) => p.amountINR);
  const refunds = sum(pays.filter((p) => p.status === "refunded"), (p) => p.amountINR) + sum(trips, (t) => t.refundINR ?? 0);
  const booked = sum(trips.filter((t) => t.status !== "cancelled"), (t) => t.totalINR);
  const margin = canAll ? sum(trips.filter((t) => t.status !== "cancelled"), (t) => t.marginINR) : null;
  const payables = sum(db.suppliers, (s) => s.payableINR);
  const cancelled = trips.filter((t) => t.status === "cancelled").length;
  const cancellationRate = pct(cancelled, trips.length);
  const table = monthly.map((m) => ({ month: m.label, bookedValueINR: m.value }));
  return { monthly, collected, outstanding, overdue, refunds, booked, margin, payables, cancelled, cancellationRate, tripCount: trips.length, table };
}

export function RevenueTab({ data }: { data: ReturnType<typeof buildRevenue> }) {
  const tiles: { label: string; value: string; sub?: string; tone?: string }[] = [
    { label: "Booked value in range", value: formatINR(data.booked, { compact: true }), sub: `${data.tripCount} trips` },
    { label: "Collected", value: formatINR(data.collected, { compact: true }), tone: "text-emerald-700" },
    { label: "Outstanding", value: formatINR(data.outstanding, { compact: true }), sub: data.overdue ? `${formatINR(data.overdue, { compact: true })} overdue` : "nothing overdue", tone: data.overdue ? "text-rose-600" : undefined },
    { label: "Refunds", value: formatINR(data.refunds, { compact: true }) },
    ...(data.margin !== null ? [{ label: "Margin", value: formatINR(data.margin, { compact: true }), sub: data.booked ? `${pct(data.margin, data.booked)}% of booked` : undefined, tone: "text-brand-700" }] : []),
    { label: "Supplier payables", value: formatINR(data.payables, { compact: true }), sub: "all open suppliers" },
    { label: "Cancellation rate", value: `${data.cancellationRate}%`, sub: `${data.cancelled} cancelled` },
  ];
  const paidPct = data.collected + data.outstanding ? Math.round((data.collected / (data.collected + data.outstanding)) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
            <div className={"font-display text-xl font-semibold " + (t.tone ?? "")}>{t.value}</div>
            {t.sub && <div className="text-xs text-muted-foreground">{t.sub}</div>}
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Monthly booked value · last 6 months</SectionTitle>
          <BarList rows={data.monthly} colorClass="bg-brand-500" labelWidth="w-20" format={(n) => formatINR(n, { compact: true })} />
        </Card>
        <Card className="p-4">
          <SectionTitle>Collected vs outstanding</SectionTitle>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${100 - paidPct}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" /> Collected {formatINR(data.collected, { compact: true })} ({paidPct}%)
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" /> Outstanding {formatINR(data.outstanding, { compact: true })}
            </span>
          </div>
          {data.margin === null && <p className="mt-4 text-xs text-muted-foreground">Margin is visible to Admin, Manager and Finance only.</p>}
        </Card>
      </div>
    </div>
  );
}
