"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Clock, Download, Gauge, ShieldCheck, Search, Timer } from "lucide-react";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { EmptyState, StatCard } from "@/components/shared";
import { AGENT_META, EVENT_STATUS_LABEL, EventStatusBadge } from "@/components/agents/agent-meta";
import { useDb } from "@/lib/demo/use-db";
import { userName } from "@/lib/demo/queries";
import { auditFor, type AuditRecord } from "@/lib/ai/audit";
import type { AgentEventStatus, AgentKind } from "@/lib/demo/types";
import { cn, downloadText, formatDateTime, relativeTime, toCsv } from "@/lib/utils";
import { ConfidenceRing, OutcomeBadge, fmtLatency } from "./helpers";

type Range = "7d" | "30d" | "all";
const PAGE = 50;

function sinceFor(range: Range): string | undefined {
  if (range === "all") return undefined;
  return new Date(Date.now() - (range === "7d" ? 7 : 30) * 86400000).toISOString();
}

export function DecisionLog({ onOpen }: { onOpen: (eventId: string) => void }) {
  const db = useDb();
  const [agent, setAgent] = React.useState<"" | AgentKind>("");
  const [outcome, setOutcome] = React.useState<"" | AuditRecord["outcome"]>("");
  const [status, setStatus] = React.useState<"" | AgentEventStatus>("");
  const [range, setRange] = React.useState<Range>("30d");
  const [q, setQ] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE);

  const records = React.useMemo(() => db.agentEvents.map((e) => auditFor(e, db)).sort((a, b) => b.event.at.localeCompare(a.event.at)), [db]);

  const filtered = React.useMemo(() => {
    const since = sinceFor(range);
    const s = q.trim().toLowerCase();
    return records.filter((r) => {
      const e = r.event;
      if (since && e.at < since) return false;
      if (agent && e.agent !== agent) return false;
      if (outcome && r.outcome !== outcome) return false;
      if (status && e.status !== status) return false;
      if (s && !`${e.action} ${e.detail} ${r.entityLabel} ${r.model}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [records, range, agent, outcome, status, q]);

  const stats = React.useMemo(() => {
    const conf = filtered.filter((r) => r.event.confidence != null);
    const avgConf = conf.length ? Math.round((conf.reduce((s, r) => s + (r.event.confidence ?? 0), 0) / conf.length) * 100) : null;
    const avgLat = filtered.length ? Math.round(filtered.reduce((s, r) => s + r.latencyMs, 0) / filtered.length) : null;
    return {
      total: filtered.length,
      auto: filtered.filter((r) => r.event.status === "auto").length,
      review: filtered.filter((r) => r.event.status === "needs_review").length,
      failed: filtered.filter((r) => r.outcome === "failed").length,
      avgConf,
      avgLat,
    };
  }, [filtered]);

  const shown = filtered.slice(0, limit);
  const reset = () => setLimit(PAGE);

  function exportCsv() {
    const rows = filtered.map((r) => ({
      when: r.event.at,
      agent: AGENT_META[r.event.agent].label,
      action: r.event.action,
      entity: r.entityLabel,
      enquiryId: r.event.enquiryId ?? "",
      model: r.model,
      confidence: r.event.confidence != null ? Math.round(r.event.confidence * 100) : "",
      status: EVENT_STATUS_LABEL[r.event.status],
      outcome: r.outcome,
      latencyMs: r.latencyMs,
      tokensIn: r.tokens.in,
      tokensOut: r.tokens.out,
      reviewer: r.event.reviewedBy ? userName(db, r.event.reviewedBy) : "",
      detail: r.event.detail,
    }));
    downloadText(`wishtrip-ai-audit-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total decisions" value={stats.total} icon={Activity} />
        <StatCard label="Auto-executed" value={stats.auto} icon={ShieldCheck} tint="text-emerald-600" hint={stats.total ? `${Math.round((stats.auto / stats.total) * 100)}% containment` : undefined} />
        <StatCard label="Needs review" value={stats.review} icon={Clock} tint="text-amber-600" />
        <StatCard label="Failed" value={stats.failed} icon={AlertTriangle} tint={stats.failed ? "text-rose-600" : "text-emerald-600"} hint={stats.total ? `${((stats.failed / stats.total) * 100).toFixed(1)}% error rate` : undefined} />
        <StatCard label="Avg confidence" value={stats.avgConf != null ? `${stats.avgConf}%` : "—"} icon={Gauge} tint="text-indigo-600" />
        <StatCard label="Avg latency" value={stats.avgLat != null ? fmtLatency(stats.avgLat) : "—"} icon={Timer} tint="text-sky-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Search action, detail, traveller…" className="pl-8" aria-label="Search decisions" />
        </div>
        <Select value={agent} onChange={(e) => { setAgent(e.target.value as "" | AgentKind); reset(); }} className="w-auto" aria-label="Agent filter">
          <option value="">All agents</option>
          {(Object.keys(AGENT_META) as AgentKind[]).map((k) => <option key={k} value={k}>{AGENT_META[k].label}</option>)}
        </Select>
        <Select value={outcome} onChange={(e) => { setOutcome(e.target.value as "" | AuditRecord["outcome"]); reset(); }} className="w-auto" aria-label="Outcome filter">
          <option value="">All outcomes</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value as "" | AgentEventStatus); reset(); }} className="w-auto" aria-label="Status filter">
          <option value="">All statuses</option>
          {(Object.keys(EVENT_STATUS_LABEL) as AgentEventStatus[]).map((k) => <option key={k} value={k}>{EVENT_STATUS_LABEL[k]}</option>)}
        </Select>
        <Select value={range} onChange={(e) => { setRange(e.target.value as Range); reset(); }} className="w-auto" aria-label="Date range">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} of {records.length}</span>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0} className="ml-auto h-9">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No decisions match" hint="Widen the date range or clear a filter." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  {["When", "Agent", "Action", "Entity", "Model", "Confidence", "Status", "Outcome", "Latency", "Reviewer"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((r) => <Row key={r.event.id} r={r} onOpen={onOpen} />)}
              </tbody>
            </table>
          </div>
          {shown.length < filtered.length && (
            <div className="border-t border-border p-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>Load more ({filtered.length - shown.length} left)</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Row({ r, onOpen }: { r: AuditRecord; onOpen: (id: string) => void }) {
  const db = useDb();
  const e = r.event;
  const meta = AGENT_META[e.agent];
  const Icon = meta.icon;
  return (
    <tr
      onClick={() => onOpen(e.id)}
      onKeyDown={(k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); onOpen(e.id); } }}
      tabIndex={0}
      role="button"
      className="cursor-pointer outline-none hover:bg-muted/30 focus-visible:bg-muted/30"
    >
      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground" title={formatDateTime(e.at)}>{relativeTime(e.at)}</td>
      <td className="px-3 py-2.5">
        <Badge className={cn("gap-1 whitespace-nowrap", meta.bg, meta.tint)}>
          <Icon className="h-3 w-3" /> {meta.label}
        </Badge>
      </td>
      <td className="max-w-[260px] px-3 py-2.5">
        <div className="truncate font-medium" title={e.action}>{e.action}</div>
        <div className="truncate text-[11px] text-muted-foreground" title={e.detail}>{e.detail}</div>
      </td>
      <td className="max-w-[200px] px-3 py-2.5 text-xs">
        {r.entityHref ? (
          <Link href={r.entityHref} onClick={(ev) => ev.stopPropagation()} className="block truncate text-brand-700 hover:underline" title={r.entityLabel}>{r.entityLabel}</Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{r.model}</td>
      <td className="px-3 py-2.5"><ConfidenceRing value={e.confidence} /></td>
      <td className="px-3 py-2.5"><EventStatusBadge status={e.status} /></td>
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1">
          {r.outcome === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          {r.outcome === "failed" && <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />}
          <OutcomeBadge outcome={r.outcome} title={r.failureNote} />
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums">{fmtLatency(r.latencyMs)}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{e.reviewedBy ? userName(db, e.reviewedBy) : "—"}</td>
    </tr>
  );
}
