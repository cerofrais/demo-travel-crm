"use client";

import * as React from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { logActivity } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import type { AgentEvent, DemoData } from "@/lib/demo/types";
import { relativeTime } from "@/lib/utils";
import { AGENT_META, AgentIcon, ConfidenceBar, EventContext } from "./agent-meta";

/** Flip an event to approved/rejected and, for auto-reply drafts, send or remove the matching draft message. */
export function reviewEvent(db: DemoData, eventId: string, decision: "approved" | "rejected", reviewer: { sub: string; name: string }) {
  const ev = db.agentEvents.find((e) => e.id === eventId);
  if (!ev) return;
  const at = nowIso();
  ev.status = decision;
  ev.reviewedBy = reviewer.sub;
  ev.reviewedAt = at;
  if (ev.agent === "autoreply") {
    const byId = typeof ev.payload?.messageId === "string" ? db.messages.find((m) => m.id === ev.payload!.messageId && m.status === "draft") : undefined;
    const draft = byId ?? db.messages.filter((m) => m.enquiryId === ev.enquiryId && m.status === "draft").sort((a, b) => b.at.localeCompare(a.at))[0];
    if (draft) {
      if (decision === "approved") {
        draft.status = "sent";
        draft.at = at;
      } else {
        db.messages = db.messages.filter((m) => m.id !== draft.id);
      }
    }
  }
  if (ev.agent === "itinerary" && decision === "approved") {
    const itinId = typeof ev.payload?.itineraryId === "string" ? ev.payload.itineraryId : undefined;
    const it = itinId ? db.itineraries.find((i) => i.id === itinId) : undefined;
    if (it && it.status === "draft") it.status = "sent";
  }
  const e = db.enquiries.find((x) => x.id === ev.enquiryId);
  if (e) {
    e.lastActivityAt = at;
    e.updatedAt = at;
    const stillPending = db.agentEvents.some((x) => x.enquiryId === e.id && x.status === "needs_review") || db.messages.some((m) => m.enquiryId === e.id && m.status === "draft");
    if (!stillPending) e.needsAttention = false;
  }
  logActivity(db, { actor: reviewer.name, actorKind: "user", type: decision === "approved" ? "agent_approved" : "agent_rejected", text: `${decision === "approved" ? "Approved" : "Rejected"} ${AGENT_META[ev.agent].label.toLowerCase()} action: ${ev.action}`, enquiryId: ev.enquiryId, travellerId: ev.travellerId });
}

export function ReviewQueue() {
  const db = useDb();
  const user = useCurrentUser();
  const canReview = can(user.role, "agents.review");
  const queue = React.useMemo(() => db.agentEvents.filter((e) => e.status === "needs_review").sort((a, b) => b.at.localeCompare(a.at)), [db]);

  if (queue.length === 0) return <EmptyState icon={ShieldCheck} title="Nothing waiting for review" hint="Drafts, escalations and itineraries the agents are unsure about land here." />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{queue.length} item{queue.length === 1 ? "" : "s"} · newest first{!canReview && " · your role can view but not approve"}</p>
      {queue.map((ev) => (
        <ReviewCard key={ev.id} ev={ev} canReview={canReview} onDecide={(d) => mutateDb((db) => reviewEvent(db, ev.id, d, user))} />
      ))}
    </div>
  );
}

function ReviewCard({ ev, canReview, onDecide }: { ev: AgentEvent; canReview: boolean; onDecide: (d: "approved" | "rejected") => void }) {
  const db = useDb();
  const draft = ev.agent === "autoreply" ? (db.messages.find((m) => m.id === ev.payload?.messageId) ?? db.messages.filter((m) => m.enquiryId === ev.enquiryId && m.status === "draft").sort((a, b) => b.at.localeCompare(a.at))[0]) : undefined;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <AgentIcon agent={ev.agent} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">{ev.action}</div>
            <span className="text-[11px] text-muted-foreground">{AGENT_META[ev.agent].label} · {relativeTime(ev.at)}</span>
          </div>
          <EventContext ev={ev} className="mt-0.5" />
          <p className="mt-2 text-sm text-foreground/90">{ev.detail}</p>
          {draft && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Draft reply</div>
              <p className="whitespace-pre-wrap">{draft.body}</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <ConfidenceBar value={ev.confidence} />
            {canReview && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onDecide("approved")}>
                  <Check className="h-3.5 w-3.5" /> Approve{draft ? " & send" : ""}
                </Button>
                <Button size="sm" variant="outline" className="text-rose-700" onClick={() => onDecide("rejected")}>
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
