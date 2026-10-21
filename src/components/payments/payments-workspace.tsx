"use client";

import * as React from "react";
import Link from "next/link";
import { IndianRupee, AlertCircle, CalendarClock, Undo2, Wallet, Building2, TrendingUp, Search } from "lucide-react";
import type { Payment } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { enquiryById, travellerById, tripById, userName } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { cn, formatINR, formatDate, daysUntil } from "@/lib/utils";
import { Card, Input, ScrollableTabs, Select } from "@/components/ui";
import { BarList, EmptyState, PaymentStatusBadge, SectionTitle, StatCard, useToast } from "@/components/shared";
import { PageHeader } from "@/components/app/page-header";
import { PaymentRowActions, effectiveStatus } from "./payment-schedule";
import { PAYMENT_MODE_LABEL, startOfWeek } from "@/components/ops/helpers";

type Tab = "all" | "due" | "overdue" | "paid" | "refunded";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "due", label: "Due" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "refunded", label: "Refunded" },
];

interface Row {
  p: Payment;
  status: Payment["status"];
  trip?: ReturnType<typeof tripById>;
  traveller?: ReturnType<typeof travellerById>;
  consultant?: string;
}

export function PaymentsWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const { toast, node } = useToast();
  const [tab, setTab] = React.useState<Tab>("all");
  const [consultant, setConsultant] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [q, setQ] = React.useState("");
  const manage = can(me.role, "payments.manage");
  const now = new Date();

  const rows = React.useMemo<Row[]>(
    () =>
      db.payments.map((p) => {
        const trip = tripById(db, p.tripId);
        const enquiry = enquiryById(db, trip?.enquiryId);
        return { p, status: effectiveStatus(p, now), trip, traveller: travellerById(db, p.travellerId), consultant: enquiry?.assignedTo };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db],
  );

  const stats = React.useMemo(() => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const collected = rows.filter((r) => r.status === "paid" && r.p.paidAt && new Date(r.p.paidAt) >= monthStart).reduce((s, r) => s + r.p.amountINR, 0);
    const outstanding = rows.filter((r) => r.status === "pending" || r.status === "overdue").reduce((s, r) => s + r.p.amountINR, 0);
    const overdue = rows.filter((r) => r.status === "overdue").reduce((s, r) => s + r.p.amountINR, 0);
    const next7 = rows.filter((r) => r.status === "pending" && daysUntil(r.p.dueAt, now) >= 0 && daysUntil(r.p.dueAt, now) <= 7).reduce((s, r) => s + r.p.amountINR, 0);
    const refunds = db.trips.reduce((s, t) => s + (t.refundINR ?? 0), 0);
    return { collected, outstanding, overdue, next7, refunds, overdueCount: rows.filter((r) => r.status === "overdue").length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, db.trips]);

  const filtered = rows
    .filter((r) => {
      if (tab === "due") return r.status === "pending";
      if (tab === "overdue") return r.status === "overdue";
      if (tab === "paid") return r.status === "paid";
      if (tab === "refunded") return r.status === "refunded";
      return true;
    })
    .filter((r) => !consultant || r.consultant === consultant)
    .filter((r) => !destination || r.trip?.destinationId === destination)
    .filter((r) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return [r.trip?.ref, r.traveller?.fullName, r.p.label, r.p.invoiceNo, r.p.reference].some((x) => x?.toLowerCase().includes(needle));
    })
    .sort((a, b) => {
      const order = { overdue: 0, pending: 1, failed: 2, paid: 3, refunded: 4 } as Record<string, number>;
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.status === "paid" ? (b.p.paidAt ?? "").localeCompare(a.p.paidAt ?? "") : a.p.dueAt.localeCompare(b.p.dueAt);
    });

  const counts: Record<Tab, number> = {
    all: rows.length,
    due: rows.filter((r) => r.status === "pending").length,
    overdue: rows.filter((r) => r.status === "overdue").length,
    paid: rows.filter((r) => r.status === "paid").length,
    refunded: rows.filter((r) => r.status === "refunded").length,
  };

  const consultants = db.users.filter((u) => u.role === "SALES" || u.role === "MANAGER" || u.role === "ADMIN");
  const payables = [...db.suppliers].filter((s) => s.payableINR > 0).sort((a, b) => b.payableINR - a.payableINR);
  const payableTotal = payables.reduce((s, x) => s + x.payableINR, 0);

  const forecast = React.useMemo(() => {
    const start = startOfWeek(now);
    return Array.from({ length: 6 }, (_, i) => {
      const from = new Date(start.getTime() + i * 7 * 86400000);
      const to = new Date(from.getTime() + 7 * 86400000);
      const value = rows.filter((r) => (r.status === "pending" || (i === 0 && r.status === "overdue")) && (i === 0 ? new Date(r.p.dueAt) < to : new Date(r.p.dueAt) >= from && new Date(r.p.dueAt) < to)).reduce((s, r) => s + r.p.amountINR, 0);
      return { label: i === 0 ? "This week (+overdue)" : i === 1 ? "Next week" : `Wk of ${formatDate(from, "short")}`, value };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  return (
    <>
      {node}
      <PageHeader title="Payments & Collections" subtitle="Instalments, reminders, invoices and supplier payables.">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ref, traveller, invoice" className="pl-9" />
        </div>
      </PageHeader>

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Collected this month" value={formatINR(stats.collected, { compact: true })} icon={Wallet} tint="text-emerald-600" />
          <StatCard label="Outstanding" value={formatINR(stats.outstanding, { compact: true })} icon={IndianRupee} tint="text-amber-600" hint={`${counts.due + counts.overdue} instalments`} />
          <StatCard label="Overdue" value={formatINR(stats.overdue, { compact: true })} icon={AlertCircle} tint="text-rose-600" hint={`${stats.overdueCount} instalments`} />
          <StatCard label="Due next 7 days" value={formatINR(stats.next7, { compact: true })} icon={CalendarClock} tint="text-sky-600" />
          <StatCard label="Refunds" value={formatINR(stats.refunds, { compact: true })} icon={Undo2} tint="text-muted-foreground" hint="On cancelled trips" />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="overflow-hidden xl:col-span-2">
            <ScrollableTabs tabs={TABS.map((t) => ({ key: t.key, label: `${t.label} (${counts[t.key]})` }))} active={tab} onChange={(k) => setTab(k as Tab)} />
            <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row">
              <Select value={consultant} onChange={(e) => setConsultant(e.target.value)} className="sm:w-48">
                <option value="">All consultants</option>
                {consultants.map((u) => (
                  <option key={u.sub} value={u.sub}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <Select value={destination} onChange={(e) => setDestination(e.target.value)} className="sm:w-48">
                <option value="">All destinations</option>
                {db.destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.emoji} {d.name}
                  </option>
                ))}
              </Select>
              <span className="self-center text-xs text-muted-foreground sm:ml-auto">
                {filtered.length} rows · {formatINR(filtered.reduce((s, r) => s + r.p.amountINR, 0), { compact: true })}
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={IndianRupee} title="Nothing here" hint="No instalments match these filters." />
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-secondary/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Trip</th>
                        <th className="px-3 py-2 font-semibold">Traveller</th>
                        <th className="px-3 py-2 font-semibold">Instalment</th>
                        <th className="px-3 py-2 text-right font-semibold">Amount</th>
                        <th className="px-3 py-2 font-semibold">Due</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Paid</th>
                        {manage && <th className="px-3 py-2 font-semibold">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((r) => (
                        <tr key={r.p.id} className={cn(r.status === "overdue" && "bg-rose-50/40")}>
                          <td className="px-3 py-2.5">
                            {r.trip ? (
                              <Link href={`/trips/${r.trip.id}`} className="font-medium text-brand-700 hover:underline">
                                {r.trip.ref}
                              </Link>
                            ) : (
                              "—"
                            )}
                            <p className="text-xs text-muted-foreground">{r.trip?.destination}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="text-foreground">{r.traveller?.fullName ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">{userName(db, r.consultant)}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="text-foreground">{r.p.label}</p>
                            {r.p.invoiceNo && <p className="text-[11px] text-muted-foreground">{r.p.invoiceNo}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatINR(r.p.amountINR)}</td>
                          <td className={cn("px-3 py-2.5 whitespace-nowrap", r.status === "overdue" && "font-medium text-rose-600")}>
                            {formatDate(r.p.dueAt, "short")}
                            {r.p.reminderCount > 0 && <p className="text-[11px] font-normal text-muted-foreground">{r.p.reminderCount} reminder{r.p.reminderCount === 1 ? "" : "s"}</p>}
                          </td>
                          <td className="px-3 py-2.5">
                            <PaymentStatusBadge status={r.status} />
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
                            {r.p.paidAt ? (
                              <>
                                {formatDate(r.p.paidAt, "short")}
                                <br />
                                {r.p.mode && PAYMENT_MODE_LABEL[r.p.mode]} {r.p.reference && `· ${r.p.reference}`}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          {manage && (
                            <td className="px-3 py-2.5">
                              <PaymentRowActions payment={r.p} onToast={toast} compact />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-border md:hidden">
                  {filtered.map((r) => (
                    <li key={r.p.id} className={cn("space-y-2 p-3", r.status === "overdue" && "bg-rose-50/40")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{r.traveller?.fullName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.trip ? (
                              <Link href={`/trips/${r.trip.id}`} className="text-brand-700">
                                {r.trip.ref}
                              </Link>
                            ) : (
                              "—"
                            )}{" "}
                            · {r.p.label}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{formatINR(r.p.amountINR)}</p>
                          <PaymentStatusBadge status={r.status} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Due {formatDate(r.p.dueAt, "short")}
                        {r.p.paidAt && ` · paid ${formatDate(r.p.paidAt, "short")}${r.p.mode ? ` via ${PAYMENT_MODE_LABEL[r.p.mode]}` : ""}`}
                        {r.p.invoiceNo && ` · ${r.p.invoiceNo}`}
                      </p>
                      {manage && <PaymentRowActions payment={r.p} onToast={toast} />}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <div className="space-y-6">
            <Card className="p-4">
              <SectionTitle action={<span className="text-xs font-semibold text-foreground">{formatINR(payableTotal, { compact: true })}</span>}>
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-brand-600" /> Supplier payables
                </span>
              </SectionTitle>
              {payables.length === 0 ? (
                <p className="text-sm text-muted-foreground">All suppliers settled.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {payables.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <div className="min-w-0">
                        <Link href={`/suppliers?supplier=${s.id}`} className="truncate font-medium text-foreground hover:underline">
                          {s.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{s.paymentTerms}</p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{formatINR(s.payableINR)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-4">
              <SectionTitle>
                <span className="inline-flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-brand-600" /> Collections forecast · 6 weeks
                </span>
              </SectionTitle>
              <BarList rows={forecast} format={(n) => formatINR(n, { compact: true })} labelWidth="w-36" />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
