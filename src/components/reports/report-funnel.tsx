"use client";

import { Card } from "@/components/ui";
import { BarList, SectionTitle } from "@/components/shared";
import { STAGES, stageIndex, WON_STAGES } from "@/lib/pipeline";
import { avg, median, pct, type ReportCtx } from "./report-helpers";

export function buildFunnel(ctx: ReportCtx) {
  const { db, enquiries } = ctx;
  const real = enquiries.filter((e) => e.stage !== "non_lead");
  const stageRows = STAGES.map((s) => ({ label: s.label, value: enquiries.filter((e) => e.stage === s.id).length, color: s.accent }));
  const reached = (stage: Parameters<typeof stageIndex>[0]) => real.filter((e) => e.stage !== "lost" && stageIndex(e.stage) >= stageIndex(stage)).length;
  const withItinerary = real.filter((e) => db.itineraries.some((i) => i.enquiryId === e.id)).length;
  const won = real.filter((e) => WON_STAGES.includes(e.stage)).length;
  const qualified = Math.max(reached("qualified"), withItinerary);
  const kpis = [
    { label: "Enquiry → Qualified", value: pct(qualified, real.length), sub: `${qualified} of ${real.length}` },
    { label: "Qualified → Itinerary", value: pct(withItinerary, qualified), sub: `${withItinerary} of ${qualified}` },
    { label: "Itinerary → Advance paid", value: pct(won, withItinerary), sub: `${won} of ${withItinerary}` },
    { label: "Overall enquiry → booking", value: pct(won, real.length), sub: `${won} of ${real.length}` },
  ];
  const medianFirstResponse = median(real.map((e) => e.firstResponseMinutes).filter((n): n is number => typeof n === "number"));
  const hoursToItin = avg(
    real
      .map((e) => {
        const first = db.itineraries.filter((i) => i.enquiryId === e.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        return first ? (new Date(first.createdAt).getTime() - new Date(e.createdAt).getTime()) / 3600000 : null;
      })
      .filter((n): n is number => n !== null && n >= 0),
  );
  const lostMap = new Map<string, number>();
  for (const e of enquiries.filter((x) => x.stage === "lost")) lostMap.set(e.lostReason ?? "Unspecified", (lostMap.get(e.lostReason ?? "Unspecified") ?? 0) + 1);
  const lostRows = [...lostMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const table = stageRows.map((r) => ({ stage: r.label, enquiries: r.value }));
  return { stageRows, kpis, medianFirstResponse, hoursToItin, lostRows, table, total: real.length };
}

export function FunnelTab({ data }: { data: ReturnType<typeof buildFunnel> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4 lg:col-span-2">
        <SectionTitle>Pipeline stages · {data.total} enquiries created in range</SectionTitle>
        <BarList rows={data.stageRows} labelWidth="w-36 md:w-48" />
      </Card>
      <Card className="p-4">
        <SectionTitle>Conversion</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {data.kpis.map((k) => (
            <div key={k.label} className="rounded-lg bg-secondary/60 p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="font-display text-2xl font-semibold">{k.value}%</div>
              <div className="text-xs text-muted-foreground">{k.sub}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Median first response</div>
            <div className="font-display text-2xl font-semibold">{Math.round(data.medianFirstResponse)} min</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Avg hours to first itinerary</div>
            <div className="font-display text-2xl font-semibold">{data.hoursToItin.toFixed(1)} h</div>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <SectionTitle>Lost reasons</SectionTitle>
        <BarList rows={data.lostRows} colorClass="bg-rose-400" labelWidth="w-40 md:w-56" />
      </Card>
    </div>
  );
}
