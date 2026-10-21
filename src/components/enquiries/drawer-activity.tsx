"use client";

import { Bot, Cog, MessageSquare, User as UserIcon } from "lucide-react";
import type { Enquiry } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { Badge } from "@/components/ui";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

interface Row {
  id: string;
  at: string;
  kind: "user" | "ai" | "system" | "traveller";
  actor: string;
  title: string;
  detail?: string;
  status?: string;
  confidence?: number;
}

const ICON = { user: UserIcon, ai: Bot, system: Cog, traveller: MessageSquare } as const;
const TINT = { user: "bg-brand-100 text-brand-700", ai: "bg-violet-100 text-violet-700", system: "bg-zinc-100 text-zinc-600", traveller: "bg-green-100 text-green-700" } as const;

export function ActivityTab({ enquiry: e }: { enquiry: Enquiry }) {
  const db = useDb();
  const rows: Row[] = [
    ...db.activities.filter((a) => a.enquiryId === e.id).map<Row>((a) => ({ id: a.id, at: a.at, kind: a.actorKind, actor: a.actor, title: a.text })),
    ...db.agentEvents.filter((a) => a.enquiryId === e.id).map<Row>((a) => ({ id: a.id, at: a.at, kind: "ai", actor: `${a.agent} agent`, title: a.action, detail: a.detail, status: a.status, confidence: a.confidence })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (rows.length === 0) return <p className="p-6 text-center text-sm text-muted-foreground">No activity yet.</p>;

  return (
    <ol className="relative space-y-4 p-4 pl-5">
      <span className="absolute bottom-6 left-[31px] top-6 w-px bg-border" aria-hidden />
      {rows.map((r) => {
        const Icon = ICON[r.kind];
        return (
          <li key={r.id} className="relative flex gap-3">
            <span className={cn("relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-background", TINT[r.kind])}><Icon className="h-3.5 w-3.5" /></span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium">{r.title}</span>
                {r.status && r.status !== "auto" && r.status !== "info" && (
                  <Badge className={cn("text-[10px]", r.status === "needs_review" ? "bg-amber-100 text-amber-800" : r.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700")}>{r.status.replace("_", " ")}</Badge>
                )}
              </div>
              {r.detail && <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>}
              <p className="mt-0.5 text-[11px] text-muted-foreground" title={formatDateTime(r.at)}>
                {r.actor}{r.confidence != null ? ` · ${Math.round(r.confidence * 100)}% confident` : ""} · {relativeTime(r.at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
