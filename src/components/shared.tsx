"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { STAGE_MAP, SOURCE_CLASS, SOURCE_SHORT, SOURCE_LABEL, CHANNEL_CLASS, CHANNEL_LABEL, TAG_CLASS, TRIP_STATUS_CLASS, TRIP_STATUS_LABEL, PAYMENT_STATUS_CLASS } from "@/lib/pipeline";
import type { EnquiryStage, LeadSource, Channel, TripStatus, PaymentStatus, Tag } from "@/lib/demo/types";

export function StageBadge({ stage, className }: { stage: EnquiryStage; className?: string }) {
  const s = STAGE_MAP[stage];
  return <Badge className={cn(s.badge, className)}>{s.label}</Badge>;
}

export function SourceBadge({ source, full = false, className }: { source: LeadSource; full?: boolean; className?: string }) {
  return (
    <span title={SOURCE_LABEL[source]} className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold", SOURCE_CLASS[source], className)}>
      {full ? SOURCE_LABEL[source] : SOURCE_SHORT[source]}
    </span>
  );
}

export function ChannelBadge({ channel, className }: { channel: Channel; className?: string }) {
  return <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold", CHANNEL_CLASS[channel], className)}>{CHANNEL_LABEL[channel]}</span>;
}

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return <Badge className={TRIP_STATUS_CLASS[status]}>{TRIP_STATUS_LABEL[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge className={cn("capitalize", PAYMENT_STATUS_CLASS[status])}>{status}</Badge>;
}

export function TagChip({ name, tags, onRemove }: { name: string; tags?: Tag[]; onRemove?: () => void }) {
  const cat = tags?.find((t) => t.name === name)?.category ?? "custom";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium", TAG_CLASS[cat])}>
      {name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100" aria-label={`Remove tag ${name}`}>
          ×
        </button>
      )}
    </span>
  );
}

export function StatCard({ label, value, icon: Icon, tint = "text-brand-600", hint, href }: { label: string; value: React.ReactNode; icon?: LucideIcon; tint?: string; hint?: React.ReactNode; href?: string }) {
  const body = (
    <Card className={cn("p-4", href && "transition-shadow hover:shadow-md")}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon && <Icon className={cn("h-5 w-5", tint)} />}
      </div>
      <div className="mt-2 break-words font-display text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function BarList({ rows, max, colorClass = "bg-brand-500", labelWidth = "w-32 md:w-44", format = (n: number) => String(n) }: { rows: { label: string; value: number; color?: string; sub?: string }[]; max?: number; colorClass?: string; labelWidth?: string; format?: (n: number) => string }) {
  const m = Math.max(1, max ?? Math.max(...rows.map((r) => r.value), 1));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className={cn("shrink-0 truncate text-xs text-muted-foreground", labelWidth)} title={r.label}>
            {r.label}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
            <div className={cn("h-full rounded", r.color ?? colorClass)} style={{ width: `${Math.max(2, (r.value / m) * 100)}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-sm font-medium tabular-nums">{format(r.value)}</span>
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, hint, action }: { icon?: LucideIcon; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function KV({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{value ?? "—"}</div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      {action}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("inline-flex items-center gap-2 text-sm disabled:opacity-50", label ? "" : "")}
    >
      <span className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", checked ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </span>
      {label && <span className="text-foreground">{label}</span>}
    </button>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  React.useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-ink-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-10">{message}</div>
  );
}

export function useToast() {
  const [message, setMessage] = React.useState<string | null>(null);
  const toast = React.useCallback((m: string) => setMessage(m), []);
  const node = <Toast message={message} onDone={() => setMessage(null)} />;
  return { toast, node };
}
