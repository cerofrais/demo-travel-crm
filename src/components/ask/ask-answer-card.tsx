"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, Check, ChevronDown, ChevronRight, Copy, Download, ExternalLink, HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { BarList } from "@/components/shared";
import type { AskEntry } from "@/lib/demo/types";
import type { FollowUp } from "@/lib/ai/ask-followups";
import { cn, copyToClipboard, downloadText, formatINR, toCsv } from "@/lib/utils";

type Answer = AskEntry["answer"];
const MAX_ROWS = 50;

export function entityHref(answer: Answer): string | null {
  if (!answer.entityId) return null;
  switch (answer.entityKind) {
    case "enquiry":
      return `/enquiries?enquiry=${answer.entityId}`;
    case "trip":
      return `/trips/${answer.entityId}`;
    case "traveller":
      return `/travellers?traveller=${answer.entityId}`;
    default:
      return null;
  }
}

/** Pick a number format for the chart from what the rows contain. */
function chartFormat(answer: Answer): (n: number) => string {
  const cols = answer.columns ?? [];
  const pctCol = cols.find((c) => c.includes("%"));
  const rows = answer.rows ?? [];
  const values = (answer.chart ?? []).map((c) => c.value);
  const max = Math.max(0, ...values);
  // A chart of conversion percentages: the first chart value appears in the % column.
  if (pctCol && max <= 100 && rows.some((r) => r[pctCol] === values[0])) return (n) => `${n}%`;
  if (cols.some((c) => /\(min\)/.test(c))) return (n) => `${n} min`;
  const moneyCols = ["Booked value", "Collected", "Lifetime value"];
  if (cols.some((c) => moneyCols.includes(c)) && max > 5_000) return (n) => formatINR(n, { compact: true });
  return (n) => n.toLocaleString("en-IN");
}

function QueryBlock({ query, onToast }: { query: string; onToast: (m: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="rounded-lg border border-border bg-muted/40">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-10 w-full items-center gap-2 px-3 text-xs font-medium text-muted-foreground hover:text-foreground" aria-expanded={open}>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Query
        <span className="ml-auto font-normal">how this was counted</span>
      </button>
      {open && (
        <div className="relative border-t border-border px-3 py-2">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words pr-20 font-mono text-[11px] leading-relaxed text-foreground">{query}</pre>
          <Button
            variant="outline"
            size="sm"
            className="absolute right-2 top-2 h-8"
            onClick={async () => {
              const ok = await copyToClipboard(query);
              setCopied(ok);
              onToast(ok ? "Query copied" : "Couldn't copy");
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy
          </Button>
        </div>
      )}
    </div>
  );
}

function ResultTable({ answer, question, onToast }: { answer: Answer; question: string; onToast: (m: string) => void }) {
  const rows = (answer.rows ?? []).slice(0, MAX_ROWS);
  const columns = answer.columns?.length ? answer.columns : rows[0] ? Object.keys(rows[0]) : [];
  if (!rows.length || !columns.length) return null;
  const exportCsv = () => {
    const csv = toCsv(answer.rows ?? []);
    if (!csv) return onToast("Nothing to export");
    downloadText(`ask-${question.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.csv`, csv, "text/csv");
    onToast("CSV downloaded");
  };
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {rows.length} {rows.length === 1 ? "row" : "rows"}
          {(answer.rows?.length ?? 0) > MAX_ROWS ? ` of ${answer.rows!.length}` : ""}
        </span>
        <Button variant="ghost" size="sm" className="h-8" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-xs">
          <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/60 hover:bg-secondary/50">
                {columns.map((c) => {
                  const v = r[c];
                  return (
                    <td key={c} className={cn("max-w-[320px] truncate px-3 py-2", typeof v === "number" && "tabular-nums")} title={v == null ? "" : String(v)}>
                      {v == null || v === "" ? <span className="text-muted-foreground">—</span> : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnswerCard({
  question,
  answer,
  followUps,
  onAsk,
  onToast,
}: {
  question: string;
  answer: Answer;
  followUps: FollowUp[];
  onAsk: (q: string) => void;
  onToast: (m: string) => void;
}) {
  const href = entityHref(answer);
  const unknown = answer.mode === "unknown";
  const chart = answer.chart?.slice(0, 12) ?? [];
  const fmt = React.useMemo(() => chartFormat(answer), [answer]);
  return (
    <div className="flex max-w-full gap-2 md:gap-3">
      <div className={cn("mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", unknown ? "bg-muted text-muted-foreground" : "bg-brand-100 text-brand-700")}>
        {unknown ? <HelpCircle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1 space-y-3 rounded-2xl rounded-tl-sm border border-border bg-card p-3 shadow-sm md:p-4">
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{answer.text}</p>

        {chart.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <BarList rows={chart} format={fmt} labelWidth="w-28 md:w-44" />
          </div>
        )}

        {answer.mode === "choose" && answer.rows?.length ? (
          <div className="flex flex-wrap gap-2">
            {answer.rows.map((r, i) => {
              const ref = typeof r.Ref === "string" && r.Ref !== "—" ? r.Ref : null;
              const name = String(r.Traveller ?? "");
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onAsk(ref ? `Show me ${ref}` : `Show me ${name}`)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:border-brand-400 hover:bg-brand-50"
                >
                  <span className="font-medium text-foreground">{name}</span>
                  <span className="text-muted-foreground">
                    {ref ?? "no enquiry"}
                    {r.Destination && r.Destination !== "—" ? ` · ${r.Destination}` : ""}
                    {r.City ? ` · ${r.City}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <ResultTable answer={answer} question={question} onToast={onToast} />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {href && (
            <Link href={href} className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-brand-100 lg:h-9">
              <ExternalLink className="h-3.5 w-3.5" />
              Open {answer.entityKind ?? "record"}
            </Link>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">answered in {answer.durationMs} ms</span>
        </div>

        {!unknown && <QueryBlock query={answer.query} onToast={onToast} />}

        {answer.mode === "table" && !answer.entityId && followUps.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Follow-up
            </span>
            {followUps.map((f) => (
              <button key={f.label} type="button" onClick={() => onAsk(f.question)} className="inline-flex h-8 items-center rounded-full border border-dashed border-border px-3 text-xs text-foreground hover:border-brand-400 hover:bg-brand-50">
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
