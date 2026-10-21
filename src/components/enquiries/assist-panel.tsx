"use client";

import * as React from "react";
import { Bot, Copy, ListPlus, RefreshCw, Send, Sparkles } from "lucide-react";
import type { Enquiry } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { destinationById, itinerariesForEnquiry, logActivity, messagesForEnquiry, tasksForEnquiry, travellerById, userName } from "@/lib/demo/queries";
import { assistForEnquiry, type AssistOutput } from "@/lib/ai/assist";
import { CHANNEL_LABEL } from "@/lib/pipeline";
import { Button, Card, ScoreBadge } from "@/components/ui";
import { ChannelBadge, SectionTitle } from "@/components/shared";
import { cn, addDays, copyToClipboard, formatDateTime } from "@/lib/utils";
import { touch, type Actor } from "./booking-actions";

/** Results survive tab switches inside the drawer (component state alone would be lost on unmount). */
const cache = new Map<string, AssistOutput>();

const PRIORITY_CLASS = { high: "bg-rose-100 text-rose-700", medium: "bg-amber-100 text-amber-800", low: "bg-zinc-100 text-zinc-600" } as const;

export function AssistPanel({ enquiry: e, actor, canAct, onToast }: { enquiry: Enquiry; actor: Actor; canAct: boolean; onToast: (m: string) => void }) {
  const db = useDb();
  const [result, setResult] = React.useState<AssistOutput | null>(() => cache.get(e.id) ?? null);
  const [thinking, setThinking] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [created, setCreated] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const hit = cache.get(e.id) ?? null;
    setResult(hit);
    setDraft(hit?.draft.body ?? "");
    setCreated(new Set());
  }, [e.id]);

  function generate() {
    setThinking(true);
    const traveller = travellerById(db, e.travellerId);
    if (!traveller) return;
    const out = assistForEnquiry({
      enquiry: e,
      traveller,
      destination: destinationById(db, e.destinationId),
      messages: messagesForEnquiry(db, e.id),
      itineraries: itinerariesForEnquiry(db, e.id),
      tasks: tasksForEnquiry(db, e.id),
      consultantName: (e.assignedTo ? userName(db, e.assignedTo) : actor.name).split(" ")[0] || "wishtrip",
    });
    window.setTimeout(() => {
      cache.set(e.id, out);
      setResult(out);
      setDraft(out.draft.body);
      setThinking(false);
    }, 600);
  }

  function sendDraft() {
    if (!result || !draft.trim()) return;
    mutateDb((d) => {
      const now = nowIso();
      d.messages.push({ id: newId("msg"), travellerId: e.travellerId, enquiryId: e.id, channel: result.draft.channel, direction: "outbound", body: draft.trim(), at: now, sentBy: actor.sub, status: "sent" });
      const enq = d.enquiries.find((x) => x.id === e.id);
      if (enq) {
        if (enq.stage === "new") { enq.stage = "contacted"; enq.lastStageChangeAt = now; }
        enq.needsAttention = false;
        touch(enq, now);
      }
      logActivity(d, { actor: actor.name, actorKind: "user", type: "message_sent", text: `Sent AI-drafted reply on ${CHANNEL_LABEL[result.draft.channel]}`, enquiryId: e.id, travellerId: e.travellerId });
    });
    onToast(`Sent on ${CHANNEL_LABEL[result.draft.channel]}`);
  }

  function createTask(a: AssistOutput["nextActions"][number]) {
    mutateDb((d) => {
      d.tasks.push({ id: newId("task"), title: a.title, kind: "follow_up", enquiryId: e.id, travellerId: e.travellerId, tripId: e.tripId, assignedTo: e.assignedTo ?? actor.sub, dueAt: addDays(new Date(), 1).toISOString(), status: "open", priority: a.priority === "high" ? "high" : a.priority === "low" ? "low" : "normal", createdBy: actor.sub, createdAt: nowIso(), notes: a.reason });
      logActivity(d, { actor: actor.name, actorKind: "user", type: "task_created", text: `Task from AI assist: ${a.title}`, enquiryId: e.id, travellerId: e.travellerId });
    });
    setCreated((s) => new Set(s).add(a.title));
    onToast("Task created for tomorrow");
  }

  function applyScore() {
    if (!result) return;
    mutateDb((d) => {
      const enq = d.enquiries.find((x) => x.id === e.id);
      if (!enq) return;
      enq.aiScore = result.score;
      enq.aiSummary = result.summary;
      enq.aiNextAction = result.nextActions[0]?.title;
      d.agentEvents.unshift({ id: newId("evt"), agent: "scoring", at: nowIso(), enquiryId: e.id, travellerId: e.travellerId, action: "Re-scored conversion likelihood", detail: `${result.score}/100 — ${result.reasons.filter((r) => r.delta > 0).slice(0, 2).map((r) => r.label.toLowerCase()).join(", ") || "baseline"}`, confidence: 0.8, status: "info" });
    });
    onToast("Score updated on enquiry");
  }

  if (!result && !thinking) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Sparkles className="h-6 w-6" /></span>
        <p className="text-sm font-medium">Let Wish read the thread</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">Summarises the conversation, explains the score, proposes next actions and drafts a reply in the traveller&apos;s channel.</p>
        <Button className="mt-4" onClick={generate}><Sparkles className="h-4 w-4" />Generate</Button>
      </div>
    );
  }

  if (thinking || !result) {
    return (
      <div className="space-y-3 p-4" aria-busy>
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="h-4 w-4 animate-pulse-soft text-brand-600" />Thinking…</div>
        {[80, 95, 60, 70].map((w, i) => <div key={i} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScoreBadge score={result.score} className="scale-125" />
          <div>
            <p className="text-sm font-semibold">Conversion likelihood {result.score}/100</p>
            <p className="text-[11px] text-muted-foreground">Generated {formatDateTime(result.generatedAt)}{e.aiScore !== result.score ? ` · enquiry shows ${e.aiScore ?? "—"}` : ""}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {canAct && e.aiScore !== result.score && <Button size="sm" variant="secondary" onClick={applyScore}>Apply score</Button>}
          <Button size="sm" variant="ghost" onClick={generate} title="Regenerate"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {result.reasons.map((r) => (
          <span key={r.label} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", r.delta >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700")}>
            {r.delta >= 0 ? "+" : ""}{r.delta} {r.label}
          </span>
        ))}
      </div>

      <Card className="p-3">
        <SectionTitle>Summary</SectionTitle>
        <p className="text-sm leading-relaxed">{result.summary}</p>
      </Card>

      <section>
        <SectionTitle>Suggested next actions</SectionTitle>
        <ul className="space-y-2">
          {result.nextActions.map((a) => (
            <li key={a.title} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{a.title}</span>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase", PRIORITY_CLASS[a.priority])}>{a.priority}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
              </div>
              {canAct && (
                <Button size="sm" variant="outline" disabled={created.has(a.title)} onClick={() => createTask(a)} className="shrink-0">
                  <ListPlus className="h-3.5 w-3.5" />{created.has(a.title) ? "Added" : "Create task"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle action={<ChannelBadge channel={result.draft.channel} />}>Draft reply</SectionTitle>
        <textarea value={draft} onChange={(ev) => setDraft(ev.target.value)} rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Draft reply" />
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" onClick={async () => onToast((await copyToClipboard(draft)) ? "Copied" : "Couldn't copy")}><Copy className="h-3.5 w-3.5" />Copy</Button>
          {canAct && <Button size="sm" onClick={sendDraft} disabled={!draft.trim()}><Send className="h-3.5 w-3.5" />Send as message</Button>}
        </div>
      </section>
    </div>
  );
}
