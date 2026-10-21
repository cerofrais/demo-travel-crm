"use client";

import * as React from "react";
import { Download, Languages, Pause, Play, Sparkles, FileText, RefreshCw } from "lucide-react";
import { Badge, Button, ScoreBadge } from "@/components/ui";
import { KV, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { enquiryById, logActivity, travellerById, userName } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { TRIP_TYPE_LABEL } from "@/lib/pipeline";
import { analyseCall, transcribeCall, transcriptToText } from "@/lib/ai/call-analysis";
import type { Call, TranscriptLine } from "@/lib/demo/types";
import { cn, downloadText, formatINR, paxLabel } from "@/lib/utils";
import { formatDuration, handledByLabel } from "./call-utils";

/**
 * Expanded call detail: recording player synced with the transcript (click
 * a line to seek), English translation toggle, transcribe-on-demand for
 * manually logged calls, and AI call analysis with coaching.
 */
export function CallDetail({ call }: { call: Call }) {
  const db = useDb();
  const user = useCurrentUser();
  const { toast, node } = useToast();
  const x = call.extracted;
  const agentName = call.kind === "voice_agent" ? db.settings.agents.voice.name : handledByLabel(db, call).split(" ")[0];
  const callerName = call.travellerId ? travellerById(db, call.travellerId)?.fullName.split(" ")[0] ?? "Caller" : "Caller";
  const [pos, setPos] = React.useState(0);
  const [showEnglish, setShowEnglish] = React.useState(false);
  const [busy, setBusy] = React.useState<"transcribe" | "analyse" | null>(null);
  const canWork = can(user.role, "enquiries.work") || can(user.role, "enquiries.manage") || can(user.role, "agents.review");
  const nonEnglish = call.language !== "en";
  const lines: TranscriptLine[] = showEnglish && call.translation ? call.translation : call.transcript;
  // The line whose timestamp the playhead has passed most recently.
  const activeIdx = lines.reduce((acc, l, i) => (l.t <= pos ? i : acc), -1);

  function ctx() {
    const enquiry = enquiryById(db, call.enquiryId);
    return { enquiry, traveller: travellerById(db, call.travellerId), consultantName: call.kind === "human" ? userName(db, call.handledBy) : "Aanya" };
  }

  function transcribe() {
    setBusy("transcribe");
    window.setTimeout(() => {
      mutateDb((d) => {
        const c = d.calls.find((k) => k.id === call.id);
        if (!c) return;
        const t = transcribeCall(c, ctx());
        c.transcript = t.transcript;
        c.translation = t.translation;
        c.transcribedAt = nowIso();
        logActivity(d, { actor: user.name, actorSub: user.sub, actorKind: "user", type: "call_transcribed", text: `Transcribed ${c.direction} call with ${callerName}`, enquiryId: c.enquiryId, travellerId: c.travellerId });
      });
      setBusy(null);
      toast("Transcript ready");
    }, 1100);
  }

  function analyse() {
    setBusy("analyse");
    window.setTimeout(() => {
      mutateDb((d) => {
        const c = d.calls.find((k) => k.id === call.id);
        if (!c) return;
        c.analysis = analyseCall(c, ctx());
        c.qualityScore = c.analysis.score;
        d.agentEvents.unshift({
          id: newId("evt"),
          agent: "voice",
          at: nowIso(),
          enquiryId: c.enquiryId,
          travellerId: c.travellerId,
          action: "Analysed call recording",
          detail: `Quality ${c.analysis.score}/100 · ${c.analysis.tags.join(", ") || "no tags"} · ${c.analysis.summary}`,
          confidence: 0.84,
          status: "info",
          model: "claude-sonnet-5-5",
          payload: { callId: c.id, tags: c.analysis.tags },
        });
        logActivity(d, { actor: user.name, actorSub: user.sub, actorKind: "user", type: "call_analysed", text: `Analysed call with ${callerName} — quality ${c.analysis.score}/100`, enquiryId: c.enquiryId, travellerId: c.travellerId });
      });
      setBusy(null);
      toast("Call analysed");
    }, 900);
  }

  return (
    <div className="space-y-4">
      {node}
      {call.recordingAvailable && <RecordingPlayer durationSec={call.durationSec} pos={pos} onPos={setPos} />}

      {call.summary && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Summary</div>
          <p className="text-sm">{call.summary}</p>
        </div>
      )}

      {x && Object.keys(x).length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Extracted fields</div>
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-sand-50 p-3 sm:grid-cols-3">
            {x.destination && <KV label="Destination" value={x.destination} />}
            {x.travelMonth && <KV label="Month" value={new Date(x.travelMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })} />}
            {x.nights != null && <KV label="Nights" value={x.nights} />}
            {x.pax && <KV label="Travellers" value={paxLabel(x.pax)} />}
            {x.budgetINR != null && <KV label="Budget" value={formatINR(x.budgetINR)} />}
            {x.tripType && <KV label="Trip type" value={TRIP_TYPE_LABEL[x.tripType]} />}
            {x.departureCity && <KV label="Departure" value={x.departureCity} />}
          </div>
        </div>
      )}

      {/* AI analysis */}
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" /> AI call analysis
            {call.analysis && <ScoreBadge score={call.analysis.score} />}
          </div>
          {canWork && (
            <Button size="sm" variant={call.analysis ? "ghost" : "secondary"} onClick={analyse} disabled={busy != null || call.transcript.length === 0} title={call.transcript.length === 0 ? "Transcribe the call first" : undefined}>
              {busy === "analyse" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy === "analyse" ? "Analysing…" : call.analysis ? "Re-analyse" : "Analyse with AI"}
            </Button>
          )}
        </div>
        {call.analysis ? (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-1">
              {call.analysis.tags.map((t) => (
                <Badge key={t} className="bg-brand-100 text-brand-700">{t}</Badge>
              ))}
            </div>
            <dl className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["Opening", call.analysis.coaching.opening],
                  ["Explanation", call.analysis.coaching.explanation],
                  ["Professionalism", call.analysis.coaching.professionalism],
                  ["Next steps", call.analysis.coaching.nextSteps],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-md bg-sand-50 p-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 text-xs text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-muted-foreground">Analysed {new Date(call.analysis.analysedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · quality score blends opening, questions asked, commitments made and outcome.</p>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{call.transcript.length === 0 ? "Transcribe the recording to score it." : "Not analysed yet — scores the call and suggests coaching for the consultant."}</p>
        )}
      </div>

      {/* Transcript */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Transcript · {showEnglish ? "English translation" : call.language}
            {call.transcribedAt && <span className="ml-1 normal-case tracking-normal">· transcribed {new Date(call.transcribedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
          <div className="flex items-center gap-1">
            {nonEnglish && call.translation && (
              <Button size="sm" variant="ghost" onClick={() => setShowEnglish((v) => !v)}>
                <Languages className="h-3.5 w-3.5" /> {showEnglish ? "Show original" : "English"}
              </Button>
            )}
            {call.transcript.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => downloadText(`${call.id}-transcript.txt`, transcriptToText(call, lines, agentName, callerName))}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            )}
          </div>
        </div>
        {lines.length > 0 ? (
          <ol className="space-y-1.5">
            {lines.map((l, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <button type="button" onClick={() => setPos(l.t)} className="w-10 shrink-0 pt-0.5 text-left text-[11px] tabular-nums text-muted-foreground hover:text-primary" title="Jump to this moment">
                  {formatDuration(l.t)}
                </button>
                <span className={cn("w-16 shrink-0 truncate text-xs font-semibold", l.speaker === "agent" ? "text-brand-700" : "text-clay-600")}>{l.speaker === "agent" ? agentName : callerName}</span>
                <span className={cn("flex-1 rounded-md px-2 py-1 transition-colors", l.speaker === "agent" ? "bg-brand-50" : "bg-sand-100", i === activeIdx && "ring-2 ring-saffron-400")}>{l.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">No transcript yet — this call was logged manually. {call.recordingAvailable ? "The recording can be transcribed." : ""}</p>
            {canWork && call.recordingAvailable && (
              <Button size="sm" variant="secondary" onClick={transcribe} disabled={busy != null}>
                {busy === "transcribe" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                {busy === "transcribe" ? "Transcribing…" : "Transcribe recording"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Fake recording player: animates a playhead over durationSec (no audio); controlled so the transcript can seek it. */
export function RecordingPlayer({ durationSec, pos, onPos }: { durationSec: number; pos?: number; onPos?: (p: number) => void }) {
  const [playing, setPlaying] = React.useState(false);
  const [inner, setInner] = React.useState(0);
  const value = pos ?? inner;
  const set = React.useCallback(
    (p: number) => {
      setInner(p);
      onPos?.(p);
    },
    [onPos],
  );
  const ref = React.useRef(value);
  ref.current = value;
  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const next = ref.current + 1;
      if (next >= durationSec) {
        window.clearInterval(id);
        setPlaying(false);
        set(durationSec);
      } else set(next);
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, durationSec, set]);
  const pct = durationSec > 0 ? (value / durationSec) * 100 : 0;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-sand-50 px-3 py-2">
      <button
        type="button"
        onClick={() => {
          if (value >= durationSec) set(0);
          setPlaying((p) => !p);
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        aria-label={playing ? "Pause recording" : "Play recording"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
      </button>
      <div
        className="min-w-0 flex-1 cursor-pointer"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          set(Math.round(((e.clientX - r.left) / r.width) * durationSec));
        }}
        role="slider"
        aria-valuenow={Math.round(pct)}
        aria-label="Recording position"
      >
        <div className="flex items-end gap-px" style={{ height: 22 }}>
          {Array.from({ length: 48 }).map((_, i) => {
            const h = 6 + ((i * 7919) % 15);
            const on = (i / 48) * 100 <= pct;
            return <span key={i} className={cn("flex-1 rounded-sm", on ? "bg-brand-500" : "bg-brand-200/70")} style={{ height: h }} />;
          })}
        </div>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatDuration(value)} / {formatDuration(durationSec)}
      </span>
    </div>
  );
}
