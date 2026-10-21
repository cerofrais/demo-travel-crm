"use client";

import { Card } from "@/components/ui";
import { BarList, SectionTitle } from "@/components/shared";
import { SOURCE_LABEL, SOURCE_SHORT, STAGES, STAGE_MAP } from "@/lib/pipeline";
import { cn, formatINR } from "@/lib/utils";
import type { LeadSource } from "@/lib/demo/types";
import { sum, type ReportCtx } from "./report-helpers";

const COLS = STAGES.filter((s) => s.board);

export function buildSources(ctx: ReportCtx) {
  const { db, enquiries, trips } = ctx;
  const sources = Object.keys(SOURCE_LABEL) as LeadSource[];
  const matrix = sources.map((src) => {
    const rows = enquiries.filter((e) => e.source === src);
    const cells = COLS.map((s) => rows.filter((e) => e.stage === s.id).length);
    const srcTrips = trips.filter((t) => db.enquiries.find((e) => e.id === t.enquiryId)?.source === src);
    return { src, label: SOURCE_LABEL[src], cells, total: rows.length, bookings: srcTrips.length, value: sum(srcTrips, (t) => t.totalINR) };
  });
  const leadRows = matrix.filter((r) => r.total > 0).map((r) => ({ label: SOURCE_SHORT[r.src], value: r.total })).sort((a, b) => b.value - a.value);
  const table = matrix.map((r) => ({ source: r.label, ...Object.fromEntries(COLS.map((c, i) => [c.label, r.cells[i]])), total: r.total, bookings: r.bookings, bookedValueINR: r.value }));
  return { matrix, leadRows, table };
}

export function SourcesTab({ data }: { data: ReturnType<typeof buildSources> }) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="p-4 pb-2">
          <SectionTitle>Source × stage</SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-secondary/60 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Source</th>
                {COLS.map((c) => (
                  <th key={c.id} className={cn("px-2 py-2 text-right font-semibold", c.won && "text-emerald-700")}>
                    {c.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-right font-semibold">Bookings</th>
                <th className="px-3 py-2 text-right font-semibold">Booked value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.matrix.map((r) => (
                <tr key={r.src} className={cn(r.total === 0 && "text-muted-foreground")}>
                  <td className="px-4 py-2 font-medium">{r.label}</td>
                  {r.cells.map((n, i) => (
                    <td key={i} className={cn("px-2 py-2 text-right tabular-nums", n > 0 && COLS[i].won && "bg-emerald-50 font-semibold text-emerald-800", n === 0 && "text-muted-foreground/50")}>
                      {n}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.bookings}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.value ? formatINR(r.value, { compact: true }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[11px] text-muted-foreground">Won stages ({STAGES.filter((s) => s.won).map((s) => STAGE_MAP[s.id].label).join(", ")}) highlighted in green.</p>
      </Card>
      <Card className="p-4">
        <SectionTitle>Leads by source</SectionTitle>
        <BarList rows={data.leadRows} colorClass="bg-clay-500" />
      </Card>
    </div>
  );
}
