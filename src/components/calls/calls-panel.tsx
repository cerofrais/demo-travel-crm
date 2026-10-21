"use client";

import * as React from "react";
import { Bot, ChevronDown, ChevronUp, Pause, Phone, PhoneIncoming, PhoneOutgoing, Play, PhoneCall, Plus } from "lucide-react";
import { Badge, Button, Dialog, Input, ScoreBadge, Select, Textarea } from "@/components/ui";
import { EmptyState, Field, KV, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { callsForEnquiry, enquiryById, travellerById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { TRIP_TYPE_LABEL } from "@/lib/pipeline";
import type { Call, CallOutcome } from "@/lib/demo/types";
import { cn, formatDateTime, formatINR, paxLabel } from "@/lib/utils";
import { CALL_STATUS_CLASS, OUTCOME_CLASS, OUTCOME_LABEL, SENTIMENT_CLASS, formatDuration, handledByLabel, saveHumanCall, saveVoiceCall } from "./call-utils";

/** Calls for one enquiry + "Call with Aanya" and "Log a call". */
export function CallsPanel({ enquiryId }: { enquiryId: string }) {
  const db = useDb();
  const user = useCurrentUser();
  const { toast, node } = useToast();
  const enquiry = enquiryById(db, enquiryId);
  const traveller = travellerById(db, enquiry?.travellerId);
  const calls = callsForEnquiry(db, enquiryId);
  const [dialling, setDialling] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  const [open, setOpen] = React.useState<string | null>(null);
  const voice = db.settings.agents.voice;
  const canWork = can(user.role, "enquiries.work") || can(user.role, "enquiries.manage");

  function callWithAanya() {
    if (!enquiry || !traveller) return;
    setDialling(true);
    window.setTimeout(() => {
      let answered = false;
      mutateDb((d) => {
        const c = saveVoiceCall(d, { enquiry, traveller, answered: Math.random() > 0.25 });
        answered = c.status === "completed";
        setOpen(c.id);
      });
      setDialling(false);
      toast(answered ? `${voice.name} qualified the lead on a call` : `No answer — ${voice.name} left a voicemail`);
    }, 1200);
  }

  if (!enquiry) return <EmptyState icon={Phone} title="Enquiry not found" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{calls.length} call{calls.length === 1 ? "" : "s"} on this enquiry</div>
        {canWork && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={callWithAanya} disabled={dialling || !voice.enabled || !traveller} title={!voice.enabled ? "Voice agent is switched off" : undefined}>
              {dialling ? <span className="h-3.5 w-3.5 animate-pulse-soft rounded-full bg-white" /> : <Bot className="h-3.5 w-3.5" />}
              {dialling ? "Dialling…" : `Call with ${voice.name} (voice agent)`}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setLogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Log a call
            </Button>
          </div>
        )}
      </div>
      {dialling && (
        <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          <PhoneCall className="h-4 w-4 animate-pulse-soft" /> {voice.name} is dialling {traveller?.phone}…
        </div>
      )}
      {calls.length === 0 && !dialling && <EmptyState icon={Phone} title="No calls yet" hint={`Let ${voice.name} qualify this lead in under two minutes, or log a call you made.`} />}
      <div className="space-y-2">
        {calls.map((c) => (
          <CallRow key={c.id} call={c} expanded={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} />
        ))}
      </div>
      <LogCallDialog open={logOpen} onClose={() => setLogOpen(false)} enquiryId={enquiryId} onSaved={() => toast("Call logged")} />
      {node}
    </div>
  );
}

function CallRow({ call, expanded, onToggle }: { call: Call; expanded: boolean; onToggle: () => void }) {
  const db = useDb();
  const Dir = call.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
  return (
    <div className="rounded-lg border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 p-3 text-left">
        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", call.kind === "voice_agent" ? "bg-brand-100 text-brand-700" : "bg-sand-100 text-ink-600")}>
          <Dir className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-medium">{handledByLabel(db, call)}</span>
            {call.kind === "voice_agent" && <Bot className="h-3.5 w-3.5 text-brand-600" />}
            <span className="text-muted-foreground">· {call.direction}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{formatDateTime(call.startedAt)}</span>
            <span>· {formatDuration(call.durationSec)}</span>
            <Badge className={CALL_STATUS_CLASS[call.status]}>{call.status.replace("_", " ")}</Badge>
            {call.outcome && <Badge className={OUTCOME_CLASS[call.outcome]}>{OUTCOME_LABEL[call.outcome]}</Badge>}
            {call.sentiment && <span className={cn("capitalize", SENTIMENT_CLASS[call.sentiment])}>{call.sentiment}</span>}
            {call.qualityScore != null && <ScoreBadge score={call.qualityScore} />}
          </div>
          {!expanded && call.summary && <p className="mt-1 line-clamp-1 text-xs text-foreground/80">{call.summary}</p>}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="border-t border-border p-3">
          <CallDetail call={call} />
        </div>
      )}
    </div>
  );
}

/** Expanded call detail: summary, extracted fields, transcript, fake recording player. Reused by the Calls page sheet. */
export function CallDetail({ call }: { call: Call }) {
  const db = useDb();
  const x = call.extracted;
  const agentName = call.kind === "voice_agent" ? db.settings.agents.voice.name : handledByLabel(db, call).split(" ")[0];
  const callerName = call.travellerId ? db.travellers.find((t) => t.id === call.travellerId)?.fullName.split(" ")[0] ?? "Caller" : "Caller";
  return (
    <div className="space-y-4">
      {call.recordingAvailable && <RecordingPlayer durationSec={call.durationSec} />}
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
      {call.transcript.length > 0 ? (
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Transcript · {call.language}</div>
          <ol className="space-y-1.5">
            {call.transcript.map((l, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="w-10 shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">{formatDuration(l.t)}</span>
                <span className={cn("w-16 shrink-0 truncate text-xs font-semibold", l.speaker === "agent" ? "text-brand-700" : "text-clay-600")}>{l.speaker === "agent" ? agentName : callerName}</span>
                <span className={cn("flex-1 rounded-md px-2 py-1", l.speaker === "agent" ? "bg-brand-50" : "bg-sand-100")}>{l.text}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No transcript — consultant call logged manually.</p>
      )}
    </div>
  );
}

/** Fake recording player: animates progress over durationSec, no audio. */
export function RecordingPlayer({ durationSec }: { durationSec: number }) {
  const [playing, setPlaying] = React.useState(false);
  const [pos, setPos] = React.useState(0);
  React.useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setPos((p) => {
        if (p + 1 >= durationSec) {
          window.clearInterval(id);
          setPlaying(false);
          return durationSec;
        }
        return p + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, durationSec]);
  const pct = durationSec > 0 ? (pos / durationSec) * 100 : 0;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-sand-50 px-3 py-2">
      <button
        type="button"
        onClick={() => {
          if (pos >= durationSec) setPos(0);
          setPlaying((p) => !p);
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        aria-label={playing ? "Pause recording" : "Play recording"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-end gap-px" style={{ height: 22 }} role="progressbar" aria-valuenow={Math.round(pct)}>
          {Array.from({ length: 48 }).map((_, i) => {
            const h = 6 + ((i * 7919) % 15);
            const on = (i / 48) * 100 <= pct;
            return <span key={i} className={cn("flex-1 rounded-sm", on ? "bg-brand-500" : "bg-brand-200/70")} style={{ height: h }} />;
          })}
        </div>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatDuration(pos)} / {formatDuration(durationSec)}
      </span>
    </div>
  );
}

const HUMAN_OUTCOMES: CallOutcome[] = ["qualified", "callback", "info", "booked", "not_interested", "no_answer", "voicemail"];

function LogCallDialog({ open, onClose, enquiryId, onSaved }: { open: boolean; onClose: () => void; enquiryId: string; onSaved: () => void }) {
  const user = useCurrentUser();
  const [direction, setDirection] = React.useState<Call["direction"]>("outbound");
  const [minutes, setMinutes] = React.useState("5");
  const [outcome, setOutcome] = React.useState<CallOutcome>("qualified");
  const [summary, setSummary] = React.useState("");
  function save() {
    mutateDb((d) => saveHumanCall(d, { enquiryId, user, direction, minutes: Number(minutes) || 0, outcome, summary: summary.trim() }));
    setSummary("");
    setMinutes("5");
    onSaved();
    onClose();
  }
  return (
    <Dialog open={open} onClose={onClose} title="Log a call">
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Direction">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as Call["direction"])}>
              <option value="outbound">Outbound (I called)</option>
              <option value="inbound">Inbound (they called)</option>
            </Select>
          </Field>
          <Field label="Duration (min)">
            <Input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
        </div>
        <Field label="Outcome">
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)}>
            {HUMAN_OUTCOMES.map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
          </Select>
        </Field>
        <Field label="Summary">
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What was discussed, what's next…" rows={3} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save call</Button>
        </div>
      </div>
    </Dialog>
  );
}
