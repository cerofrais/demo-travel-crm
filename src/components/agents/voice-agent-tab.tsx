"use client";

import * as React from "react";
import { Bot, Check, PhoneCall, Play, Save, ShieldCheck, Square } from "lucide-react";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { Field, KV, SectionTitle, Toggle, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { destinationById, logActivity, travellerById, userName } from "@/lib/demo/queries";
import { simulateOutboundQualification } from "@/lib/ai/voice-agent";
import { can } from "@/lib/rbac";
import { TRIP_TYPE_LABEL } from "@/lib/pipeline";
import type { Call, Language, VoiceAgentConfig } from "@/lib/demo/types";
import { cn, formatINR, paxLabel } from "@/lib/utils";
import { saveVoiceCall } from "@/components/calls/call-utils";
import { ChipEditor, ChipSelect } from "./agent-meta";

const LANGS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
  { value: "te", label: "Telugu" },
  { value: "ta", label: "Tamil" },
  { value: "mr", label: "Marathi" },
  { value: "gu", label: "Gujarati" },
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VOICES = ["Warm Indian English (female)", "Warm Indian English (male)", "Neutral English (female)", "Hindi-first (female)"];

export function VoiceAgentTab() {
  const db = useDb();
  const user = useCurrentUser();
  const { toast, node } = useToast();
  const canConfigure = can(user.role, "agents.configure");
  const [form, setForm] = React.useState<VoiceAgentConfig>(db.settings.agents.voice);
  const [dirty, setDirty] = React.useState(false);
  React.useEffect(() => {
    if (!dirty) setForm(db.settings.agents.voice);
  }, [db.settings.agents.voice, dirty]);

  function patch(p: Partial<VoiceAgentConfig>) {
    setForm((f) => ({ ...f, ...p }));
    setDirty(true);
  }
  function save() {
    mutateDb((d) => {
      d.settings.agents.voice = { ...form, maxCallMinutes: Math.max(1, Number(form.maxCallMinutes) || 8), callNewLeadsWithinMin: Math.max(0, Number(form.callNewLeadsWithinMin) || 0) };
      logActivity(d, { actor: user.name, actorKind: "user", type: "settings_changed", text: `Updated voice agent (${form.name}) configuration` });
    });
    setDirty(false);
    toast("Voice agent settings saved");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="p-4 lg:col-span-3">
        <SectionTitle action={canConfigure && <Button size="sm" onClick={save} disabled={!dirty}><Save className="h-3.5 w-3.5" /> Save</Button>}>Configuration</SectionTitle>
        <fieldset disabled={!canConfigure} className="grid gap-3 sm:grid-cols-2">
          <Field label="Agent name"><Input value={form.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
          <Field label="Voice">
            <Select value={form.voice} onChange={(e) => patch({ voice: e.target.value })}>
              {[form.voice, ...VOICES.filter((v) => v !== form.voice)].map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Languages</div>
            <ChipSelect options={LANGS} values={form.languages} onChange={(v) => patch({ languages: v })} disabled={!canConfigure} />
          </div>
          <Field label="Greeting" className="sm:col-span-2"><Textarea rows={2} value={form.greeting} onChange={(e) => patch({ greeting: e.target.value })} /></Field>
          <Field label="Hours start"><Input type="time" value={form.hours.start} onChange={(e) => patch({ hours: { ...form.hours, start: e.target.value } })} /></Field>
          <Field label="Hours end"><Input type="time" value={form.hours.end} onChange={(e) => patch({ hours: { ...form.hours, end: e.target.value } })} /></Field>
          <div className="sm:col-span-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Days</div>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => {
                const on = form.hours.days.includes(i);
                return (
                  <button key={d} type="button" onClick={() => patch({ hours: { ...form.hours, days: on ? form.hours.days.filter((x) => x !== i) : [...form.hours.days, i].sort() } })} className={cn("h-9 w-11 rounded-md border text-xs font-medium", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="After hours">
            <Select value={form.afterHoursMode} onChange={(e) => patch({ afterHoursMode: e.target.value as VoiceAgentConfig["afterHoursMode"] })}>
              <option value="answer">Answer anyway</option>
              <option value="voicemail">Voicemail</option>
              <option value="whatsapp_fallback">WhatsApp fallback</option>
            </Select>
          </Field>
          <Field label="Max call minutes"><Input type="number" min={1} max={30} value={form.maxCallMinutes} onChange={(e) => patch({ maxCallMinutes: Number(e.target.value) })} /></Field>
          <div className="sm:col-span-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Escalate on</div>
            <ChipEditor values={form.escalateOn} onChange={(v) => patch({ escalateOn: v })} placeholder="Add topic (e.g. medical)" disabled={!canConfigure} suggestions={["cancellation", "refund", "complaint", "medical", "payment dispute", "visa rejection", "legal"]} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 sm:col-span-2">
            <div>
              <div className="text-sm font-medium">Outbound calls to new leads</div>
              <div className="text-xs text-muted-foreground">Call every new enquiry within the window below</div>
            </div>
            <Toggle checked={form.outboundEnabled} onChange={(v) => patch({ outboundEnabled: v })} disabled={!canConfigure} />
          </div>
          <Field label="Call new leads within (min)"><Input type="number" min={0} value={form.callNewLeadsWithinMin} onChange={(e) => patch({ callNewLeadsWithinMin: Number(e.target.value) })} /></Field>
          <Field label="Phone number"><Input value={form.phoneNumber} onChange={(e) => patch({ phoneNumber: e.target.value })} /></Field>
          <Field label="Tone" className="sm:col-span-2"><Textarea rows={2} value={form.tone} onChange={(e) => patch({ tone: e.target.value })} /></Field>
        </fieldset>
        {!canConfigure && <p className="mt-3 text-xs text-muted-foreground">Your role can view but not change agent configuration.</p>}
      </Card>
      <div className="space-y-4 lg:col-span-2">
        <TestCallPanel />
        <PolicyCard name={form.name} />
      </div>
      {node}
    </div>
  );
}

function PolicyCard({ name }: { name: string }) {
  return (
    <Card className="p-4">
      <SectionTitle>Call policy</SectionTitle>
      <div className="space-y-3 text-sm">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> What {name} does</div>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-foreground/85">
            <li>Calls new leads within minutes to confirm month, travellers and budget per person</li>
            <li>Answers FAQs: visa requirements, &ldquo;price from&rdquo; per destination, booking and voucher status</li>
            <li>Moves the enquiry to Qualified and promises a WhatsApp plan from the consultant</li>
            <li>Switches to Hindi/Hinglish when the caller does</li>
          </ul>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-rose-700"><Square className="h-3.5 w-3.5" /> What she never does</div>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-foreground/85">
            <li>Quote refunds, cancellation fees or discounts</li>
            <li>Confirm availability or a final price</li>
            <li>Advise on medical, insurance claims or visa rejections</li>
          </ul>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-700"><ShieldCheck className="h-3.5 w-3.5" /> Hand-off path</div>
          <p className="text-xs text-foreground/85">Escalation topic → warm transfer to the assigned consultant; if unavailable, an urgent callback task (due in 60 min) plus a WhatsApp acknowledgement to the caller. Every hand-off lands in the review queue.</p>
        </div>
      </div>
    </Card>
  );
}

function TestCallPanel() {
  const db = useDb();
  const user = useCurrentUser();
  const { toast, node } = useToast();
  const canWork = can(user.role, "enquiries.work") || can(user.role, "enquiries.manage");
  const candidates = React.useMemo(() => db.enquiries.filter((e) => e.stage === "new" || e.stage === "contacted").sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db]);
  const [enquiryId, setEnquiryId] = React.useState("");
  const [call, setCall] = React.useState<Omit<Call, "id"> | null>(null);
  const [shown, setShown] = React.useState(0);
  const [running, setRunning] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const effectiveId = enquiryId || candidates[0]?.id || "";

  React.useEffect(() => {
    if (!running || !call) return;
    const id = window.setInterval(() => {
      setShown((s) => {
        if (s + 1 >= call.transcript.length) {
          window.clearInterval(id);
          setRunning(false);
          return call.transcript.length;
        }
        return s + 1;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [running, call]);

  function run() {
    const e = db.enquiries.find((x) => x.id === effectiveId);
    const t = travellerById(db, e?.travellerId);
    if (!e || !t) return;
    const c = simulateOutboundQualification({ enquiry: e, traveller: t, destination: destinationById(db, e.destinationId), config: db.settings.agents.voice, consultantName: e.assignedTo ? userName(db, e.assignedTo).split(" ")[0] : "Your consultant", answered: true });
    setCall(c);
    setShown(1);
    setSaved(false);
    setRunning(true);
  }
  function persist() {
    const e = db.enquiries.find((x) => x.id === effectiveId);
    const t = travellerById(db, e?.travellerId);
    if (!e || !t || !call) return;
    mutateDb((d) => saveVoiceCall(d, { enquiry: e, traveller: t, answered: true, prebuilt: call }));
    setSaved(true);
    toast("Call saved — enquiry moved to Qualified");
  }

  const visible = call ? call.transcript.slice(0, shown) : [];
  const progress = call ? shown / call.transcript.length : 0;
  const x = call?.extracted;
  const reveal = (threshold: number) => progress >= threshold;

  return (
    <Card className="p-4">
      <SectionTitle>Test call simulator</SectionTitle>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={effectiveId} onChange={(e) => { setEnquiryId(e.target.value); setCall(null); }} className="min-w-0 flex-1" aria-label="Enquiry to call">
          {candidates.length === 0 && <option value="">No enquiries in New / Contacted</option>}
          {candidates.map((e) => (
            <option key={e.id} value={e.id}>{e.ref} · {travellerById(db, e.travellerId)?.fullName} · {e.destination}</option>
          ))}
        </Select>
        <Button onClick={run} disabled={!effectiveId || running} className="shrink-0">
          <Play className="h-4 w-4" /> {running ? "On call…" : "Run test call"}
        </Button>
      </div>
      {call && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PhoneCall className={cn("h-3.5 w-3.5", running ? "animate-pulse-soft text-emerald-600" : "text-muted-foreground")} />
            {running ? `Calling ${call.phone}…` : `Call ended · ${Math.floor(call.durationSec / 60)}:${String(call.durationSec % 60).padStart(2, "0")}`}
          </div>
          <ol className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg bg-sand-50 p-2">
            {visible.map((l, i) => (
              <li key={i} className={cn("flex gap-2 text-sm animate-fade-in", l.speaker === "agent" ? "" : "flex-row-reverse")}>
                <span className={cn("max-w-[85%] rounded-xl px-3 py-1.5", l.speaker === "agent" ? "rounded-tl-sm bg-brand-100 text-brand-900" : "rounded-tr-sm bg-card shadow-sm")}>
                  <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">{l.speaker === "agent" ? <><Bot className="h-3 w-3" />{db.settings.agents.voice.name}</> : "Caller"}</span>
                  <br />
                  {l.text}
                </span>
              </li>
            ))}
          </ol>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Extracted live</div>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-3">
              <KV label="Destination" value={reveal(0.1) ? x?.destination : <Pending />} />
              <KV label="Month" value={reveal(0.4) ? (x?.travelMonth ? new Date(x.travelMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "—") : <Pending />} />
              <KV label="Travellers" value={reveal(0.4) && x?.pax ? paxLabel(x.pax) : <Pending />} />
              <KV label="Budget" value={reveal(0.6) && x?.budgetINR != null ? formatINR(x.budgetINR) : <Pending />} />
              <KV label="Trip type" value={reveal(0.6) && x?.tripType ? TRIP_TYPE_LABEL[x.tripType] : <Pending />} />
              <KV label="Outcome" value={reveal(1) ? <span className="font-medium text-emerald-700">Qualified</span> : <Pending />} />
            </div>
          </div>
          {!running && canWork && (
            <Button onClick={persist} disabled={saved} className="w-full sm:w-auto">
              <Save className="h-4 w-4" /> {saved ? "Saved" : "Save this call"}
            </Button>
          )}
        </div>
      )}
      {node}
    </Card>
  );
}

function Pending() {
  return <span className="inline-block h-3 w-16 animate-pulse-soft rounded bg-muted" />;
}
