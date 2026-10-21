"use client";

import * as React from "react";
import Link from "next/link";
import { Pencil, Phone, Mail, Star, Wallet, MapPin } from "lucide-react";
import type { Supplier, SupplierType } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { destinationById, logActivity, travellerById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { SUPPLIER_TYPE_LABEL } from "@/lib/pipeline";
import { cn, formatDate, formatINR } from "@/lib/utils";
import { Badge, Button, Dialog, Input, Select, Sheet, Textarea } from "@/components/ui";
import { Field, KV, SectionTitle, TagChip, Toggle, TripStatusBadge } from "@/components/shared";

export const SUPPLIER_TYPE_CLASS: Record<SupplierType, string> = {
  hotel: "bg-brand-100 text-brand-800",
  dmc: "bg-indigo-100 text-indigo-800",
  transport: "bg-sky-100 text-sky-800",
  activity: "bg-saffron-100 text-saffron-700",
  airline: "bg-violet-100 text-violet-800",
  visa: "bg-amber-100 text-amber-800",
  insurance: "bg-emerald-100 text-emerald-800",
};

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-3.5 w-3.5", i <= Math.round(rating) ? "fill-saffron-400 text-saffron-400" : "text-border")} />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

export function SupplierSheet({ supplierId, onClose, onToast }: { supplierId: string | null; onClose: () => void; onToast: (m: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const s = db.suppliers.find((x) => x.id === supplierId) ?? null;
  const [editing, setEditing] = React.useState(false);
  const [payoutOpen, setPayoutOpen] = React.useState(false);
  const manage = can(me.role, "suppliers.manage");

  React.useEffect(() => {
    setEditing(false);
    setPayoutOpen(false);
  }, [supplierId]);

  const dest = s ? destinationById(db, s.destinationId) : undefined;
  const upcoming = s
    ? db.trips
        .filter((t) => (t.status === "confirmed" || t.status === "docs_pending" || t.status === "ready" || t.status === "on_trip") && (t.destinationId === s.destinationId || db.itineraries.find((i) => i.id === t.itineraryId)?.stays.some((st) => st.supplierId === s.id || st.name === s.name)))
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, 8)
    : [];

  return (
    <Sheet open={!!s} onClose={onClose} side="right" widthClassName="w-full max-w-xl" title={s ? s.name : undefined}>
      {s && (
        <div className="space-y-5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={SUPPLIER_TYPE_CLASS[s.type]}>{SUPPLIER_TYPE_LABEL[s.type]}</Badge>
                {!s.active && <Badge className="bg-zinc-100 text-zinc-700">Inactive</Badge>}
              </div>
              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {s.city}
                {dest && ` · ${dest.emoji} ${dest.name}`}
              </p>
              <Stars rating={s.rating} />
            </div>
            {manage && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPayoutOpen(true)} disabled={s.payableINR <= 0}>
                  <Wallet className="h-4 w-4" /> Record payout
                </Button>
                <Button size="sm" variant={editing ? "secondary" : "outline"} onClick={() => setEditing((v) => !v)}>
                  <Pencil className="h-4 w-4" /> {editing ? "Close" : "Edit"}
                </Button>
              </div>
            )}
          </div>

          {editing ? (
            <EditSupplierForm s={s} onDone={() => { setEditing(false); onToast("Supplier updated"); }} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3">
                <KV label="Contact" value={s.contactName} />
                <KV label="Phone" value={<a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="h-3 w-3" /> {s.phone}</a>} />
                <KV label="Email" value={<a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 truncate hover:underline"><Mail className="h-3 w-3" /> {s.email}</a>} />
                <KV label="Payment terms" value={s.paymentTerms} />
                <KV label="Payable" value={<span className={cn("font-semibold", s.payableINR > 0 ? "text-amber-700" : "text-emerald-700")}>{formatINR(s.payableINR)}</span>} />
                <KV label="Bookings" value={s.bookingsCount} />
                <KV label="Rates" value={s.ratesNote} className="col-span-2" />
              </div>
              {s.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {s.tags.map((t) => (
                    <TagChip key={t} name={t} />
                  ))}
                </div>
              )}
              {s.notes && <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">{s.notes}</p>}
            </>
          )}

          <div>
            <SectionTitle>Upcoming trips using this supplier</SectionTitle>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming trips in {dest?.name ?? "this destination"}.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {upcoming.map((t) => (
                  <li key={t.id}>
                    <Link href={`/trips/${t.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{travellerById(db, t.travellerId)?.fullName ?? t.ref}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.ref} · {formatDate(t.startDate, "short")} – {formatDate(t.endDate, "short")}
                        </p>
                      </div>
                      <TripStatusBadge status={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {s && <PayoutDialog s={s} open={payoutOpen} onClose={() => setPayoutOpen(false)} onDone={onToast} />}
    </Sheet>
  );
}

function PayoutDialog({ s, open, onClose, onDone }: { s: Supplier; open: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const me = useCurrentUser();
  const [amount, setAmount] = React.useState(s.payableINR);
  const [ref, setRef] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setAmount(s.payableINR);
      setRef("");
    }
  }, [open, s.payableINR]);

  function save() {
    const amt = Math.max(0, Math.min(s.payableINR, amount));
    mutateDb((d) => {
      const x = d.suppliers.find((y) => y.id === s.id);
      if (!x) return;
      x.payableINR = Math.max(0, x.payableINR - amt);
      logActivity(d, { actor: me.name, actorKind: "user", type: "supplier_payout", text: `Paid ${formatINR(amt)} to ${x.name}${ref ? ` (${ref})` : ""} — ${formatINR(x.payableINR)} still payable` });
    });
    onClose();
    onDone(`Payout of ${formatINR(amt)} recorded`);
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Record payout · ${s.name}`}>
      <div className="space-y-3 p-4">
        <Field label="Amount (₹)" hint={`Payable ${formatINR(s.payableINR)} · ${s.paymentTerms}`}>
          <Input type="number" min={0} max={s.payableINR} step={500} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </Field>
        <Field label="Reference / UTR">
          <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="NEFT…" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={amount <= 0}>
            Record payout
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function EditSupplierForm({ s, onDone }: { s: Supplier; onDone: () => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const [form, setForm] = React.useState({ ...s, tagsText: s.tags.join(", "), notes: s.notes ?? "", destinationId: s.destinationId ?? "" });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    mutateDb((d) => {
      const x = d.suppliers.find((y) => y.id === s.id);
      if (!x) return;
      x.name = form.name.trim() || x.name;
      x.type = form.type;
      x.destinationId = form.destinationId || undefined;
      x.city = form.city.trim();
      x.contactName = form.contactName.trim();
      x.phone = form.phone.trim();
      x.email = form.email.trim();
      x.rating = Math.max(1, Math.min(5, Number(form.rating) || 1));
      x.paymentTerms = form.paymentTerms.trim();
      x.ratesNote = form.ratesNote.trim();
      x.tags = form.tagsText.split(",").map((t) => t.trim()).filter(Boolean);
      x.notes = form.notes.trim() || undefined;
      x.active = form.active;
      logActivity(d, { actor: me.name, actorKind: "user", type: "supplier_updated", text: `Updated supplier ${x.name}` });
    });
    onDone();
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <SupplierFields form={form} set={set} destinations={db.destinations} />
      <div className="flex items-center justify-between gap-2">
        <Toggle checked={form.active} onChange={(v) => set("active", v)} label="Active" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  );
}

export interface SupplierFormShape {
  name: string;
  type: SupplierType;
  destinationId: string;
  city: string;
  contactName: string;
  phone: string;
  email: string;
  rating: number;
  paymentTerms: string;
  ratesNote: string;
  tagsText: string;
  notes: string;
}

export function SupplierFields<T extends SupplierFormShape>({ form, set, destinations }: { form: T; set: <K extends keyof T>(k: K, v: T[K]) => void; destinations: { id: string; name: string; emoji: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Name" className="sm:col-span-2">
        <Input value={form.name} onChange={(e) => set("name", e.target.value as T["name"])} />
      </Field>
      <Field label="Type">
        <Select value={form.type} onChange={(e) => set("type", e.target.value as T["type"])}>
          {(Object.keys(SUPPLIER_TYPE_LABEL) as SupplierType[]).map((t) => (
            <option key={t} value={t}>
              {SUPPLIER_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Destination">
        <Select value={form.destinationId} onChange={(e) => set("destinationId", e.target.value as T["destinationId"])}>
          <option value="">Any / multi</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.emoji} {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="City">
        <Input value={form.city} onChange={(e) => set("city", e.target.value as T["city"])} />
      </Field>
      <Field label="Contact person">
        <Input value={form.contactName} onChange={(e) => set("contactName", e.target.value as T["contactName"])} />
      </Field>
      <Field label="Phone">
        <Input value={form.phone} onChange={(e) => set("phone", e.target.value as T["phone"])} />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value as T["email"])} />
      </Field>
      <Field label="Rating (1–5)">
        <Input type="number" min={1} max={5} step={0.1} value={form.rating} onChange={(e) => set("rating", Number(e.target.value) as T["rating"])} />
      </Field>
      <Field label="Payment terms">
        <Input value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value as T["paymentTerms"])} placeholder="50% on booking, 50% at check-in" />
      </Field>
      <Field label="Rates note" className="sm:col-span-2">
        <Input value={form.ratesNote} onChange={(e) => set("ratesNote", e.target.value as T["ratesNote"])} placeholder="Deluxe ₹6,500/night incl. breakfast" />
      </Field>
      <Field label="Tags (comma separated)" className="sm:col-span-2">
        <Input value={form.tagsText} onChange={(e) => set("tagsText", e.target.value as T["tagsText"])} />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value as T["notes"])} rows={2} />
      </Field>
    </div>
  );
}

export function NewSupplierDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const blank: SupplierFormShape = { name: "", type: "hotel", destinationId: "", city: "", contactName: "", phone: "", email: "", rating: 4.5, paymentTerms: "", ratesNote: "", tagsText: "", notes: "" };
  const [form, setForm] = React.useState<SupplierFormShape>(blank);
  const set = <K extends keyof SupplierFormShape>(k: K, v: SupplierFormShape[K]) => setForm((f) => ({ ...f, [k]: v }));
  React.useEffect(() => {
    if (open) setForm(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function save() {
    if (!form.name.trim()) return;
    const id = newId("sup");
    mutateDb((d) => {
      d.suppliers.unshift({
        id,
        name: form.name.trim(),
        type: form.type,
        destinationId: form.destinationId || undefined,
        city: form.city.trim() || "—",
        contactName: form.contactName.trim() || "Reservations",
        phone: form.phone.trim(),
        email: form.email.trim(),
        rating: Math.max(1, Math.min(5, Number(form.rating) || 4)),
        paymentTerms: form.paymentTerms.trim() || "On booking",
        ratesNote: form.ratesNote.trim(),
        payableINR: 0,
        bookingsCount: 0,
        tags: form.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        notes: form.notes.trim() || undefined,
        active: true,
      });
      logActivity(d, { actor: me.name, actorKind: "user", type: "supplier_created", text: `Added supplier ${form.name.trim()} (${SUPPLIER_TYPE_LABEL[form.type]})`, at: nowIso() });
    });
    onClose();
    onCreated(id);
  }

  return (
    <Dialog open={open} onClose={onClose} title="New supplier" className="md:max-w-xl">
      <div className="space-y-3 p-4">
        <SupplierFields form={form} set={set} destinations={db.destinations} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!form.name.trim()}>
            Add supplier
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
