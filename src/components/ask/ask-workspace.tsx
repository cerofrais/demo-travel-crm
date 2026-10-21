"use client";

import * as React from "react";
import { MessageSquareText, History } from "lucide-react";
import { Avatar, Button, Sheet } from "@/components/ui";
import { EmptyState, useToast } from "@/components/shared";
import { PageHeader } from "@/components/app/page-header";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity } from "@/lib/demo/queries";
import { useCurrentUser } from "@/lib/demo/session-client";
import { can } from "@/lib/rbac";
import { askData } from "@/lib/ai/ask";
import { followUpsFor } from "@/lib/ai/ask-followups";
import type { AskEntry } from "@/lib/demo/types";
import { AnswerCard } from "./ask-answer-card";
import { AskComposer } from "./ask-composer";
import { AskHistory, type HistoryFilter } from "./ask-history";

const HISTORY_CAP = 200;

interface Turn {
  id: string;
  question: string;
  answer: AskEntry["answer"];
}

/**
 * Ask the data: a chat over the CRM's own data. Questions are parsed and
 * answered by src/lib/ai/ask.ts; every Q&A is kept in db.askHistory so it can
 * be reopened, starred, or (for managers) reviewed across the team.
 */
export function AskWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const { toast, node } = useToast();
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [filter, setFilter] = React.useState<HistoryFilter>("mine");
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const canSeeAll = me.role === "ADMIN" || me.role === "MANAGER";
  const allowed = can(me.role, "data.ask");
  const lastEntryId = React.useRef<string | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  const ask = React.useCallback(
    (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      setDraft("");
      setBusy(true);
      setHistoryOpen(false);
      // A short "thinking" beat so the answer feels like it was worked out.
      window.setTimeout(() => {
        const answer = askData(q, db, { sub: me.sub, role: me.role });
        const entryId = newId("ask");
        lastEntryId.current = entryId;
        mutateDb((d) => {
          d.askHistory.unshift({ id: entryId, at: nowIso(), by: me.sub, question: q, answer, saved: false });
          // Keep the newest HISTORY_CAP; saved questions are never evicted.
          if (d.askHistory.length > HISTORY_CAP) {
            const keep = d.askHistory.filter((e, i) => i < HISTORY_CAP || e.saved);
            d.askHistory.splice(0, d.askHistory.length, ...keep);
          }
          logActivity(d, { actor: me.name, actorSub: me.sub, actorKind: "user", type: "ask_data", text: `Asked the data: “${q.slice(0, 80)}”` });
        });
        setTurns((t) => [...t, { id: entryId, question: q, answer }]);
        setBusy(false);
      }, 500);
    },
    [busy, db, me],
  );

  const reopen = (entry: AskEntry) => {
    setHistoryOpen(false);
    setTurns((t) => (t.some((x) => x.id === entry.id) ? t : [...t, { id: entry.id, question: entry.question, answer: entry.answer }]));
  };

  const toggleSaved = (id: string) =>
    mutateDb((d) => {
      const e = d.askHistory.find((x) => x.id === id);
      if (e) e.saved = !e.saved;
    });

  const clear = () =>
    mutateDb((d) => {
      const mine = canSeeAll && filter === "all";
      d.askHistory = d.askHistory.filter((e) => e.saved || (!mine && e.by !== me.sub));
    });

  if (!allowed) {
    return (
      <>
        <PageHeader title="Ask the data" />
        <div className="p-6">
          <EmptyState title="You don't have access to this page" />
        </div>
      </>
    );
  }

  const history = (
    <AskHistory db={db} me={me} canSeeAll={canSeeAll} filter={filter} onFilter={setFilter} activeId={turns[turns.length - 1]?.id ?? null} onOpen={reopen} onToggleSaved={toggleSaved} onClear={clear} />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {node}
      <PageHeader title="Ask the data" subtitle="Plain-English questions over enquiries, bookings, payments, travellers, tasks and calls. Every answer shows how it was counted.">
        <Button variant="outline" size="sm" className="md:hidden" onClick={() => setHistoryOpen(true)}>
          <History className="h-4 w-4" /> History
        </Button>
        {turns.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setTurns([])}>
            New chat
          </Button>
        )}
      </PageHeader>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-border bg-card md:block lg:w-80">{history}</aside>

        <section className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 md:p-6" data-scroll-container>
            {turns.length === 0 && !busy ? (
              <div className="mx-auto mt-6 max-w-lg text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                  <MessageSquareText className="h-6 w-6" />
                </div>
                <h2 className="font-display text-lg font-semibold">What do you want to know?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Ask in plain English, or type a traveller name or reference like WT-1045 for a summary. Pick an example below to start.</p>
              </div>
            ) : (
              turns.map((t, i) => (
                <div key={t.id} className="space-y-3">
                  <div className="flex items-start justify-end gap-2">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">{t.question}</div>
                    <Avatar name={me.name} className="mt-0.5 h-7 w-7" />
                  </div>
                  <AnswerCard question={t.question} answer={t.answer} followUps={i === turns.length - 1 ? followUpsFor(t.question, db) : []} onAsk={ask} onToast={toast} />
                </div>
              ))
            )}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-500" />
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-500 [animation-delay:200ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-500 [animation-delay:400ms]" />
                </span>
                Looking through the data…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <AskComposer value={draft} onChange={setDraft} onSubmit={ask} busy={busy} showExamples={turns.length === 0} />
        </section>
      </div>

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} side="left" title="History" scrollBody={false}>
        {history}
      </Sheet>
    </div>
  );
}
