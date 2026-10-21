"use client";

import * as React from "react";
import type { Channel, Language, Comfort, Pace, FoodPref } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { logActivity } from "@/lib/demo/queries";
import { CHANNEL_LABEL, COMFORT_LABEL, FOOD_LABEL, PACE_LABEL } from "@/lib/pipeline";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { Field, TagChip } from "@/components/shared";

export const CITIES = ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"];
export const LANGUAGE_LABEL: Record<Language, string> = { en: "English", hi: "Hindi", hinglish: "Hinglish", te: "Telugu", ta: "Tamil", mr: "Marathi", gu: "Gujarati" };

export function NewTravellerDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const me = useCurrentUser();
  const [form, setForm] = React.useState({ fullName: "", phone: "", email: "", city: "Bengaluru", instagramHandle: "", preferredChannel: "whatsapp" as Channel, language: "en" as Language, foodPref: "no_preference" as FoodPref, pace: "balanced" as Pace, comfort: "comfort" as Comfort, notes: "" });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  React.useEffect(() => {
    if (open) setForm({ fullName: "", phone: "", email: "", city: "Bengaluru", instagramHandle: "", preferredChannel: "whatsapp", language: "en", foodPref: "no_preference", pace: "balanced", comfort: "comfort", notes: "" });
  }, [open]);

  function save() {
    if (!form.fullName.trim() || !form.phone.trim()) return;
    const id = newId("trav");
    mutateDb((d) => {
      d.travellers.unshift({
        id,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        city: form.city,
        instagramHandle: form.instagramHandle.trim() || undefined,
        preferredChannel: form.preferredChannel,
        language: form.language,
        nationality: "Indian",
        foodPref: form.foodPref,
        pace: form.pace,
        comfort: form.comfort,
        interests: [],
        tags: [],
        notes: form.notes.trim() || undefined,
        blocked: false,
        tripsCount: 0,
        lifetimeValueINR: 0,
        createdAt: nowIso(),
      });
      logActivity(d, { actor: me.name, actorKind: "user", type: "traveller_created", text: `Added traveller ${form.fullName.trim()} (${form.city})`, travellerId: id });
    });
    onClose();
    onCreated(id);
  }

  return (
    <Dialog open={open} onClose={onClose} title="New traveller" className="md:max-w-lg">
      <div className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Ananya Rao" />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98xxx xxxxx" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Instagram">
            <Input value={form.instagramHandle} onChange={(e) => set("instagramHandle", e.target.value)} placeholder="@handle" />
          </Field>
          <Field label="City">
            <Select value={form.city} onChange={(e) => set("city", e.target.value)}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Preferred channel">
            <Select value={form.preferredChannel} onChange={(e) => set("preferredChannel", e.target.value as Channel)}>
              {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Language">
            <Select value={form.language} onChange={(e) => set("language", e.target.value as Language)}>
              {(Object.keys(LANGUAGE_LABEL) as Language[]).map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABEL[l]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Food">
            <Select value={form.foodPref} onChange={(e) => set("foodPref", e.target.value as FoodPref)}>
              {(Object.keys(FOOD_LABEL) as FoodPref[]).map((f) => (
                <option key={f} value={f}>
                  {FOOD_LABEL[f]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pace">
            <Select value={form.pace} onChange={(e) => set("pace", e.target.value as Pace)}>
              {(Object.keys(PACE_LABEL) as Pace[]).map((p) => (
                <option key={p} value={p}>
                  {PACE_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Comfort">
            <Select value={form.comfort} onChange={(e) => set("comfort", e.target.value as Comfort)}>
              {(Object.keys(COMFORT_LABEL) as Comfort[]).map((c) => (
                <option key={c} value={c}>
                  {COMFORT_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything the team should know" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!form.fullName.trim() || !form.phone.trim()}>
            Create traveller
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function BulkTagDialog({ open, onClose, ids, onDone }: { open: boolean; onClose: () => void; ids: string[]; onDone: (m: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const [tag, setTag] = React.useState("");
  const [custom, setCustom] = React.useState("");
  const [remove, setRemove] = React.useState(false);
  const name = (custom.trim() || tag).trim();

  function apply() {
    if (!name) return;
    mutateDb((d) => {
      let n = 0;
      for (const t of d.travellers) {
        if (!ids.includes(t.id)) continue;
        if (remove) {
          if (t.tags.includes(name)) {
            t.tags = t.tags.filter((x) => x !== name);
            n += 1;
          }
        } else if (!t.tags.includes(name)) {
          t.tags.push(name);
          n += 1;
        }
      }
      if (!remove && !d.tags.some((x) => x.name === name)) d.tags.push({ name, category: "custom", color: "zinc" });
      logActivity(d, { actor: me.name, actorKind: "user", type: "bulk_tag", text: `${remove ? "Removed" : "Added"} tag "${name}" ${remove ? "from" : "to"} ${n} traveller${n === 1 ? "" : "s"}` });
    });
    onClose();
    onDone(`Tag "${name}" ${remove ? "removed" : "applied"}`);
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Bulk tag · ${ids.length} traveller${ids.length === 1 ? "" : "s"}`}>
      <div className="space-y-3 p-4">
        <Field label="Pick a tag">
          <div className="flex flex-wrap gap-1.5">
            {db.tags.map((t) => (
              <button key={t.name} type="button" onClick={() => setTag(t.name)} className={tag === t.name ? "rounded ring-2 ring-primary ring-offset-1" : "rounded opacity-80 hover:opacity-100"}>
                <TagChip name={t.name} tags={db.tags} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Or type a new tag">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. diwali-2026-offer" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remove} onChange={(e) => setRemove(e.target.checked)} className="h-4 w-4" /> Remove this tag instead of adding
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!name}>
            {remove ? "Remove tag" : "Apply tag"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
