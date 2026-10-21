"use client";

import * as React from "react";
import { Bot, ChevronDown, ChevronUp, Phone, PhoneIncoming, PhoneOutgoing, PhoneCall, Plus } from "lucide-react";
import { Badge, Button, Dialog, Input, ScoreBadge, Select, Textarea } from "@/components/ui";
import { EmptyState, Field, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { callsForEnquiry, enquiryById, travellerById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import type { Call, CallOutcome } from "@/lib/demo/types";
import { cn, formatDateTime } from "@/lib/utils";
import { CALL_STATUS_CLASS, OUTCOME_CLASS, OUTCOME_LABEL, SENTIMENT_CLASS, formatDuration, handledByLabel, saveHumanCall, saveVoiceCall } from "./call-utils";
import { CallDetail } from "./call-detail";

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

export { CallDetail, RecordingPlayer } from "./call-detail";

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
