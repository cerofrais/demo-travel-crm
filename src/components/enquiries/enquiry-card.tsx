"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, CalendarDays, CheckSquare, Link2, MessageCircle, Repeat, Users } from "lucide-react";
import type { DemoData, Enquiry } from "@/lib/demo/types";
import { destinationById, userBySub } from "@/lib/demo/queries";
import { Avatar, ScoreBadge } from "@/components/ui";
import { SourceBadge, TagChip } from "@/components/shared";
import { cn, formatDate, formatINR, relativeTime } from "@/lib/utils";

/** "2A 1C 1I" — compact pax label for cards. */
export function paxShort(p: Enquiry["pax"]): string {
  const parts = [`${p.adults}A`];
  if (p.children) parts.push(`${p.children}C`);
  if (p.infants) parts.push(`${p.infants}I`);
  return parts.join(" ");
}

/** "12 Dec → 18 Dec", "Dec 2026 · flexible" or "Flexible". */
export function datesLabel(e: Pick<Enquiry, "travelStart" | "travelEnd" | "travelMonth" | "flexibility">): string {
  if (e.travelStart) return `${formatDate(e.travelStart, "short")}${e.travelEnd ? ` → ${formatDate(e.travelEnd, "short")}` : ""}${e.flexibility === "plus_minus_3" ? " ±3d" : ""}`;
  if (e.travelMonth) return `${new Date(`${e.travelMonth}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} · flexible`;
  return "Flexible dates";
}

export function whatsappWindowLabel(expiresAt?: string, now = Date.now()): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return h >= 1 ? `WA ${h}h left` : `WA ${m}m left`;
}

export interface EnquiryCardProps {
  enquiry: Enquiry;
  db: DemoData;
  onOpen?: (id: string) => void;
  /** Rendered inside a DragOverlay — tilt + shadow. */
  overlay?: boolean;
  /** Source card while its clone is being dragged. */
  ghost?: boolean;
  /** Extra footer actions (e.g. "Move" on phones). */
  action?: React.ReactNode;
  className?: string;
}

export const EnquiryCard = React.memo(function EnquiryCard({ enquiry: e, db, onOpen, overlay, ghost, action, className }: EnquiryCardProps) {
  const traveller = db.travellers.find((t) => t.id === e.travellerId);
  const dest = destinationById(db, e.destinationId);
  const owner = userBySub(db, e.assignedTo);
  const openTasks = db.tasks.filter((t) => t.enquiryId === e.id && t.status === "open");
  const overdue = openTasks.some((t) => new Date(t.dueAt).getTime() < Date.now());
  const wa = whatsappWindowLabel(e.whatsappWindowExpiresAt);
  const extraTags = Math.max(0, e.tags.length - 3);
  const partySize = e.linkGroupId ? db.enquiries.filter((x) => x.linkGroupId === e.linkGroupId).length : 0;

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(e.id) : undefined}
      onKeyDown={onOpen ? (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onOpen(e.id); } } : undefined}
      className={cn(
        "group relative rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow",
        onOpen && "cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        e.needsAttention && "border-l-[3px] border-l-amber-500",
        overlay && "rotate-[1.5deg] shadow-xl ring-2 ring-primary/30",
        ghost && "opacity-40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{traveller?.fullName ?? "Unknown traveller"}</span>
            {e.needsAttention && (
              <span className="relative flex h-2 w-2 shrink-0" title="Needs attention">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <span aria-hidden>{dest?.emoji ?? "📍"}</span>
            <span className="truncate font-medium text-foreground/80">{e.destination}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="truncate">{e.ref}</span>
          </div>
        </div>
        <ScoreBadge score={e.aiScore} className="mt-0.5" />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="col-span-2 flex items-center gap-1 truncate"><CalendarDays className="h-3.5 w-3.5 shrink-0" />{datesLabel(e)}</span>
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 shrink-0" />{paxShort(e.pax)}</span>
        <span className="text-right font-semibold tabular-nums text-foreground">{formatINR(e.budgetINR, { compact: true })}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <SourceBadge source={e.source} />
        {e.handledByAgent && (
          <span className="inline-flex items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700" title="Handled by AI agent"><Bot className="h-3 w-3" />Bot</span>
        )}
        {wa && (
          <span className="inline-flex items-center gap-0.5 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700" title="WhatsApp 24h session window"><MessageCircle className="h-3 w-3" />{wa}</span>
        )}
        {openTasks.length > 0 && (
          <Link
            href={`/tasks?enquiry=${e.id}`}
            onClick={(ev) => ev.stopPropagation()}
            className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold", overdue ? "bg-rose-100 text-rose-700" : "bg-secondary text-secondary-foreground")}
            title={overdue ? "Has overdue tasks" : "Open tasks"}
          >
            <CheckSquare className="h-3 w-3" />{openTasks.length}
          </Link>
        )}
        {traveller && traveller.tripsCount > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700" title={`${traveller.tripsCount} previous trip(s)`}><Repeat className="h-3 w-3" />Repeat</span>
        )}
        {partySize > 1 && (
          <span className="inline-flex items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700" title="Linked enquiries travelling together"><Link2 className="h-3 w-3" />Party of {partySize}</span>
        )}
      </div>

      {e.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {e.tags.slice(0, 3).map((t) => <TagChip key={t} name={t} tags={db.tags} />)}
          {extraTags > 0 && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">+{extraTags}</span>}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          {owner ? (
            <>
              <Avatar name={owner.name} className="h-5 w-5 text-[9px]" />
              <span className="truncate">{owner.name.split(" ")[0]}</span>
            </>
          ) : (
            <span className="italic">Unassigned</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span title={`Last activity ${formatDate(e.lastActivityAt, "medium")}`}>{relativeTime(e.lastActivityAt)}</span>
          {action}
        </div>
      </div>
    </div>
  );
});
