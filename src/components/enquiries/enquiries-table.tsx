"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Enquiry } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { destinationById, userName } from "@/lib/demo/queries";
import { stageIndex } from "@/lib/pipeline";
import { Avatar, ScoreBadge } from "@/components/ui";
import { EmptyState, SourceBadge, StageBadge } from "@/components/shared";
import { cn, formatINR, paxCount, relativeTime } from "@/lib/utils";
import { datesLabel, paxShort } from "./enquiry-card";

type SortKey = "ref" | "traveller" | "destination" | "dates" | "pax" | "budget" | "source" | "stage" | "score" | "owner" | "lastActivity";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "ref", label: "Ref", className: "w-24" },
  { key: "traveller", label: "Traveller" },
  { key: "destination", label: "Destination" },
  { key: "dates", label: "Dates" },
  { key: "pax", label: "Pax", className: "w-16" },
  { key: "budget", label: "Budget", className: "text-right" },
  { key: "source", label: "Source" },
  { key: "stage", label: "Stage" },
  { key: "score", label: "Score", className: "w-16" },
  { key: "owner", label: "Owner" },
  { key: "lastActivity", label: "Last activity" },
];

export function EnquiriesTable({ enquiries, onOpen }: { enquiries: Enquiry[]; onOpen: (id: string) => void }) {
  const db = useDb();
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "lastActivity", dir: -1 });

  const travellerName = React.useCallback((e: Enquiry) => db.travellers.find((t) => t.id === e.travellerId)?.fullName ?? "", [db]);

  const rows = React.useMemo(() => {
    const value = (e: Enquiry): string | number => {
      switch (sort.key) {
        case "ref": return Number(e.ref.replace(/\D/g, ""));
        case "traveller": return travellerName(e).toLowerCase();
        case "destination": return e.destination.toLowerCase();
        case "dates": return e.travelStart ?? (e.travelMonth ? `${e.travelMonth}-01` : "9999");
        case "pax": return paxCount(e.pax);
        case "budget": return e.budgetINR;
        case "source": return e.source;
        case "stage": return stageIndex(e.stage);
        case "score": return e.aiScore ?? -1;
        case "owner": return userName(db, e.assignedTo).toLowerCase();
        case "lastActivity": return e.lastActivityAt;
      }
    };
    return enquiries.slice().sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return c * sort.dir;
    });
  }, [enquiries, sort, db, travellerName]);

  function toggle(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "lastActivity" || key === "score" || key === "budget" ? -1 : 1 }));
  }

  if (enquiries.length === 0) return <EmptyState title="No enquiries match" hint="Try clearing a filter or widening the search." />;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} className={cn("px-3 py-2 text-left font-semibold", c.className)}>
                <button type="button" onClick={() => toggle(c.key)} className={cn("inline-flex items-center gap-1 hover:text-foreground", c.className?.includes("text-right") && "flex-row-reverse")}>
                  {c.label}
                  {sort.key === c.key ? sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const dest = destinationById(db, e.destinationId);
            const owner = e.assignedTo ? userName(db, e.assignedTo) : null;
            return (
              <tr
                key={e.id}
                onClick={() => onOpen(e.id)}
                className={cn("cursor-pointer border-t border-border/60 transition-colors hover:bg-secondary/60", e.needsAttention && "bg-amber-50/40")}
              >
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{e.ref}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    {e.needsAttention && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Needs attention" />}
                    <span className="truncate">{travellerName(e)}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap"><span aria-hidden className="mr-1">{dest?.emoji}</span>{e.destination}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{datesLabel(e)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{paxShort(e.pax)}</td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">{formatINR(e.budgetINR, { compact: true })}</td>
                <td className="px-3 py-2.5"><SourceBadge source={e.source} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap"><StageBadge stage={e.stage} /></td>
                <td className="px-3 py-2.5"><ScoreBadge score={e.aiScore} /></td>
                <td className="px-3 py-2.5">
                  {owner ? (
                    <span className="flex items-center gap-1.5"><Avatar name={owner} className="h-5 w-5 text-[9px]" /><span className="truncate">{owner}</span></span>
                  ) : (
                    <span className="italic text-muted-foreground">Unassigned</span>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{relativeTime(e.lastActivityAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
