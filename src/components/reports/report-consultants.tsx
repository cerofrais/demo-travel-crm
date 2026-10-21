"use client";

import { Bot } from "lucide-react";
import { Avatar, Card } from "@/components/ui";
import { SectionTitle } from "@/components/shared";
import { formatINR } from "@/lib/utils";
import { avg, inRange, pct, sum, type ReportCtx } from "./report-helpers";

export function buildConsultants(ctx: ReportCtx) {
  const { db, enquiries, trips, from, to } = ctx;
  const now = Date.now();
  const rows = db.users
    .filter((u) => (u.role === "SALES" || u.role === "MANAGER") && u.active)
    .map((u) => {
      const owned = enquiries.filter((e) => e.assignedTo === u.sub);
      const itins = db.itineraries.filter((i) => i.createdBy === u.sub && i.status !== "draft" && inRange(i.createdAt, from, to)).length;
      const booked = trips.filter((t) => db.enquiries.find((e) => e.id === t.enquiryId)?.assignedTo === u.sub);
      const frm = owned.map((e) => e.firstResponseMinutes).filter((n): n is number => typeof n === "number");
      const overdue = db.tasks.filter((t) => t.assignedTo === u.sub && (t.status === "open" || t.status === "snoozed") && new Date(t.dueAt).getTime() < now).length;
      const calls = db.calls.filter((c) => c.kind === "human" && c.handledBy === u.sub && inRange(c.startedAt, from, to)).length;
      return { sub: u.sub, name: u.name, title: u.title, enquiries: owned.length, itineraries: itins, bookings: booked.length, value: sum(booked, (t) => t.totalINR), avgFirstResponse: avg(frm), overdue, calls };
    })
    .sort((a, b) => b.value - a.value);

  const real = enquiries.filter((e) => e.stage !== "non_lead");
  const agentTouched = real.filter((e) => e.handledByAgent);
  const agentFR = avg(agentTouched.map((e) => e.firstResponseMinutes).filter((n): n is number => typeof n === "number"));
  const humanFR = avg(real.filter((e) => !e.handledByAgent).map((e) => e.firstResponseMinutes).filter((n): n is number => typeof n === "number"));
  const aiMsgs = db.messages.filter((m) => m.ai && inRange(m.at, from, to));
  const contained = aiMsgs.filter((m) => m.ai?.action === "auto_sent").length;
  const aanyaCalls = db.calls.filter((c) => c.kind === "voice_agent" && inRange(c.startedAt, from, to));
  const ai = {
    agentTouchedPct: pct(agentTouched.length, real.length),
    agentFR,
    humanFR,
    containmentPct: pct(contained, aiMsgs.length),
    aiMsgs: aiMsgs.length,
    aanyaCalls: aanyaCalls.length,
    aanyaAnswered: aanyaCalls.filter((c) => c.status === "completed").length,
  };
  const table = rows.map((r) => ({ consultant: r.name, enquiries: r.enquiries, itinerariesSent: r.itineraries, bookings: r.bookings, bookedValueINR: r.value, avgFirstResponseMin: Math.round(r.avgFirstResponse), overdueTasks: r.overdue, callsMade: r.calls }));
  return { rows, ai, table };
}

export function ConsultantsTab({ data }: { data: ReturnType<typeof buildConsultants> }) {
  const { ai } = data;
  const kpis = [
    { label: "Enquiries first-touched by agent", value: `${ai.agentTouchedPct}%`, sub: "Wish or Aanya replied first" },
    { label: "First response · agent vs human", value: `${Math.round(ai.agentFR)} vs ${Math.round(ai.humanFR)} min`, sub: "average minutes" },
    { label: "Auto-reply containment", value: `${ai.containmentPct}%`, sub: `${ai.aiMsgs} AI replies, rest drafted or escalated` },
    { label: "Calls handled by Aanya", value: ai.aanyaCalls, sub: `${ai.aanyaAnswered} connected` },
  ];
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-secondary/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Consultant</th>
                <th className="px-3 py-2 text-right font-semibold">Enquiries</th>
                <th className="px-3 py-2 text-right font-semibold">Itineraries sent</th>
                <th className="px-3 py-2 text-right font-semibold">Bookings</th>
                <th className="px-3 py-2 text-right font-semibold">Booked value</th>
                <th className="px-3 py-2 text-right font-semibold">Avg 1st response</th>
                <th className="px-3 py-2 text-right font-semibold">Overdue tasks</th>
                <th className="px-3 py-2 text-right font-semibold">Calls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((r) => (
                <tr key={r.sub}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.name} className="h-7 w-7 text-[10px]" />
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground">{r.title}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.enquiries}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.itineraries}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.bookings}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.value ? formatINR(r.value, { compact: true }) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.avgFirstResponse ? `${Math.round(r.avgFirstResponse)} min` : "—"}</td>
                  <td className={"px-3 py-2 text-right tabular-nums " + (r.overdue ? "font-semibold text-rose-600" : "")}>{r.overdue}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-4">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Bot className="h-4 w-4 text-indigo-500" /> AI agents impact
          </span>
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg bg-indigo-50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-indigo-700/80">{k.label}</div>
              <div className="font-display text-xl font-semibold text-indigo-900">{k.value}</div>
              <div className="text-xs text-indigo-700/80">{k.sub}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
