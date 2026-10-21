"use client";

import * as React from "react";
import { History } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { userName } from "@/lib/demo/queries";
import type { AgentEventStatus, AgentKind } from "@/lib/demo/types";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { AGENT_META, AgentIcon, ConfidenceBar, EVENT_STATUS_LABEL, EventContext, EventStatusBadge } from "./agent-meta";

const PAGE = 60;

export function ActivityFeed() {
  const db = useDb();
  const [agent, setAgent] = React.useState<"" | AgentKind>("");
  const [status, setStatus] = React.useState<"" | AgentEventStatus>("");
  const [limit, setLimit] = React.useState(PAGE);

  const events = React.useMemo(
    () => db.agentEvents.filter((e) => (!agent || e.agent === agent) && (!status || e.status === status)).sort((a, b) => b.at.localeCompare(a.at)),
    [db, agent, status],
  );
  const shown = events.slice(0, limit);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={agent} onChange={(e) => { setAgent(e.target.value as "" | AgentKind); setLimit(PAGE); }} className="h-9 w-auto lg:h-9" aria-label="Agent filter">
          <option value="">All agents</option>
          {(Object.keys(AGENT_META) as AgentKind[]).map((k) => <option key={k} value={k}>{AGENT_META[k].label}</option>)}
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value as "" | AgentEventStatus); setLimit(PAGE); }} className="h-9 w-auto lg:h-9" aria-label="Status filter">
          <option value="">All statuses</option>
          {(Object.keys(EVENT_STATUS_LABEL) as AgentEventStatus[]).map((k) => <option key={k} value={k}>{EVENT_STATUS_LABEL[k]}</option>)}
        </Select>
        <span className="text-xs text-muted-foreground">{events.length} events</span>
      </div>
      {events.length === 0 && <EmptyState icon={History} title="No agent activity matches" />}
      <ol className="divide-y divide-border rounded-xl border border-border bg-card">
        {shown.map((ev) => (
          <li key={ev.id} className="flex items-start gap-3 p-3">
            <AgentIcon agent={ev.agent} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium">{ev.action}</span>
                <EventStatusBadge status={ev.status} />
                <span className="text-[11px] text-muted-foreground" title={formatDateTime(ev.at)}>{relativeTime(ev.at)}</span>
              </div>
              <p className="mt-0.5 text-xs text-foreground/80">{ev.detail}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <EventContext ev={ev} />
                <ConfidenceBar value={ev.confidence} />
                {ev.reviewedBy && <span className="text-[11px] text-muted-foreground">Reviewed by {userName(db, ev.reviewedBy)}{ev.reviewedAt ? ` · ${relativeTime(ev.reviewedAt)}` : ""}</span>}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {shown.length < events.length && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>Load more ({events.length - shown.length} left)</Button>
        </div>
      )}
    </div>
  );
}
