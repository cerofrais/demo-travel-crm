"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, BrainCircuit, Map, PhoneCall, Repeat, UserCheck, X, Plus, type LucideIcon } from "lucide-react";
import { Badge, Input } from "@/components/ui";
import { useDb } from "@/lib/demo/use-db";
import { enquiryById, travellerById } from "@/lib/demo/queries";
import type { AgentEvent, AgentEventStatus, AgentKind } from "@/lib/demo/types";
import { cn } from "@/lib/utils";

export const AGENT_META: Record<AgentKind, { label: string; icon: LucideIcon; tint: string; bg: string }> = {
  voice: { label: "Voice agent", icon: PhoneCall, tint: "text-brand-700", bg: "bg-brand-100" },
  autoreply: { label: "Auto-reply", icon: Bot, tint: "text-emerald-700", bg: "bg-emerald-100" },
  scoring: { label: "Scoring", icon: BrainCircuit, tint: "text-indigo-700", bg: "bg-indigo-100" },
  itinerary: { label: "Itinerary", icon: Map, tint: "text-saffron-700", bg: "bg-saffron-100" },
  followup: { label: "Follow-up", icon: Repeat, tint: "text-sky-700", bg: "bg-sky-100" },
  assignment: { label: "Assignment", icon: UserCheck, tint: "text-zinc-700", bg: "bg-zinc-100" },
};

export const EVENT_STATUS_CLASS: Record<AgentEventStatus, string> = {
  auto: "bg-emerald-100 text-emerald-800",
  needs_review: "bg-amber-100 text-amber-800",
  approved: "bg-brand-100 text-brand-800",
  rejected: "bg-rose-100 text-rose-700",
  info: "bg-zinc-100 text-zinc-700",
};

export const EVENT_STATUS_LABEL: Record<AgentEventStatus, string> = {
  auto: "Auto",
  needs_review: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
  info: "Info",
};

export function EventStatusBadge({ status }: { status: AgentEventStatus }) {
  return <Badge className={EVENT_STATUS_CLASS[status]}>{EVENT_STATUS_LABEL[status]}</Badge>;
}

export function AgentIcon({ agent, className }: { agent: AgentKind; className?: string }) {
  const m = AGENT_META[agent];
  const Icon = m.icon;
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", m.bg, m.tint, className)}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function ConfidenceBar({ value, className }: { value?: number; className?: string }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className={cn("flex items-center gap-2", className)} title={`Confidence ${pct}%`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

/** Enquiry ref · traveller · destination with deep links for an event. */
export function EventContext({ ev, className }: { ev: AgentEvent; className?: string }) {
  const db = useDb();
  const e = enquiryById(db, ev.enquiryId);
  const t = travellerById(db, ev.travellerId ?? e?.travellerId);
  if (!e && !t) return <span className={cn("text-xs text-muted-foreground", className)}>No linked enquiry</span>;
  return (
    <span className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground", className)}>
      {e && (
        <Link href={`/enquiries?enquiry=${e.id}`} className="font-medium text-brand-700 hover:underline">
          {e.ref}
        </Link>
      )}
      {t && (
        <Link href={`/travellers?traveller=${t.id}`} className="hover:underline">
          {t.fullName}
        </Link>
      )}
      {e && <span>· {e.destination}</span>}
    </span>
  );
}

/** Add/remove chips (string list editor). */
export function ChipEditor({ values, onChange, placeholder = "Add…", disabled, suggestions }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string; disabled?: boolean; suggestions?: string[] }) {
  const [draft, setDraft] = React.useState("");
  function add(v: string) {
    const s = v.trim();
    if (!s || values.includes(s)) return;
    onChange([...values, s]);
    setDraft("");
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            {v}
            {!disabled && (
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="opacity-60 hover:opacity-100" aria-label={`Remove ${v}`}>
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {values.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
      </div>
      {!disabled && (
        <div className="flex gap-1.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="h-9 lg:h-9"
            list={suggestions ? `chips-${placeholder.replace(/\W/g, "")}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
          />
          {suggestions && (
            <datalist id={`chips-${placeholder.replace(/\W/g, "")}`}>
              {suggestions.filter((s) => !values.includes(s)).map((s) => <option key={s} value={s} />)}
            </datalist>
          )}
          <button type="button" onClick={() => add(draft)} disabled={!draft.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-secondary disabled:opacity-50" aria-label="Add">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Multi-select as toggleable chips from a fixed option set. */
export function ChipSelect<T extends string>({ options, values, onChange, label, disabled }: { options: { value: T; label: string }[]; values: T[]; onChange: (v: T[]) => void; label?: (v: T) => string; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
            className={cn("h-8 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary")}
          >
            {label ? label(o.value) : o.label}
          </button>
        );
      })}
    </div>
  );
}
