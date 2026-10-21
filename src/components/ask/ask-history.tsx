"use client";

import * as React from "react";
import { History, Star, Trash2 } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import type { AskEntry, DemoData } from "@/lib/demo/types";
import { userName } from "@/lib/demo/queries";
import { cn, relativeTime } from "@/lib/utils";

export type HistoryFilter = "mine" | "all";

const MODE_LABEL: Record<AskEntry["answer"]["mode"], string> = { table: "Table", narrative: "Summary", choose: "Pick one", unknown: "No match" };
const MODE_CLASS: Record<AskEntry["answer"]["mode"], string> = { table: "bg-brand-100 text-brand-700", narrative: "bg-indigo-100 text-indigo-700", choose: "bg-amber-100 text-amber-800", unknown: "bg-zinc-100 text-zinc-600" };

function HistoryItem({ entry, showBy, db, active, onOpen, onToggleSaved }: { entry: AskEntry; showBy: boolean; db: DemoData; active: boolean; onOpen: () => void; onToggleSaved: () => void }) {
  return (
    <div className={cn("group flex items-start gap-1 rounded-lg border border-transparent px-2 py-1.5 hover:bg-secondary", active && "border-border bg-secondary")}>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-1 text-left">
        <p className="line-clamp-2 text-sm text-foreground">{entry.question}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("rounded px-1 py-px text-[10px] font-medium", MODE_CLASS[entry.answer.mode])}>{MODE_LABEL[entry.answer.mode]}</span>
          {entry.answer.rows?.length ? <span>{entry.answer.rows.length} rows</span> : null}
          <span>{relativeTime(entry.at)}</span>
          {showBy && <span>· {userName(db, entry.by)}</span>}
        </p>
      </button>
      <button
        type="button"
        onClick={onToggleSaved}
        aria-label={entry.saved ? "Unsave question" : "Save question"}
        aria-pressed={entry.saved}
        className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-saffron-600", entry.saved ? "text-saffron-500" : "opacity-60 group-hover:opacity-100")}
      >
        <Star className={cn("h-4 w-4", entry.saved && "fill-current")} />
      </button>
    </div>
  );
}

export function AskHistory({
  db,
  me,
  canSeeAll,
  filter,
  onFilter,
  activeId,
  onOpen,
  onToggleSaved,
  onClear,
}: {
  db: DemoData;
  me: { sub: string };
  canSeeAll: boolean;
  filter: HistoryFilter;
  onFilter: (f: HistoryFilter) => void;
  activeId: string | null;
  onOpen: (entry: AskEntry) => void;
  onToggleSaved: (id: string) => void;
  onClear: () => void;
}) {
  const [confirm, setConfirm] = React.useState(false);
  const entries = React.useMemo(() => {
    const list = filter === "all" && canSeeAll ? db.askHistory : db.askHistory.filter((e) => e.by === me.sub);
    return [...list].sort((a, b) => b.at.localeCompare(a.at));
  }, [db.askHistory, filter, canSeeAll, me.sub]);
  const saved = entries.filter((e) => e.saved);
  const recent = entries.filter((e) => !e.saved);
  const showBy = filter === "all" && canSeeAll;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">History</span>
        {canSeeAll && (
          <div className="ml-auto flex rounded-md border border-border p-0.5 text-xs">
            {(["mine", "all"] as HistoryFilter[]).map((f) => (
              <button key={f} type="button" onClick={() => onFilter(f)} className={cn("h-7 rounded px-2.5 capitalize", filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <div className="p-2">
            <EmptyState icon={History} title="No questions yet" hint="Everything you ask is kept here. Star a question to pin it to the top." />
          </div>
        ) : (
          <>
            {saved.length > 0 && (
              <section className="mb-2">
                <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Saved</p>
                {saved.map((e) => (
                  <HistoryItem key={e.id} entry={e} showBy={showBy} db={db} active={e.id === activeId} onOpen={() => onOpen(e)} onToggleSaved={() => onToggleSaved(e.id)} />
                ))}
              </section>
            )}
            {recent.length > 0 && (
              <section>
                <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent</p>
                {recent.map((e) => (
                  <HistoryItem key={e.id} entry={e} showBy={showBy} db={db} active={e.id === activeId} onOpen={() => onOpen(e)} onToggleSaved={() => onToggleSaved(e.id)} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
      {recent.length > 0 && (
        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" className="h-9 w-full justify-start text-muted-foreground" onClick={() => setConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            Clear history
          </Button>
        </div>
      )}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Clear history?">
        <p className="text-sm text-muted-foreground">
          This removes {recent.length} recent {recent.length === 1 ? "question" : "questions"} {showBy ? "from everyone" : "you asked"}. Saved questions stay.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onClear();
              setConfirm(false);
            }}
          >
            Clear
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
