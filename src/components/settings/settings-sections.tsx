"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { Field, SectionTitle } from "@/components/shared";
import { mutateDb } from "@/lib/demo/store";
import { logActivity } from "@/lib/demo/queries";
import type { Settings } from "@/lib/demo/types";

export function SaveBar({ dirty, onSave, onReset, canEdit }: { dirty: boolean; onSave: () => void; onReset: () => void; canEdit: boolean }) {
  if (!canEdit) return <p className="text-[11px] text-muted-foreground">Read-only — only Administrators can change settings.</p>;
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onReset} disabled={!dirty}>
        Discard
      </Button>
      <Button size="sm" onClick={onSave} disabled={!dirty}>
        Save
      </Button>
    </div>
  );
}

/** Local draft of a settings slice with dirty tracking and a save that logs activity. */
export function useDraft<T>(value: T, label: string, apply: (db: Settings, draft: T) => void, actor: string) {
  const [draft, setDraft] = React.useState<T>(value);
  const [base, setBase] = React.useState(JSON.stringify(value));
  React.useEffect(() => {
    const next = JSON.stringify(value);
    if (next !== base) {
      setDraft(value);
      setBase(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const dirty = JSON.stringify(draft) !== base;
  const save = () => {
    mutateDb((db) => {
      apply(db.settings, draft);
      logActivity(db, { actor, actorKind: "user", type: "settings", text: `Updated ${label} settings` });
    });
  };
  const reset = () => setDraft(JSON.parse(base) as T);
  return { draft, setDraft, dirty, save, reset };
}

export function CompanyCard({ value, canEdit, actor, onSaved }: { value: Settings["company"]; canEdit: boolean; actor: string; onSaved: () => void }) {
  const d = useDraft(value, "company", (s, v) => (s.company = v), actor);
  const set = (k: keyof Settings["company"], v: string) => d.setDraft((x) => ({ ...x, [k]: v }));
  const fields: { k: keyof Settings["company"]; label: string; span?: boolean }[] = [
    { k: "name", label: "Brand name" },
    { k: "legalName", label: "Legal name" },
    { k: "supportEmail", label: "Support email" },
    { k: "phone", label: "Phone" },
    { k: "instagram", label: "Instagram" },
    { k: "website", label: "Website" },
    { k: "gstin", label: "GSTIN" },
    { k: "address", label: "Address", span: true },
  ];
  return (
    <Card className="space-y-3 p-4">
      <SectionTitle>Company</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.k} label={f.label} className={f.span ? "sm:col-span-2" : undefined}>
            <Input value={d.draft[f.k]} onChange={(e) => set(f.k, e.target.value)} disabled={!canEdit} />
          </Field>
        ))}
      </div>
      <SaveBar dirty={d.dirty} onSave={() => { d.save(); onSaved(); }} onReset={d.reset} canEdit={canEdit} />
    </Card>
  );
}

type HoursSla = { businessHours: Settings["businessHours"]; sla: Settings["sla"] };

export function HoursSlaCard({ value, canEdit, actor, onSaved }: { value: HoursSla; canEdit: boolean; actor: string; onSaved: () => void }) {
  const d = useDraft(value, "business hours & SLA", (s, v) => { s.businessHours = v.businessHours; s.sla = v.sla; }, actor);
  const [cadence, setCadence] = React.useState(value.sla.followUpCadenceDays.join(", "));
  React.useEffect(() => setCadence(d.draft.sla.followUpCadenceDays.join(", ")), [d.draft.sla.followUpCadenceDays]);
  const num = (v: string, fallback: number) => (Number.isFinite(Number(v)) && v !== "" ? Number(v) : fallback);
  return (
    <Card className="space-y-3 p-4">
      <SectionTitle>Business hours &amp; SLA</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Opens">
          <Input type="time" value={d.draft.businessHours.start} onChange={(e) => d.setDraft((x) => ({ ...x, businessHours: { ...x.businessHours, start: e.target.value } }))} disabled={!canEdit} />
        </Field>
        <Field label="Closes">
          <Input type="time" value={d.draft.businessHours.end} onChange={(e) => d.setDraft((x) => ({ ...x, businessHours: { ...x.businessHours, end: e.target.value } }))} disabled={!canEdit} />
        </Field>
        <Field label="Timezone">
          <Input value={d.draft.businessHours.timezone} onChange={(e) => d.setDraft((x) => ({ ...x, businessHours: { ...x.businessHours, timezone: e.target.value } }))} disabled={!canEdit} />
        </Field>
        <Field label="First response (min)" hint="Aanya / Wish answer inside this window">
          <Input type="number" min={1} value={d.draft.sla.firstResponseMin} onChange={(e) => d.setDraft((x) => ({ ...x, sla: { ...x.sla, firstResponseMin: num(e.target.value, x.sla.firstResponseMin) } }))} disabled={!canEdit} />
        </Field>
        <Field label="First itinerary (hours)">
          <Input type="number" min={1} value={d.draft.sla.itineraryHours} onChange={(e) => d.setDraft((x) => ({ ...x, sla: { ...x.sla, itineraryHours: num(e.target.value, x.sla.itineraryHours) } }))} disabled={!canEdit} />
        </Field>
        <Field label="Follow-up cadence (days)" hint="Comma separated, e.g. 1, 3, 7">
          <Input
            value={cadence}
            onChange={(e) => {
              setCadence(e.target.value);
              const parsed = e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
              if (parsed.length) d.setDraft((x) => ({ ...x, sla: { ...x.sla, followUpCadenceDays: parsed } }));
            }}
            disabled={!canEdit}
          />
        </Field>
      </div>
      <SaveBar dirty={d.dirty} onSave={() => { d.save(); onSaved(); }} onReset={d.reset} canEdit={canEdit} />
    </Card>
  );
}

export function PaymentsCard({ value, canEdit, actor, onSaved }: { value: Settings["payment"]; canEdit: boolean; actor: string; onSaved: () => void }) {
  const d = useDraft(value, "payments & cancellation", (s, v) => (s.payment = v), actor);
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const schedTotal = d.draft.schedule.reduce((s, r) => s + r.pct, 0);
  return (
    <Card className="space-y-4 p-4">
      <SectionTitle>Payments &amp; cancellation</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Token / advance %">
          <Input type="number" min={0} max={100} value={d.draft.tokenPct} onChange={(e) => d.setDraft((x) => ({ ...x, tokenPct: num(e.target.value) }))} disabled={!canEdit} />
        </Field>
        <Field label="GST %">
          <Input type="number" min={0} max={28} value={d.draft.gstPct} onChange={(e) => d.setDraft((x) => ({ ...x, gstPct: num(e.target.value) }))} disabled={!canEdit} />
        </Field>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Instalment schedule</span>
          <span className={"text-[11px] " + (schedTotal === 100 ? "text-emerald-700" : "text-rose-600")}>totals {schedTotal}%</span>
        </div>
        <div className="space-y-2">
          {d.draft.schedule.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_72px_88px_auto] items-center gap-2">
              <Input value={row.label} onChange={(e) => d.setDraft((x) => ({ ...x, schedule: x.schedule.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)) }))} disabled={!canEdit} aria-label="Label" />
              <Input type="number" value={row.pct} onChange={(e) => d.setDraft((x) => ({ ...x, schedule: x.schedule.map((r, j) => (j === i ? { ...r, pct: num(e.target.value) } : r)) }))} disabled={!canEdit} aria-label="Percent" />
              <Input type="number" value={row.offsetDays} onChange={(e) => d.setDraft((x) => ({ ...x, schedule: x.schedule.map((r, j) => (j === i ? { ...r, offsetDays: num(e.target.value) } : r)) }))} disabled={!canEdit} aria-label="Days before trip" title="Days relative to departure (negative = before)" />
              <Button size="icon" variant="ghost" disabled={!canEdit || d.draft.schedule.length <= 1} onClick={() => d.setDraft((x) => ({ ...x, schedule: x.schedule.filter((_, j) => j !== i) }))} aria-label="Remove row">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Columns: label · % of total · days relative to departure (0 = on booking, −21 = three weeks before).</p>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => d.setDraft((x) => ({ ...x, schedule: [...x.schedule, { label: "Instalment", pct: 0, offsetDays: -30 }] }))}>
              <Plus className="h-3.5 w-3.5" /> Add instalment
            </Button>
          )}
        </div>
      </div>
      <div>
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cancellation slabs</span>
        <div className="space-y-2">
          {d.draft.cancellationSlabs.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 text-sm">
              <label className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">≥ days</span>
                <Input type="number" value={row.minDaysBefore} onChange={(e) => d.setDraft((x) => ({ ...x, cancellationSlabs: x.cancellationSlabs.map((r, j) => (j === i ? { ...r, minDaysBefore: num(e.target.value) } : r)) }))} disabled={!canEdit} />
              </label>
              <label className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-xs text-muted-foreground">fee %</span>
                <Input type="number" value={row.feePct} onChange={(e) => d.setDraft((x) => ({ ...x, cancellationSlabs: x.cancellationSlabs.map((r, j) => (j === i ? { ...r, feePct: num(e.target.value) } : r)) }))} disabled={!canEdit} />
              </label>
              <Button size="icon" variant="ghost" disabled={!canEdit || d.draft.cancellationSlabs.length <= 1} onClick={() => d.setDraft((x) => ({ ...x, cancellationSlabs: x.cancellationSlabs.filter((_, j) => j !== i) }))} aria-label="Remove slab">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => d.setDraft((x) => ({ ...x, cancellationSlabs: [...x.cancellationSlabs, { minDaysBefore: 0, feePct: 100 }] }))}>
              <Plus className="h-3.5 w-3.5" /> Add slab
            </Button>
          )}
        </div>
      </div>
      <SaveBar dirty={d.dirty} onSave={() => { d.save(); onSaved(); }} onReset={d.reset} canEdit={canEdit} />
    </Card>
  );
}
