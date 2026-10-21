"use client";

import * as React from "react";
import { Pencil, Film, Check } from "lucide-react";
import type { PackageTemplate } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { destinationById, logActivity } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { TRIP_TYPE_LABEL } from "@/lib/pipeline";
import { cn, formatINR } from "@/lib/utils";
import { Button, Input, Sheet, Textarea } from "@/components/ui";
import { Field, Toggle } from "@/components/shared";
import { ItineraryView } from "./itinerary-view";
import { MONTHS, monthsLabel, previewItinerary } from "./package-utils";

export function PackageSheet({ packageId, onClose, onToast }: { packageId: string | null; onClose: () => void; onToast: (m: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const pkg = db.packages.find((p) => p.id === packageId) ?? null;
  const dest = pkg ? destinationById(db, pkg.destinationId) : undefined;
  const [editing, setEditing] = React.useState(false);
  const canEdit = can(me.role, "itineraries.edit");

  React.useEffect(() => setEditing(false), [packageId]);

  const preview = pkg && dest ? previewItinerary(pkg, dest) : null;

  return (
    <Sheet open={!!pkg} onClose={onClose} side="right" widthClassName="w-full max-w-2xl" title={pkg ? `${dest?.emoji ?? ""} ${pkg.code}` : undefined}>
      {pkg && dest && (
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold text-foreground">{pkg.title}</h2>
              <p className="text-xs text-muted-foreground">
                {pkg.tripTypes.map((t) => TRIP_TYPE_LABEL[t]).join(" · ")} · best {monthsLabel(pkg.bestMonths)} · sold {pkg.timesSold}×
              </p>
              {pkg.sourceReel && (
                <p className="mt-1 inline-flex items-center gap-1 rounded bg-pink-100 px-1.5 py-0.5 text-[11px] font-medium text-pink-700">
                  <Film className="h-3 w-3" /> Built from reel: {pkg.sourceReel}
                </p>
              )}
            </div>
            {canEdit && (
              <Button size="sm" variant={editing ? "secondary" : "outline"} onClick={() => setEditing((v) => !v)}>
                <Pencil className="h-4 w-4" /> {editing ? "Close editor" : "Edit"}
              </Button>
            )}
          </div>

          {editing ? (
            <EditForm pkg={pkg} onDone={() => { setEditing(false); onToast("Package updated"); }} />
          ) : (
            <>
              <ul className="grid gap-1 rounded-xl bg-secondary/60 p-3 text-sm sm:grid-cols-2">
                {pkg.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> {h}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Preview below is generated for 2 adults at the package&apos;s default pace and comfort. From {formatINR(pkg.fromPriceINR)} per person.</p>
              {preview && <ItineraryView itinerary={preview.itinerary} destination={dest} />}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function EditForm({ pkg, onDone }: { pkg: PackageTemplate; onDone: () => void }) {
  const me = useCurrentUser();
  const [title, setTitle] = React.useState(pkg.title);
  const [highlights, setHighlights] = React.useState(pkg.highlights.join("\n"));
  const [fromPrice, setFromPrice] = React.useState(pkg.fromPriceINR);
  const [active, setActive] = React.useState(pkg.active);
  const [months, setMonths] = React.useState<number[]>(pkg.bestMonths);

  function save() {
    mutateDb((d) => {
      const p = d.packages.find((x) => x.id === pkg.id);
      if (!p) return;
      p.title = title.trim() || p.title;
      p.highlights = highlights
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      p.fromPriceINR = Math.max(0, fromPrice);
      p.active = active;
      p.bestMonths = [...months].sort((a, b) => a - b);
      logActivity(d, { actor: me.name, actorKind: "user", type: "package_updated", text: `Updated package ${p.code} — ${p.title}` });
    });
    onDone();
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Highlights (one per line)">
        <Textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={4} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From price (₹ per person)">
          <Input type="number" min={0} step={500} value={fromPrice} onChange={(e) => setFromPrice(Number(e.target.value))} />
        </Field>
        <div className="flex items-end pb-1">
          <Toggle checked={active} onChange={setActive} label="Active" />
        </div>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Best months</p>
        <div className="flex flex-wrap gap-1">
          {MONTHS.map((m, i) => {
            const on = months.includes(i + 1);
            return (
              <button key={m} type="button" onClick={() => setMonths(on ? months.filter((x) => x !== i + 1) : [...months, i + 1])} className={cn("min-h-[32px] rounded-md border px-2 text-xs", on ? "border-brand-500 bg-brand-100 text-brand-800" : "border-border text-muted-foreground")}>
                {m}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={save}>Save package</Button>
      </div>
    </div>
  );
}
