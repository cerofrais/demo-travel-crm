"use client";

import * as React from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { Badge } from "@/components/ui";
import type { AuditRecord } from "@/lib/ai/audit";
import { cn, copyToClipboard } from "@/lib/utils";

export const OUTCOME_CLASS: Record<AuditRecord["outcome"], string> = {
  success: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-700",
  skipped: "bg-zinc-100 text-zinc-700",
};

export const OUTCOME_LABEL: Record<AuditRecord["outcome"], string> = {
  success: "Success",
  failed: "Failed",
  skipped: "Skipped",
};

export function OutcomeBadge({ outcome, title }: { outcome: AuditRecord["outcome"]; title?: string }) {
  return (
    <Badge className={OUTCOME_CLASS[outcome]} title={title}>
      {OUTCOME_LABEL[outcome]}
    </Badge>
  );
}

export function fmtLatency(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/** Small hollow ring with the confidence % inside — ScoreBadge's look, read-only. */
export function ConfidenceRing({ value, className }: { value?: number; className?: string }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "border-emerald-500 text-emerald-600" : pct >= 60 ? "border-amber-500 text-amber-600" : "border-rose-500 text-rose-600";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`Confidence ${pct}%`}>
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-background text-[9px] font-bold leading-none tabular-nums", color)}>{pct}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </span>
  );
}

/** Monospace block for prompts / outputs, collapsible, with a copy button. */
export function PromptBlock({ title, text, defaultOpen = true, maxHeight = "max-h-80", hint }: { title: string; text: string; defaultOpen?: boolean; maxHeight?: string; hint?: string }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    if (await copyToClipboard(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-h-[40px] items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground" aria-expanded={open}>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
          {title}
          <span className="font-normal normal-case tracking-normal">· {text.length.toLocaleString()} chars</span>
        </button>
        <button type="button" onClick={copy} className="flex min-h-[40px] items-center gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground" aria-label={`Copy ${title}`}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {hint && open && <p className="mb-1.5 text-[11px] text-muted-foreground">{hint}</p>}
      {open && <pre className={cn("overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-secondary/40 p-3 font-mono text-[11.5px] leading-relaxed text-foreground", maxHeight)}>{text}</pre>}
    </section>
  );
}
