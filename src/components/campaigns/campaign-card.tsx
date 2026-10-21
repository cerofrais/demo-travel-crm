"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Copy, Hash, Pause, Play, Send, Trash2, Link2 } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { ChannelBadge } from "@/components/shared";
import { cn, formatDateTime } from "@/lib/utils";
import { userName } from "@/lib/demo/queries";
import type { Campaign, DemoData } from "@/lib/demo/types";
import { CAMPAIGN_STATUS_CLASS, CAMPAIGN_STATUS_LABEL, CAMPAIGN_TYPE_LABEL } from "./campaign-helpers";

const FUNNEL: { key: keyof Campaign["stats"]; label: string; color: string }[] = [
  { key: "sent", label: "Sent", color: "bg-brand-300" },
  { key: "delivered", label: "Delivered", color: "bg-brand-400" },
  { key: "read", label: "Read", color: "bg-brand-500" },
  { key: "replied", label: "Replied", color: "bg-saffron-400" },
  { key: "leadsCreated", label: "Leads", color: "bg-clay-500" },
  { key: "bookings", label: "Bookings", color: "bg-emerald-500" },
];

export function CampaignCard({
  c,
  db,
  canManage,
  onToggle,
  onDuplicate,
  onDelete,
  onSendNow,
}: {
  c: Campaign;
  db: DemoData;
  canManage: boolean;
  onToggle: (c: Campaign) => void;
  onDuplicate: (c: Campaign) => void;
  onDelete: (c: Campaign) => void;
  onSendNow: (c: Campaign) => void;
}) {
  const [showBody, setShowBody] = React.useState(false);
  const base = Math.max(1, c.stats.sent);
  const isAutomation = c.type === "comment_automation" || c.type === "story_reply";

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{c.name}</h3>
            <ChannelBadge channel={c.channel} />
            <Badge className={cn(CAMPAIGN_STATUS_CLASS[c.status], "gap-1.5")}>
              {c.status === "running" && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
              {CAMPAIGN_STATUS_LABEL[c.status]}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{CAMPAIGN_TYPE_LABEL[c.type]} · by {userName(db, c.createdBy)}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-1.5">
            {c.status === "scheduled" && (
              <Button size="sm" onClick={() => onSendNow(c)}>
                <Send className="h-3.5 w-3.5" /> Send now
              </Button>
            )}
            {(c.status === "running" || c.status === "paused") && (
              <Button size="sm" variant="outline" onClick={() => onToggle(c)}>
                {c.status === "running" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {c.status === "running" ? "Pause" : "Resume"}
              </Button>
            )}
            {c.status === "draft" && (
              <Button size="sm" variant="outline" onClick={() => onToggle(c)}>
                <Play className="h-3.5 w-3.5" /> Start
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onDuplicate(c)} aria-label="Duplicate">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-rose-600" onClick={() => onDelete(c)} aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{c.audience.description}</span>
          {c.audience.count > 0 && <span> · {c.audience.count.toLocaleString("en-IN")} people</span>}
        </span>
        {c.keyword && (
          <span className="inline-flex items-center gap-1 rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700">
            <Hash className="h-3 w-3" /> comment {c.keyword}
          </span>
        )}
        {c.postRef && (
          <span className="inline-flex items-center gap-1">
            <Link2 className="h-3 w-3" /> {c.postRef}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {c.scheduledAt && <span>Scheduled {formatDateTime(c.scheduledAt)}</span>}
        {c.startedAt && <span>Started {formatDateTime(c.startedAt)}</span>}
        {c.completedAt && <span>Completed {formatDateTime(c.completedAt)}</span>}
        {!c.scheduledAt && !c.startedAt && <span>Created {formatDateTime(c.createdAt)}</span>}
      </div>

      {c.stats.sent > 0 ? (
        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {FUNNEL.map((f) => (
              <div key={f.key} className={cn("h-full", f.color)} style={{ width: `${Math.max(1, (c.stats[f.key] / base) * (100 / FUNNEL.length))}%` }} title={`${f.label}: ${c.stats[f.key]}`} />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {FUNNEL.map((f) => (
              <div key={f.key} className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span className={cn("h-1.5 w-1.5 rounded-full", f.color)} /> {f.label}
                </div>
                <div className="text-sm font-semibold tabular-nums text-foreground">
                  {c.stats[f.key].toLocaleString("en-IN")}
                  {f.key !== "sent" && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{Math.round((c.stats[f.key] / base) * 100)}%</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{isAutomation ? "No triggers yet." : "Not sent yet."}</p>
      )}

      <button type="button" onClick={() => setShowBody((v) => !v)} className="flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline">
        {showBody ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {showBody ? "Hide message" : "Preview message"}
      </button>
      {showBody && <pre className="whitespace-pre-wrap rounded-lg bg-secondary px-3 py-2 font-sans text-xs text-foreground">{c.body}</pre>}
    </Card>
  );
}
