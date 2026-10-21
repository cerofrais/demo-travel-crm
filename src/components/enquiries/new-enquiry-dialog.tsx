"use client";

import * as React from "react";
import { PhoneCall, Repeat, Search, UserPlus, X } from "lucide-react";
import type { Channel, Comfort, Enquiry, LeadSource, Pace, Traveller, TripType } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity } from "@/lib/demo/queries";
import { useCurrentUser } from "@/lib/demo/session-client";
import { scoreEnquiry } from "@/lib/ai/scoring";
import { simulateOutboundQualification } from "@/lib/ai/voice-agent";
import { CHANNEL_LABEL, COMFORT_LABEL, PACE_LABEL, SOURCE_LABEL, TRIP_TYPE_LABEL } from "@/lib/pipeline";
import { Avatar, Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { Field } from "@/components/shared";
import { cn, addDays, formatINR } from "@/lib/utils";
import { autoAssign, isConsultant, nextEnquiryRef } from "./booking-actions";

interface State {
  name: string; phone: string; email: string; city: string; instagram: string; channel: Channel;
  destinationId: string; source: LeadSource | ""; tripType: TripType; dateMode: "month" | "dates"; month: string; start: string; end: string;
  nights: number; adults: number; children: number; infants: number; budget: number; pace: Pace; comfort: Comfort; notes: string; assignTo: string; firstMessage: string; voiceCall: boolean;
}

const INITIAL: State = {
  name: "", phone: "", email: "", city: "", instagram: "", channel: "whatsapp",
  destinationId: "", source: "", tripType: "couple", dateMode: "month", month: "", start: "", end: "",
  nights: 5, adults: 2, children: 0, infants: 0, budget: 80000, pace: "balanced", comfort: "comfort", notes: "", assignTo: "auto", firstMessage: "", voiceCall: false,
};

export function NewEnquiryDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (enquiryId: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const [s, setS] = React.useState<State>(INITIAL);
  const [query, setQuery] = React.useState("");
  const [existing, setExisting] = React.useState<Traveller | null>(null);
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));

  React.useEffect(() => {
    if (open) {
      setS(INITIAL);
      setQuery("");
      setExisting(null);
    }
  }, [open]);

  const voice = db.settings.agents.voice;
  const consultants = db.users.filter(isConsultant);
  const dest = db.destinations.find((d) => d.id === s.destinationId);
  const suggested = React.useMemo(() => (s.destinationId ? autoAssign(db, s.destinationId) : undefined), [db, s.destinationId]);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    if (q.length < 2) return [];
    return db.travellers.filter((t) => t.fullName.toLowerCase().includes(q) || (digits.length >= 3 && t.phone.replace(/\D/g, "").includes(digits)) || (t.instagramHandle ?? "").toLowerCase().includes(q)).slice(0, 5);
  }, [db.travellers, query]);

  // Destination picked → sensible nights/budget defaults from the catalogue.
  React.useEffect(() => {
    if (!dest) return;
    setS((p) => ({ ...p, nights: p.nights || 5, budget: Math.round((dest.fromPriceINR * (p.adults + p.children)) / 1000) * 1000 || p.budget }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.destinationId]);

  const valid = Boolean(s.destinationId && s.source && (existing || (s.name.trim() && s.phone.trim())));

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!valid || !dest) return;
    let createdId = "";
    mutateDb((d) => {
      const now = nowIso();
      let traveller = existing ? d.travellers.find((t) => t.id === existing.id) : undefined;
      if (!traveller) {
        traveller = {
          id: newId("trv"), fullName: s.name.trim(), phone: s.phone.trim(), email: s.email.trim() || undefined, city: s.city.trim() || "—", instagramHandle: s.instagram.trim() ? (s.instagram.trim().startsWith("@") ? s.instagram.trim() : `@${s.instagram.trim()}`) : undefined,
          preferredChannel: s.channel, language: "en", nationality: "Indian", foodPref: "no_preference", pace: s.pace, comfort: s.comfort, interests: [], tags: [], blocked: false, tripsCount: 0, lifetimeValueINR: 0, createdAt: now,
        };
        d.travellers.push(traveller);
      }
      const assignment = s.assignTo === "auto" ? autoAssign(d, dest.id) : s.assignTo ? { user: d.users.find((u) => u.sub === s.assignTo)!, reason: "assigned manually" } : undefined;
      const source = (traveller.tripsCount > 0 && s.source !== "referral" ? "repeat" : s.source) as LeadSource;
      const start = s.dateMode === "dates" && s.start ? new Date(`${s.start}T00:00:00`).toISOString() : undefined;
      const end = s.dateMode === "dates" && s.end ? new Date(`${s.end}T00:00:00`).toISOString() : start ? addDays(start, s.nights).toISOString() : undefined;
      const enquiry: Enquiry = {
        id: newId("enq"), ref: nextEnquiryRef(d), travellerId: traveller.id, stage: "new", source,
        destinationId: dest.id, destination: dest.name, altDestinations: [],
        travelStart: start, travelEnd: end, travelMonth: start ? start.slice(0, 7) : s.month || undefined,
        nights: Math.max(1, s.nights), flexibility: start ? "fixed" : "flexible_month",
        pax: { adults: Math.max(1, s.adults), children: Math.max(0, s.children), infants: Math.max(0, s.infants) }, rooms: Math.max(1, Math.ceil(Math.max(1, s.adults) / 2)),
        tripType: s.tripType, pace: s.pace, comfort: s.comfort, foodPref: traveller.foodPref, budgetINR: Math.max(0, s.budget), includeFlights: dest.region === "international", departureCity: traveller.city === "—" ? "Bengaluru" : traveller.city,
        interests: traveller.interests, notes: s.notes.trim() || undefined, assignedTo: assignment?.user.sub, tags: source === "instagram_comment" ? ["ig-plan"] : [],
        aiScore: null, needsAttention: true, handledByAgent: false,
        whatsappWindowExpiresAt: s.firstMessage.trim() && s.channel === "whatsapp" ? addDays(now, 1).toISOString() : undefined,
        createdAt: now, updatedAt: now, lastActivityAt: now, lastInboundAt: s.firstMessage.trim() ? now : undefined, lastStageChangeAt: now,
      };
      enquiry.aiScore = scoreEnquiry(enquiry, { messagesCount: s.firstMessage.trim() ? 1 : 0, hasItinerary: false, traveller });
      d.enquiries.unshift(enquiry);
      createdId = enquiry.id;

      if (s.firstMessage.trim()) {
        d.messages.push({ id: newId("msg"), travellerId: traveller.id, enquiryId: enquiry.id, channel: s.channel === "phone" || s.channel === "sms" ? "whatsapp" : s.channel, direction: "inbound", body: s.firstMessage.trim(), at: now, sentBy: "traveller", status: "read" });
      }
      logActivity(d, { actor: me.name || "You", actorKind: "user", type: "enquiry_created", text: `New enquiry ${enquiry.ref} for ${dest.name} via ${SOURCE_LABEL[source]}`, enquiryId: enquiry.id, travellerId: traveller.id });
      d.agentEvents.unshift({ id: newId("evt"), agent: "assignment", at: now, enquiryId: enquiry.id, travellerId: traveller.id, action: assignment ? "Auto-assigned consultant" : "Left unassigned", detail: assignment ? `${dest.name} enquiry → ${assignment.user.name} (${assignment.reason})` : "No active consultant available — waiting in the unassigned pool", confidence: 1, status: "auto" });
      d.agentEvents.unshift({ id: newId("evt"), agent: "scoring", at: now, enquiryId: enquiry.id, travellerId: traveller.id, action: "Scored conversion likelihood", detail: `${enquiry.aiScore}/100 at intake`, confidence: 0.8, status: "info" });

      if (s.voiceCall && voice.enabled && voice.outboundEnabled) {
        const answered = Math.random() > 0.2;
        const call = simulateOutboundQualification({ enquiry, traveller, destination: dest, config: voice, consultantName: assignment?.user.name.split(" ")[0] ?? "your consultant", answered });
        d.calls.unshift({ id: newId("call"), ...call });
        d.agentEvents.unshift({ id: newId("evt"), agent: "voice", at: now, enquiryId: enquiry.id, travellerId: traveller.id, action: answered ? "Outbound qualification call completed" : "Outbound call — voicemail", detail: call.summary ?? "", confidence: answered ? 0.93 : 0.5, status: "auto" });
        if (answered) {
          enquiry.stage = "qualified";
          enquiry.lastStageChangeAt = now;
          enquiry.handledByAgent = true;
          enquiry.needsAttention = false;
          enquiry.firstResponseMinutes = 1;
          logActivity(d, { actor: voice.name, actorKind: "ai", type: "call", text: `${voice.name} qualified the enquiry on an outbound call → Qualified`, enquiryId: enquiry.id, travellerId: traveller.id });
        } else {
          logActivity(d, { actor: voice.name, actorKind: "ai", type: "call", text: "Outbound call went to voicemail — WhatsApp fallback sent", enquiryId: enquiry.id, travellerId: traveller.id });
        }
      }
    });
    onCreated(createdId);
  }

  return (
    <Dialog open={open} onClose={onClose} title="New enquiry" className="md:max-w-2xl">
      <form onSubmit={submit} className="space-y-5 p-4">
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Traveller</h3>
          {existing ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={existing.fullName} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{existing.fullName} <span className="font-normal text-muted-foreground">· {existing.phone}</span></p>
                  <p className="flex items-center gap-1 text-xs text-emerald-800">
                    {existing.tripsCount > 0 ? <><Repeat className="h-3 w-3" />Returning traveller · {existing.tripsCount} trip{existing.tripsCount === 1 ? "" : "s"} · LTV {formatINR(existing.lifetimeValueINR, { compact: true })}</> : "Known traveller · no trips yet"}
                  </p>
                </div>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setExisting(null)} aria-label="Choose a different traveller"><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder="Search existing travellers by name, phone or @handle…" className="pl-9" />
                {matches.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
                    {matches.map((t) => (
                      <li key={t.id}>
                        <button type="button" onClick={() => { setExisting(t); setQuery(""); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary">
                          <Avatar name={t.fullName} className="h-6 w-6 text-[10px]" />
                          <span className="font-medium">{t.fullName}</span>
                          <span className="text-xs text-muted-foreground">{t.phone} · {t.city}</span>
                          {t.tripsCount > 0 && <span className="ml-auto rounded bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">{t.tripsCount} trip{t.tripsCount === 1 ? "" : "s"}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Name *"><Input value={s.name} onChange={(ev) => set("name", ev.target.value)} required={!existing} /></Field>
                <Field label="Phone *"><Input value={s.phone} onChange={(ev) => set("phone", ev.target.value)} placeholder="+91 98xxx xxxxx" required={!existing} /></Field>
                <Field label="Email"><Input type="email" value={s.email} onChange={(ev) => set("email", ev.target.value)} /></Field>
                <Field label="City"><Input value={s.city} onChange={(ev) => set("city", ev.target.value)} placeholder="Bengaluru" /></Field>
                <Field label="Instagram"><Input value={s.instagram} onChange={(ev) => set("instagram", ev.target.value)} placeholder="@handle" /></Field>
                <Field label="Preferred channel">
                  <Select value={s.channel} onChange={(ev) => set("channel", ev.target.value as Channel)}>
                    {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
                  </Select>
                </Field>
              </div>
            </>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trip</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Destination *">
              <Select value={s.destinationId} onChange={(ev) => set("destinationId", ev.target.value)} required>
                <option value="">Choose…</option>
                {db.destinations.map((d) => <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}
              </Select>
            </Field>
            <Field label="Source *">
              <Select value={s.source} onChange={(ev) => set("source", ev.target.value as LeadSource)} required>
                <option value="">Choose…</option>
                {(Object.keys(SOURCE_LABEL) as LeadSource[]).map((k) => <option key={k} value={k}>{SOURCE_LABEL[k]}</option>)}
              </Select>
            </Field>
            <Field label="Trip type">
              <Select value={s.tripType} onChange={(ev) => set("tripType", ev.target.value as TripType)}>
                {(Object.keys(TRIP_TYPE_LABEL) as TripType[]).map((k) => <option key={k} value={k}>{TRIP_TYPE_LABEL[k]}</option>)}
              </Select>
            </Field>
            <div className="col-span-2 sm:col-span-3">
              <div className="mb-1 flex items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">When</span>
                <span className="inline-flex overflow-hidden rounded-md border border-border text-xs">
                  {(["month", "dates"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => set("dateMode", m)} className={cn("px-2.5 py-1 font-medium", s.dateMode === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>{m === "month" ? "Month" : "Exact dates"}</button>
                  ))}
                </span>
              </div>
              {s.dateMode === "month" ? (
                <div className="grid grid-cols-2 gap-3"><Input type="month" value={s.month} onChange={(ev) => set("month", ev.target.value)} aria-label="Travel month" /><Input type="number" min={1} value={s.nights} onChange={(ev) => set("nights", Number(ev.target.value))} aria-label="Nights" placeholder="Nights" /></div>
              ) : (
                <div className="grid grid-cols-3 gap-3"><Input type="date" value={s.start} onChange={(ev) => set("start", ev.target.value)} aria-label="Start" /><Input type="date" value={s.end} onChange={(ev) => set("end", ev.target.value)} aria-label="End" /><Input type="number" min={1} value={s.nights} onChange={(ev) => set("nights", Number(ev.target.value))} aria-label="Nights" /></div>
              )}
            </div>
            <Field label="Adults"><Input type="number" min={1} value={s.adults} onChange={(ev) => set("adults", Number(ev.target.value))} /></Field>
            <Field label="Children"><Input type="number" min={0} value={s.children} onChange={(ev) => set("children", Number(ev.target.value))} /></Field>
            <Field label="Infants"><Input type="number" min={0} value={s.infants} onChange={(ev) => set("infants", Number(ev.target.value))} /></Field>
            <Field label="Budget (₹ total)" hint={dest ? `${dest.name} from ${formatINR(dest.fromPriceINR)} pp` : undefined}><Input type="number" min={0} step={5000} value={s.budget} onChange={(ev) => set("budget", Number(ev.target.value))} /></Field>
            <Field label="Pace">
              <Select value={s.pace} onChange={(ev) => set("pace", ev.target.value as Pace)}>{(Object.keys(PACE_LABEL) as Pace[]).map((k) => <option key={k} value={k}>{PACE_LABEL[k]}</option>)}</Select>
            </Field>
            <Field label="Comfort">
              <Select value={s.comfort} onChange={(ev) => set("comfort", ev.target.value as Comfort)}>{(Object.keys(COMFORT_LABEL) as Comfort[]).map((k) => <option key={k} value={k}>{COMFORT_LABEL[k]}</option>)}</Select>
            </Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={s.notes} onChange={(ev) => set("notes", ev.target.value)} placeholder="Anniversary trip, wants a private pool villa…" /></Field>
          <Field label="First message from traveller (optional)" hint="Logged as an inbound message so the thread starts here."><Textarea rows={2} value={s.firstMessage} onChange={(ev) => set("firstMessage", ev.target.value)} placeholder="Hi! Saw your Bali reel — can you plan this for 2 of us in Feb?" /></Field>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Assign to" hint={s.assignTo === "auto" && suggested ? `Auto → ${suggested.user.name} (${suggested.reason})` : undefined}>
            <Select value={s.assignTo} onChange={(ev) => set("assignTo", ev.target.value)}>
              <option value="auto">Auto (destination specialist / round-robin)</option>
              <option value="">Leave unassigned</option>
              {consultants.map((u) => <option key={u.sub} value={u.sub}>{u.name} · {u.title}</option>)}
            </Select>
          </Field>
          {voice.enabled && voice.outboundEnabled && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" checked={s.voiceCall} onChange={(ev) => set("voiceCall", ev.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />
              <span>
                <span className="flex items-center gap-1 font-medium"><PhoneCall className="h-3.5 w-3.5 text-brand-600" />Have {voice.name} (voice agent) call them now</span>
                <span className="block text-xs text-muted-foreground">Qualifies month, pax and budget within {voice.callNewLeadsWithinMin} min and moves the enquiry to Qualified if they answer.</span>
              </span>
            </label>
          )}
        </section>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!valid}><UserPlus className="h-4 w-4" />Create enquiry</Button>
        </div>
      </form>
    </Dialog>
  );
}
