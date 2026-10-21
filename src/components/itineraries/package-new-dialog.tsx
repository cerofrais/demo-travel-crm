"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Comfort, ItineraryDay, Pace, TripType } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { destinationById, logActivity } from "@/lib/demo/queries";
import { COMFORT_LABEL, PACE_LABEL, TRIP_TYPE_LABEL } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { Field } from "@/components/shared";
import { slugCode } from "./package-utils";

const STD_INCL = ["Stays with breakfast", "Private airport transfers", "Sightseeing as per plan", "wishtrip trip captain on WhatsApp 24×7", "All taxes (GST 5%)"];
const STD_EXCL = ["Flights (unless chosen)", "Lunches & dinners unless mentioned", "Personal expenses", "Travel insurance", "Anything not in inclusions"];

interface DayRow {
  title: string;
  location: string;
  summary: string;
}

export function NewPackageDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const [title, setTitle] = React.useState("");
  const [code, setCode] = React.useState("");
  const [destinationId, setDestinationId] = React.useState(db.destinations[0]?.id ?? "goa");
  const [nights, setNights] = React.useState(4);
  const [tripTypes, setTripTypes] = React.useState<TripType[]>(["couple"]);
  const [pace, setPace] = React.useState<Pace>("balanced");
  const [comfort, setComfort] = React.useState<Comfort>("comfort");
  const [fromPrice, setFromPrice] = React.useState(30000);
  const [highlights, setHighlights] = React.useState("");
  const [days, setDays] = React.useState<DayRow[]>([]);
  const dest = destinationById(db, destinationId);

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setCode("");
    setNights(4);
    setTripTypes(["couple"]);
    setPace("balanced");
    setComfort("comfort");
    setFromPrice(30000);
    setHighlights("");
    setDays(Array.from({ length: 5 }, (_, i) => ({ title: i === 0 ? "Arrive & settle" : i === 4 ? "Fly home" : `Day ${i + 1}`, location: "", summary: "" })));
  }, [open]);

  // Keep the day rows in step with nights.
  React.useEffect(() => {
    setDays((rows) => {
      const target = nights + 1;
      if (rows.length === target) return rows;
      if (rows.length > target) return rows.slice(0, target);
      return [...rows, ...Array.from({ length: target - rows.length }, (_, i) => ({ title: `Day ${rows.length + i + 1}`, location: "", summary: "" }))];
    });
  }, [nights]);

  function setDay(i: number, patch: Partial<DayRow>) {
    setDays((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function save() {
    if (!title.trim() || !dest) return;
    const id = newId("pkg");
    const finalCode = code.trim().toUpperCase() || slugCode(dest, nights, title);
    const defaultStay = `${dest.name} ${comfort === "luxury" || comfort === "premium" ? "resort" : "boutique stay"}`;
    const pkgDays: ItineraryDay[] = days.map((r, i) => ({
      day: i + 1,
      title: r.title.trim() || `Day ${i + 1}`,
      location: r.location.trim() || dest.name,
      summary: r.summary.trim() || (i === 0 ? "Arrival, transfer and settle in." : i === days.length - 1 ? "Slow morning and airport drop." : "Explore at your pace."),
      activities: i === 0 ? ["Airport pickup"] : i === days.length - 1 ? ["Airport drop"] : ["Sightseeing", "Local food"],
      meals: { b: i !== 0, l: false, d: i === 0 },
      stay: i === days.length - 1 ? undefined : defaultStay,
    }));
    mutateDb((d) => {
      d.packages.unshift({
        id,
        code: finalCode,
        title: title.trim(),
        destinationId,
        nights,
        tripTypes,
        pace,
        comfort,
        fromPriceINR: Math.max(0, fromPrice),
        highlights: highlights
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        days: pkgDays,
        inclusions: STD_INCL,
        exclusions: STD_EXCL,
        bestMonths: dest.bestMonths,
        tags: [...tripTypes, pace],
        active: true,
        timesSold: 0,
        createdAt: nowIso(),
      });
      logActivity(d, { actor: me.name, actorKind: "user", type: "package_created", text: `Created package ${finalCode} — ${title.trim()} (${dest.name}, ${nights}N)` });
    });
    onClose();
    onCreated(id);
  }

  return (
    <Dialog open={open} onClose={onClose} title="New package" className="md:max-w-2xl">
      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kerala slow week: backwaters & Munnar" />
          </Field>
          <Field label="Code" hint={`Blank → ${slugCode(dest, nights, title || "custom")}`}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="KER-6D-SLOW" />
          </Field>
          <Field label="Destination">
            <Select value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
              {db.destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.emoji} {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nights">
            <Input type="number" min={1} max={14} value={nights} onChange={(e) => setNights(Math.max(1, Math.min(14, Number(e.target.value))))} />
          </Field>
          <Field label="From price (₹ pp)">
            <Input type="number" min={0} step={500} value={fromPrice} onChange={(e) => setFromPrice(Number(e.target.value))} />
          </Field>
          <Field label="Pace">
            <Select value={pace} onChange={(e) => setPace(e.target.value as Pace)}>
              {(Object.keys(PACE_LABEL) as Pace[]).map((p) => (
                <option key={p} value={p}>
                  {PACE_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Comfort">
            <Select value={comfort} onChange={(e) => setComfort(e.target.value as Comfort)}>
              {(Object.keys(COMFORT_LABEL) as Comfort[]).map((c) => (
                <option key={c} value={c}>
                  {COMFORT_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trip types</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TRIP_TYPE_LABEL) as TripType[]).map((t) => {
              const on = tripTypes.includes(t);
              return (
                <button key={t} type="button" onClick={() => setTripTypes(on ? tripTypes.filter((x) => x !== t) : [...tripTypes, t])} className={cn("min-h-[32px] rounded-full border px-2.5 text-xs", on ? "border-brand-500 bg-brand-100 text-brand-800" : "border-border text-muted-foreground")}>
                  {TRIP_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Highlights (one per line)">
          <Textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={3} placeholder={"One stay, zero hotel changes\nSunset at Cabo de Rama"} />
        </Field>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Days ({days.length})</p>
            <Button size="sm" variant="ghost" onClick={() => setNights((n) => Math.min(14, n + 1))}>
              <Plus className="h-4 w-4" /> Add day
            </Button>
          </div>
          <div className="space-y-2">
            {days.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[32px_1fr_1fr_auto]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                <Input value={r.title} onChange={(e) => setDay(i, { title: e.target.value })} placeholder="Title" className="h-9 lg:h-8" />
                <Input value={r.location} onChange={(e) => setDay(i, { location: e.target.value })} placeholder="Location" className="h-9 lg:h-8" />
                <Button size="icon" variant="ghost" className="h-9 w-9 lg:h-8 lg:w-8" title="Remove day" disabled={days.length <= 2} onClick={() => setNights((n) => Math.max(1, n - 1))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Input value={r.summary} onChange={(e) => setDay(i, { summary: e.target.value })} placeholder="Summary" className="h-9 sm:col-span-4 lg:h-8" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!title.trim()}>
            Create package
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
