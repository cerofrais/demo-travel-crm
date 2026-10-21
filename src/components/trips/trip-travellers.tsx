"use client";

import * as React from "react";
import Link from "next/link";
import { UserPlus, Crown, AlertTriangle, X } from "lucide-react";
import type { Trip, Traveller } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { logActivity, travellerById, tripById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { FOOD_LABEL } from "@/lib/pipeline";
import { cn, formatDate, maskPassport } from "@/lib/utils";
import { Avatar, Button, Card, Dialog, Input, Select } from "@/components/ui";
import { Field } from "@/components/shared";
import { passportExpiryState } from "@/components/ops/helpers";

export function TripTravellers({ trip, onToast }: { trip: Trip; onToast: (m: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const [addOpen, setAddOpen] = React.useState(false);
  const manage = can(me.role, "trips.manage");
  const ids = Array.from(new Set([trip.travellerId, ...trip.travellerIds]));
  const people = ids.map((id) => travellerById(db, id)).filter((t): t is Traveller => !!t);

  function removeCo(id: string) {
    mutateDb((d) => {
      const t = tripById(d, trip.id);
      if (!t || id === t.travellerId) return;
      t.travellerIds = t.travellerIds.filter((x) => x !== id);
      logActivity(d, { actor: me.name, actorKind: "user", type: "traveller_removed", text: `Removed co-traveller ${travellerById(d, id)?.fullName ?? id} from ${t.ref}`, tripId: t.id, travellerId: id, enquiryId: t.enquiryId });
    });
    onToast("Co-traveller removed");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {people.length} on record · {trip.pax.adults + trip.pax.children + trip.pax.infants} travelling
        </p>
        {manage && trip.status !== "cancelled" && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add co-traveller
          </Button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {people.map((p) => {
          const lead = p.id === trip.travellerId;
          const exp = passportExpiryState(p.passportExpiry);
          return (
            <Card key={p.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar name={p.fullName} className="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/travellers?traveller=${p.id}`} className="truncate text-sm font-semibold text-foreground hover:underline">
                      {p.fullName}
                    </Link>
                    {lead && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-saffron-100 px-1.5 py-0.5 text-[10px] font-semibold text-saffron-700">
                        <Crown className="h-3 w-3" /> Lead
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.phone} · {p.city}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Passport</dt>
                      <dd className="font-mono">{maskPassport(p.passportNo)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Expiry</dt>
                      <dd className={cn("inline-flex items-center gap-1", exp.tone === "expired" ? "font-medium text-rose-600" : exp.tone === "warn" ? "font-medium text-amber-700" : "")}>
                        {(exp.tone === "warn" || exp.tone === "expired") && <AlertTriangle className="h-3 w-3" />}
                        {p.passportExpiry ? formatDate(p.passportExpiry) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Food</dt>
                      <dd>{FOOD_LABEL[p.foodPref]}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Nationality</dt>
                      <dd>{p.nationality}</dd>
                    </div>
                  </dl>
                  {exp.tone === "warn" && <p className="mt-1 text-[11px] text-amber-700">Passport expires in {exp.days} days — many countries need 6 months validity.</p>}
                  {exp.tone === "expired" && <p className="mt-1 text-[11px] text-rose-600">Passport expired — renewal needed before travel.</p>}
                </div>
                {!lead && manage && (
                  <Button size="icon" variant="ghost" title="Remove from trip" onClick={() => removeCo(p.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <AddCoTravellerDialog trip={trip} open={addOpen} onClose={() => setAddOpen(false)} onDone={onToast} />
    </div>
  );
}

function AddCoTravellerDialog({ trip, open, onClose, onDone }: { trip: Trip; open: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const lead = travellerById(db, trip.travellerId);
  const [mode, setMode] = React.useState<"existing" | "new">("existing");
  const [existingId, setExistingId] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [passport, setPassport] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [q, setQ] = React.useState("");

  const already = new Set([trip.travellerId, ...trip.travellerIds]);
  const candidates = db.travellers.filter((t) => !already.has(t.id) && (!q || t.fullName.toLowerCase().includes(q.toLowerCase()) || t.phone.includes(q))).slice(0, 8);

  function add() {
    let id = existingId;
    mutateDb((d) => {
      const t = tripById(d, trip.id);
      if (!t) return;
      if (mode === "new") {
        if (!name.trim()) return;
        id = newId("trav");
        d.travellers.push({
          id,
          fullName: name.trim(),
          phone: phone.trim() || lead?.phone || "",
          city: lead?.city ?? "Bengaluru",
          preferredChannel: "whatsapp",
          language: lead?.language ?? "en",
          nationality: lead?.nationality ?? "Indian",
          passportNo: passport.trim() || undefined,
          passportExpiry: expiry ? new Date(`${expiry}T00:00:00`).toISOString() : undefined,
          foodPref: lead?.foodPref ?? "no_preference",
          pace: t.pax ? lead?.pace ?? "balanced" : "balanced",
          comfort: lead?.comfort ?? "comfort",
          interests: [],
          tags: ["co-traveller"],
          blocked: false,
          tripsCount: 1,
          lifetimeValueINR: 0,
          createdAt: nowIso(),
        });
      }
      if (!id || t.travellerIds.includes(id)) return;
      t.travellerIds.push(id);
      logActivity(d, { actor: me.name, actorKind: "user", type: "traveller_added", text: `Added co-traveller ${travellerById(d, id)?.fullName ?? ""} to ${t.ref}`, tripId: t.id, travellerId: id, enquiryId: t.enquiryId });
    });
    onClose();
    onDone("Co-traveller added");
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add co-traveller">
      <div className="space-y-3 p-4">
        <div className="flex gap-1 rounded-lg bg-secondary p-1 text-xs font-medium">
          {(["existing", "new"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex-1 rounded-md py-2 transition-colors", mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              {m === "existing" ? "Pick existing" : "Create new"}
            </button>
          ))}
        </div>
        {mode === "existing" ? (
          <>
            <Field label="Search travellers">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone" />
            </Field>
            <Field label="Traveller">
              <Select value={existingId} onChange={(e) => setExistingId(e.target.value)}>
                <option value="">Select…</option>
                {candidates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} · {t.city}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Co-traveller's name" />
            </Field>
            <Field label="Phone (optional)">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Passport no.">
                <Input value={passport} onChange={(e) => setPassport(e.target.value)} placeholder="Optional" />
              </Field>
              <Field label="Passport expiry">
                <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </Field>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={add} disabled={mode === "existing" ? !existingId : !name.trim()}>
            Add to trip
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
