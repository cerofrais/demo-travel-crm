"use client";

import * as React from "react";
import { Instagram, Plus, Save } from "lucide-react";
import type { Channel, Comfort, Enquiry, Flexibility, FoodPref, Pace, Traveller, TripType } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, nowIso } from "@/lib/demo/store";
import { logActivity } from "@/lib/demo/queries";
import { COMFORT_LABEL, FLEX_LABEL, FOOD_LABEL, INTERESTS, PACE_LABEL, TRIP_TYPE_LABEL, CHANNEL_LABEL } from "@/lib/pipeline";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { Field, KV, SectionTitle, TagChip, Toggle } from "@/components/shared";
import { cn, formatINR, paxLabel, toDateInput } from "@/lib/utils";
import { datesLabel } from "./enquiry-card";
import { isConsultant, touch, type Actor } from "./booking-actions";

interface Form {
  fullName: string; phone: string; email: string; city: string; instagramHandle: string; preferredChannel: Channel;
  destinationId: string; altDestinations: string; travelStart: string; travelEnd: string; travelMonth: string; nights: number; flexibility: Flexibility;
  adults: number; children: number; infants: number; rooms: number; tripType: TripType; pace: Pace; comfort: Comfort; foodPref: FoodPref;
  budgetINR: number; includeFlights: boolean; departureCity: string; interests: string[]; notes: string; assignedTo: string; tags: string[];
}

function toForm(e: Enquiry, t: Traveller | undefined): Form {
  return {
    fullName: t?.fullName ?? "", phone: t?.phone ?? "", email: t?.email ?? "", city: t?.city ?? "", instagramHandle: t?.instagramHandle ?? "", preferredChannel: t?.preferredChannel ?? "whatsapp",
    destinationId: e.destinationId, altDestinations: e.altDestinations.join(", "), travelStart: toDateInput(e.travelStart), travelEnd: toDateInput(e.travelEnd), travelMonth: e.travelMonth ?? "", nights: e.nights, flexibility: e.flexibility,
    adults: e.pax.adults, children: e.pax.children, infants: e.pax.infants, rooms: e.rooms, tripType: e.tripType, pace: e.pace, comfort: e.comfort, foodPref: e.foodPref,
    budgetINR: e.budgetINR, includeFlights: e.includeFlights, departureCity: e.departureCity, interests: [...e.interests], notes: e.notes ?? "", assignedTo: e.assignedTo ?? "", tags: [...e.tags],
  };
}

export function DetailsTab({ enquiry: e, actor, canEdit, canReassign, onSaved }: { enquiry: Enquiry; actor: Actor; canEdit: boolean; canReassign: boolean; onSaved: (msg: string) => void }) {
  const db = useDb();
  const traveller = db.travellers.find((t) => t.id === e.travellerId);
  const [form, setForm] = React.useState<Form>(() => toForm(e, traveller));
  const [dirty, setDirty] = React.useState(false);
  const [customTag, setCustomTag] = React.useState("");
  const dest = db.destinations.find((d) => d.id === e.destinationId);

  const dirtyRef = React.useRef(false);
  dirtyRef.current = dirty;
  const lastId = React.useRef(e.id);
  React.useEffect(() => {
    // Reset when a different enquiry is shown, or when it changed underneath us
    // (stage move, AI action) and there are no unsaved edits to protect.
    if (lastId.current !== e.id || !dirtyRef.current) {
      setForm(toForm(e, traveller));
      setDirty(false);
    }
    lastId.current = e.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.id, e.updatedAt]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const consultants = db.users.filter(isConsultant);
  const ro = !canEdit;

  function save() {
    mutateDb((d) => {
      const enq = d.enquiries.find((x) => x.id === e.id);
      const trv = d.travellers.find((x) => x.id === e.travellerId);
      if (!enq) return;
      const changes: string[] = [];
      if (trv) {
        if (trv.fullName !== form.fullName.trim()) changes.push("name");
        trv.fullName = form.fullName.trim() || trv.fullName;
        trv.phone = form.phone.trim() || trv.phone;
        trv.email = form.email.trim() || undefined;
        trv.city = form.city.trim() || trv.city;
        trv.instagramHandle = form.instagramHandle.trim() || undefined;
        trv.preferredChannel = form.preferredChannel;
      }
      const newDest = d.destinations.find((x) => x.id === form.destinationId);
      if (newDest && newDest.id !== enq.destinationId) changes.push(`destination → ${newDest.name}`);
      if (newDest) { enq.destinationId = newDest.id; enq.destination = newDest.name; }
      enq.altDestinations = form.altDestinations.split(",").map((s) => s.trim()).filter(Boolean);
      if (toDateInput(enq.travelStart) !== form.travelStart) changes.push("dates");
      enq.travelStart = form.travelStart ? new Date(`${form.travelStart}T00:00:00`).toISOString() : undefined;
      enq.travelEnd = form.travelEnd ? new Date(`${form.travelEnd}T00:00:00`).toISOString() : undefined;
      enq.travelMonth = form.travelMonth || (enq.travelStart ? enq.travelStart.slice(0, 7) : undefined);
      enq.nights = Math.max(1, Number(form.nights) || 1);
      enq.flexibility = form.flexibility;
      enq.pax = { adults: Math.max(1, Number(form.adults) || 1), children: Math.max(0, Number(form.children) || 0), infants: Math.max(0, Number(form.infants) || 0) };
      enq.rooms = Math.max(1, Number(form.rooms) || 1);
      enq.tripType = form.tripType; enq.pace = form.pace; enq.comfort = form.comfort; enq.foodPref = form.foodPref;
      if (enq.budgetINR !== Number(form.budgetINR)) changes.push(`budget → ${formatINR(Number(form.budgetINR), { compact: true })}`);
      enq.budgetINR = Math.max(0, Number(form.budgetINR) || 0);
      enq.includeFlights = form.includeFlights; enq.departureCity = form.departureCity.trim();
      enq.interests = form.interests; enq.notes = form.notes.trim() || undefined; enq.tags = form.tags;
      if (canReassign && (form.assignedTo || undefined) !== enq.assignedTo) {
        enq.assignedTo = form.assignedTo || undefined;
        const name = d.users.find((u) => u.sub === form.assignedTo)?.name;
        changes.push(name ? `assigned to ${name}` : "unassigned");
        logActivity(d, { actor: actor.name, actorKind: "user", type: "assignment", text: name ? `Assigned to ${name}` : "Unassigned", enquiryId: enq.id, travellerId: enq.travellerId });
      }
      touch(enq, nowIso());
      logActivity(d, { actor: actor.name, actorKind: "user", type: "enquiry_updated", text: changes.length ? `Updated ${changes.join(", ")}` : "Updated enquiry details", enquiryId: enq.id, travellerId: enq.travellerId });
    });
    setDirty(false);
    onSaved("Saved");
  }

  const addTag = (name: string) => {
    const n = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (n && !form.tags.includes(n)) set("tags", [...form.tags, n]);
    setCustomTag("");
  };

  return (
    <div className="space-y-5 p-4">
      <Card className="bg-brand-50/60 p-4">
        <SectionTitle>Trip brief</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KV label="Destination" value={<span>{dest?.emoji} {e.destination}{e.altDestinations.length ? <span className="text-muted-foreground"> · alt {e.altDestinations.join(", ")}</span> : null}</span>} />
          <KV label="Dates" value={`${datesLabel(e)} · ${e.nights}N`} />
          <KV label="Travellers" value={`${paxLabel(e.pax)} · ${e.rooms} room${e.rooms === 1 ? "" : "s"}`} />
          <KV label="Budget" value={`${formatINR(e.budgetINR)} total${e.includeFlights ? " incl. flights" : ""}`} />
          <KV label="Pace · Comfort" value={`${PACE_LABEL[e.pace]} · ${COMFORT_LABEL[e.comfort]}`} />
          <KV label="Trip type" value={`${TRIP_TYPE_LABEL[e.tripType]} · ${FOOD_LABEL[e.foodPref]}`} />
        </div>
        {(e.campaign || e.reelRef) && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Instagram className="h-3.5 w-3.5" />Reacted to: {e.reelRef ?? "—"}{e.campaign ? ` · campaign ${e.campaign}` : ""}</p>
        )}
      </Card>

      <section>
        <SectionTitle>Traveller</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.fullName} onChange={(ev) => set("fullName", ev.target.value)} disabled={ro} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(ev) => set("phone", ev.target.value)} disabled={ro} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(ev) => set("email", ev.target.value)} disabled={ro} /></Field>
          <Field label="City"><Input value={form.city} onChange={(ev) => set("city", ev.target.value)} disabled={ro} /></Field>
          <Field label="Instagram"><Input value={form.instagramHandle} onChange={(ev) => set("instagramHandle", ev.target.value)} placeholder="@handle" disabled={ro} /></Field>
          <Field label="Preferred channel">
            <Select value={form.preferredChannel} onChange={(ev) => set("preferredChannel", ev.target.value as Channel)} disabled={ro}>
              {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
            </Select>
          </Field>
        </div>
      </section>

      <section>
        <SectionTitle>Trip</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Destination" className="col-span-2 sm:col-span-1">
            <Select value={form.destinationId} onChange={(ev) => set("destinationId", ev.target.value)} disabled={ro}>
              {db.destinations.map((d) => <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}
            </Select>
          </Field>
          <Field label="Alternatives" className="col-span-2"><Input value={form.altDestinations} onChange={(ev) => set("altDestinations", ev.target.value)} placeholder="Bali, Vietnam" disabled={ro} /></Field>
          <Field label="Travel start"><Input type="date" value={form.travelStart} onChange={(ev) => set("travelStart", ev.target.value)} disabled={ro} /></Field>
          <Field label="Travel end"><Input type="date" value={form.travelEnd} onChange={(ev) => set("travelEnd", ev.target.value)} disabled={ro} /></Field>
          <Field label="Month (if flexible)"><Input type="month" value={form.travelMonth} onChange={(ev) => set("travelMonth", ev.target.value)} disabled={ro} /></Field>
          <Field label="Nights"><Input type="number" min={1} value={form.nights} onChange={(ev) => set("nights", Number(ev.target.value))} disabled={ro} /></Field>
          <Field label="Flexibility" className="col-span-2 sm:col-span-1">
            <Select value={form.flexibility} onChange={(ev) => set("flexibility", ev.target.value as Flexibility)} disabled={ro}>
              {(Object.keys(FLEX_LABEL) as Flexibility[]).map((f) => <option key={f} value={f}>{FLEX_LABEL[f]}</option>)}
            </Select>
          </Field>
          <Field label="Adults"><Input type="number" min={1} value={form.adults} onChange={(ev) => set("adults", Number(ev.target.value))} disabled={ro} /></Field>
          <Field label="Children"><Input type="number" min={0} value={form.children} onChange={(ev) => set("children", Number(ev.target.value))} disabled={ro} /></Field>
          <Field label="Infants"><Input type="number" min={0} value={form.infants} onChange={(ev) => set("infants", Number(ev.target.value))} disabled={ro} /></Field>
          <Field label="Rooms"><Input type="number" min={1} value={form.rooms} onChange={(ev) => set("rooms", Number(ev.target.value))} disabled={ro} /></Field>
          <Field label="Trip type">
            <Select value={form.tripType} onChange={(ev) => set("tripType", ev.target.value as TripType)} disabled={ro}>
              {(Object.keys(TRIP_TYPE_LABEL) as TripType[]).map((t) => <option key={t} value={t}>{TRIP_TYPE_LABEL[t]}</option>)}
            </Select>
          </Field>
          <Field label="Pace">
            <Select value={form.pace} onChange={(ev) => set("pace", ev.target.value as Pace)} disabled={ro}>
              {(Object.keys(PACE_LABEL) as Pace[]).map((p) => <option key={p} value={p}>{PACE_LABEL[p]}</option>)}
            </Select>
          </Field>
          <Field label="Comfort">
            <Select value={form.comfort} onChange={(ev) => set("comfort", ev.target.value as Comfort)} disabled={ro}>
              {(Object.keys(COMFORT_LABEL) as Comfort[]).map((c) => <option key={c} value={c}>{COMFORT_LABEL[c]}</option>)}
            </Select>
          </Field>
          <Field label="Food">
            <Select value={form.foodPref} onChange={(ev) => set("foodPref", ev.target.value as FoodPref)} disabled={ro}>
              {(Object.keys(FOOD_LABEL) as FoodPref[]).map((f) => <option key={f} value={f}>{FOOD_LABEL[f]}</option>)}
            </Select>
          </Field>
          <Field label="Budget (₹ total)"><Input type="number" min={0} step={1000} value={form.budgetINR} onChange={(ev) => set("budgetINR", Number(ev.target.value))} disabled={ro} /></Field>
          <Field label="Departure city"><Input value={form.departureCity} onChange={(ev) => set("departureCity", ev.target.value)} disabled={ro} /></Field>
          <div className="flex items-end pb-2"><Toggle checked={form.includeFlights} onChange={(v) => set("includeFlights", v)} label="Include flights" disabled={ro} /></div>
        </div>
        <div className="mt-3">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Interests</span>
          <div className="flex flex-wrap gap-1.5">
            {INTERESTS.map((i) => {
              const on = form.interests.includes(i);
              return (
                <button key={i} type="button" disabled={ro} aria-pressed={on} onClick={() => set("interests", on ? form.interests.filter((x) => x !== i) : [...form.interests, i])} className={cn("rounded-full border px-2.5 py-1 text-xs capitalize transition-colors disabled:opacity-60", on ? "border-primary bg-brand-50 text-brand-800" : "border-border text-muted-foreground hover:text-foreground")}>
                  {i}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Notes" className="mt-3"><Textarea value={form.notes} onChange={(ev) => set("notes", ev.target.value)} rows={3} placeholder="Anniversary, must-sees, things to avoid…" disabled={ro} /></Field>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Owner" hint={!canReassign ? "Only managers can reassign" : undefined}>
          <Select value={form.assignedTo} onChange={(ev) => set("assignedTo", ev.target.value)} disabled={ro || !canReassign}>
            <option value="">Unassigned</option>
            {consultants.map((u) => <option key={u.sub} value={u.sub}>{u.name} · {u.title}</option>)}
          </Select>
        </Field>
        <div>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</span>
          <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1.5">
            {form.tags.map((t) => <TagChip key={t} name={t} tags={db.tags} onRemove={ro ? undefined : () => set("tags", form.tags.filter((x) => x !== t))} />)}
            {form.tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
          </div>
          {!ro && (
            <div className="mt-1.5 flex gap-1.5">
              <Select value="" onChange={(ev) => ev.target.value && addTag(ev.target.value)} className="h-9 flex-1 text-sm" aria-label="Add tag">
                <option value="">Add tag…</option>
                {db.tags.filter((t) => !form.tags.includes(t.name)).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </Select>
              <Input value={customTag} onChange={(ev) => setCustomTag(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addTag(customTag); } }} placeholder="custom" className="h-9 w-28 text-sm" />
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => addTag(customTag)} aria-label="Add custom tag"><Plus className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      </section>

      {!ro && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          {dirty && <span className="mr-auto text-xs text-amber-700">Unsaved changes</span>}
          <Button variant="outline" disabled={!dirty} onClick={() => { setForm(toForm(e, traveller)); setDirty(false); }}>Discard</Button>
          <Button disabled={!dirty} onClick={save}><Save className="h-4 w-4" />Save changes</Button>
        </div>
      )}
    </div>
  );
}
