"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, X } from "lucide-react";
import { Button, Sheet } from "@/components/ui";
import { KV } from "@/components/shared";
import { AGENT_META, AgentIcon, EventStatusBadge } from "@/components/agents/agent-meta";
import { reviewEvent } from "@/components/agents/review-queue";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { userName } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { auditFor } from "@/lib/ai/audit";
import { formatDateTime } from "@/lib/utils";
import { ConfidenceRing, OutcomeBadge, PromptBlock, fmtLatency, fmtTokens } from "./helpers";

export function DecisionDetail({ eventId, onClose, onToast }: { eventId: string | null; onClose: () => void; onToast: (m: string) => void }) {
  const db = useDb();
  const user = useCurrentUser();
  const canReview = can(user.role, "agents.review");
  const ev = eventId ? db.agentEvents.find((e) => e.id === eventId) : undefined;
  const r = React.useMemo(() => (ev ? auditFor(ev, db) : undefined), [ev, db]);

  function decide(decision: "approved" | "rejected") {
    if (!ev) return;
    mutateDb((x) => reviewEvent(x, ev.id, decision, user));
    onToast(decision === "approved" ? "Approved — the agent's action goes ahead" : "Rejected — the agent's action was discarded");
  }

  return (
    <Sheet open={Boolean(eventId)} onClose={onClose} side="right" title="Decision detail" widthClassName="w-full max-w-2xl" ariaLabel="AI decision detail">
      {r && ev && (
        <div className="space-y-5 p-4 md:p-6">
          <div className="flex items-start gap-3">
            <AgentIcon agent={ev.agent} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{ev.action}</h2>
                <EventStatusBadge status={ev.status} />
                <OutcomeBadge outcome={r.outcome} />
              </div>
              <p className="mt-1 text-sm text-foreground/80">{ev.detail}</p>
            </div>
          </div>

          {r.failureNote && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide">Inference failed</div>
                {r.failureNote}
              </div>
            </div>
          )}

          <section className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/50 p-3 sm:grid-cols-3">
            <KV label="Entity" value={r.entityHref ? <Link href={r.entityHref} className="text-brand-700 hover:underline">{r.entityLabel}</Link> : r.entityLabel} className="col-span-2 sm:col-span-3" />
            <KV label="Agent" value={AGENT_META[ev.agent].label} />
            <KV label="Status" value={<EventStatusBadge status={ev.status} />} />
            <KV label="Reviewer" value={ev.reviewedBy ? `${userName(db, ev.reviewedBy)}${ev.reviewedAt ? ` · ${formatDateTime(ev.reviewedAt)}` : ""}` : "—"} />
            <KV label="Time" value={formatDateTime(ev.at)} />
            <KV label="Model" value={<span className="font-mono text-xs">{r.model}</span>} />
            <KV label="Confidence" value={<ConfidenceRing value={ev.confidence} />} />
            <KV label="Latency" value={fmtLatency(r.latencyMs)} />
            <KV label="Tokens" value={`${fmtTokens(r.tokens.in)} in · ${fmtTokens(r.tokens.out)} out`} />
            <KV label="Event id" value={<span className="font-mono text-xs">{ev.id}</span>} />
          </section>

          <PromptBlock title="System prompt" text={r.prompt.system} defaultOpen={false} maxHeight="max-h-72" />
          <PromptBlock title="User prompt" text={r.prompt.user} hint="Exact context sent to the model. Passport numbers are masked before the prompt leaves the CRM." maxHeight="max-h-96" />
          <PromptBlock title="Output" text={r.output} maxHeight="max-h-96" />

          {ev.status === "needs_review" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-xs text-amber-900">Waiting for a human decision{!canReview && " · your role can view but not approve"}</span>
              {canReview && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide("approved")}>
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-rose-700" onClick={() => decide("rejected")}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
