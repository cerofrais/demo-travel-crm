"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, Copy, Gift, QrCode, ExternalLink, AlertTriangle, Ban } from "lucide-react";
import type { Channel, Comfort, FoodPref, Language, Pace, Traveller } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { enquiriesForTraveller, logActivity, travellerById, tripsForTraveller } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { CHANNEL_LABEL, COMFORT_LABEL, FOOD_LABEL, INTERESTS, PACE_LABEL } from "@/lib/pipeline";
import { cn, copyToClipboard, formatDate, formatINR, maskPassport, toDateInput } from "@/lib/utils";
import { Avatar, Button, Input, ScrollableTabs, Select, Sheet, Textarea } from "@/components/ui";
import { ChannelBadge, EmptyState, Field, StageBadge, TagChip, Toggle, TripStatusBadge, useToast } from "@/components/shared";
import { ConversationPanel } from "@/components/conversation/conversation-panel";
import { DocumentList } from "@/components/documents/document-list";
import { CITIES, LANGUAGE_LABEL } from "./traveller-dialogs";
import { passportExpiryState } from "@/components/ops/helpers";

type Tab = "profile" | "enquiries" | "trips" | "conversation" | "documents" | "referral";
const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "enquiries", label: "Enquiries" },
  { key: "trips", label: "Trips" },
  { key: "conversation", label: "Conversation" },
  { key: "documents", label: "Documents" },
  { key: "referral", label: "Referral" },
];

export function TravellerSheet({ travellerId, onClose }: { travellerId: string | null; onClose: () => void }) {
  const db = useDb();
  const t = travellerById(db, travellerId);
  const [tab, setTab] = React.useState<Tab>("profile");
  const { toast, node } = useToast();

  React.useEffect(() => {
    setTab("profile");
  }, [travellerId]);

  return (
    <Sheet open={!!t} onClose={onClose} side="right" widthClassName="w-full max-w-xl" scrollBody={false} ariaLabel="Traveller details">
      {node}
      {t && (
        <>
          <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
            <Avatar name={t.fullName} className="h-11 w-11 text-sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-display text-base font-semibold text-foreground">{t.fullName}</h2>
                <ChannelBadge channel={t.preferredChannel} />
                {t.blocked && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                    <Ban className="h-3 w-3" /> Blocked
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t.city} · {t.phone} {t.email && `· ${t.email}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.tripsCount} trip{t.tripsCount === 1 ? "" : "s"} · LTV {formatINR(t.lifetimeValueINR, { compact: true })} · since {formatDate(t.createdAt, "short")}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary">
              ×
            </button>
          </div>
          <ScrollableTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} className="shrink-0" />
          <div className={cn("min-h-0 flex-1", tab === "conversation" ? "flex flex-col" : "overflow-y-auto p-4")}>
            {tab === "profile" && <ProfileTab t={t} onToast={toast} />}
            {tab === "enquiries" && <EnquiriesTab t={t} />}
            {tab === "trips" && <TripsTab t={t} />}
            {tab === "conversation" && <ConversationPanel travellerId={t.id} enquiryId={enquiriesForTraveller(db, t.id)[0]?.id} channel={t.preferredChannel} className="min-h-0 flex-1" />}
            {tab === "documents" && <DocumentList travellerId={t.id} />}
            {tab === "referral" && <ReferralTab t={t} onToast={toast} />}
          </div>
        </>
      )}
    </Sheet>
  );
}

function ProfileTab({ t, onToast }: { t: Traveller; onToast: (m: string) => void }) {
  const me = useCurrentUser();
  const db = useDb();
  const manage = can(me.role, "travellers.manage");
  const canReveal = me.role === "OPS" || me.role === "ADMIN" || me.role === "MANAGER";
  const [reveal, setReveal] = React.useState(false);
  const [form, setForm] = React.useState(() => toForm(t));
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    setForm(toForm(t));
    setDirty(false);
    setReveal(false);
  }, [t.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  function save() {
    mutateDb((d) => {
      const x = travellerById(d, t.id);
      if (!x) return;
      x.phone = form.phone.trim();
      x.email = form.email.trim() || undefined;
      x.city = form.city;
      x.instagramHandle = form.instagramHandle.trim() || undefined;
      x.preferredChannel = form.preferredChannel;
      x.language = form.language;
      x.dob = form.dob ? new Date(`${form.dob}T00:00:00`).toISOString() : undefined;
      x.anniversary = form.anniversary ? new Date(`${form.anniversary}T00:00:00`).toISOString() : undefined;
      x.nationality = form.nationality.trim() || "Indian";
      x.passportNo = form.passportNo.trim() || undefined;
      x.passportExpiry = form.passportExpiry ? new Date(`${form.passportExpiry}T00:00:00`).toISOString() : undefined;
      x.foodPref = form.foodPref;
      x.pace = form.pace;
      x.comfort = form.comfort;
      x.interests = form.interests;
      x.notes = form.notes.trim() || undefined;
      x.blocked = form.blocked;
      logActivity(d, { actor: me.name, actorKind: "user", type: "traveller_updated", text: `Updated profile for ${x.fullName}${form.blocked !== t.blocked ? (form.blocked ? " — blocked" : " — unblocked") : ""}`, travellerId: x.id });
    });
    setDirty(false);
    onToast("Profile saved");
  }

  const exp = passportExpiryState(form.passportExpiry ? new Date(`${form.passportExpiry}T00:00:00`).toISOString() : undefined);
  const ro = !manage;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={ro} />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={(e) => set("email", e.target.value)} disabled={ro} />
        </Field>
        <Field label="Instagram">
          <Input value={form.instagramHandle} onChange={(e) => set("instagramHandle", e.target.value)} placeholder="@handle" disabled={ro} />
        </Field>
        <Field label="City">
          <Select value={form.city} onChange={(e) => set("city", e.target.value)} disabled={ro}>
            {Array.from(new Set([...CITIES, form.city])).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Preferred channel">
          <Select value={form.preferredChannel} onChange={(e) => set("preferredChannel", e.target.value as Channel)} disabled={ro}>
            {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Language">
          <Select value={form.language} onChange={(e) => set("language", e.target.value as Language)} disabled={ro}>
            {(Object.keys(LANGUAGE_LABEL) as Language[]).map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABEL[l]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date of birth">
          <Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} disabled={ro} />
        </Field>
        <Field label="Anniversary">
          <Input type="date" value={form.anniversary} onChange={(e) => set("anniversary", e.target.value)} disabled={ro} />
        </Field>
      </div>

      <div className="rounded-xl border border-border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Travel documents</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nationality">
            <Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} disabled={ro} />
          </Field>
          <Field label="Passport no.">
            <div className="flex gap-1">
              {reveal && canReveal ? (
                <Input value={form.passportNo} onChange={(e) => set("passportNo", e.target.value)} disabled={ro} className="font-mono" />
              ) : (
                <Input value={maskPassport(form.passportNo)} readOnly className="font-mono" />
              )}
              {canReveal && (
                <Button type="button" size="icon" variant="outline" onClick={() => setReveal((v) => !v)} title={reveal ? "Hide" : "Reveal"}>
                  {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </Field>
          <Field label="Passport expiry" className="col-span-2">
            <Input type="date" value={form.passportExpiry} onChange={(e) => set("passportExpiry", e.target.value)} disabled={ro} />
            {(exp.tone === "warn" || exp.tone === "expired") && (
              <span className={cn("mt-1 inline-flex items-center gap-1 text-[11px] font-medium", exp.tone === "expired" ? "text-rose-600" : "text-amber-700")}>
                <AlertTriangle className="h-3 w-3" /> {exp.tone === "expired" ? "Passport has expired" : `Expires in ${exp.days} days — check 6-month validity rule`}
              </span>
            )}
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Food">
          <Select value={form.foodPref} onChange={(e) => set("foodPref", e.target.value as FoodPref)} disabled={ro}>
            {(Object.keys(FOOD_LABEL) as FoodPref[]).map((f) => (
              <option key={f} value={f}>
                {FOOD_LABEL[f]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Pace">
          <Select value={form.pace} onChange={(e) => set("pace", e.target.value as Pace)} disabled={ro}>
            {(Object.keys(PACE_LABEL) as Pace[]).map((p) => (
              <option key={p} value={p}>
                {PACE_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Comfort">
          <Select value={form.comfort} onChange={(e) => set("comfort", e.target.value as Comfort)} disabled={ro}>
            {(Object.keys(COMFORT_LABEL) as Comfort[]).map((c) => (
              <option key={c} value={c}>
                {COMFORT_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Interests</p>
        <div className="flex flex-wrap gap-1.5">
          {INTERESTS.map((i) => {
            const on = form.interests.includes(i);
            return (
              <button key={i} type="button" disabled={ro} onClick={() => set("interests", on ? form.interests.filter((x) => x !== i) : [...form.interests, i])} className={cn("min-h-[32px] rounded-full border px-2.5 text-xs transition-colors disabled:opacity-70", on ? "border-brand-500 bg-brand-100 text-brand-800" : "border-border text-muted-foreground hover:bg-secondary")}>
                {i}
              </button>
            );
          })}
        </div>
      </div>

      {t.tags.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</p>
          <div className="flex flex-wrap gap-1">
            {t.tags.map((tag) => (
              <TagChip key={tag} name={tag} tags={db.tags} />
            ))}
          </div>
        </div>
      )}

      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} disabled={ro} />
      </Field>

      {manage && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Toggle checked={form.blocked} onChange={(v) => set("blocked", v)} label="Block traveller (no automated messages)" />
          <Button onClick={save} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      )}
    </div>
  );
}

function toForm(t: Traveller) {
  return {
    phone: t.phone,
    email: t.email ?? "",
    city: t.city,
    instagramHandle: t.instagramHandle ?? "",
    preferredChannel: t.preferredChannel,
    language: t.language,
    dob: toDateInput(t.dob),
    anniversary: toDateInput(t.anniversary),
    nationality: t.nationality,
    passportNo: t.passportNo ?? "",
    passportExpiry: toDateInput(t.passportExpiry),
    foodPref: t.foodPref,
    pace: t.pace,
    comfort: t.comfort,
    interests: [...t.interests],
    notes: t.notes ?? "",
    blocked: t.blocked,
  };
}

function EnquiriesTab({ t }: { t: Traveller }) {
  const db = useDb();
  const list = enquiriesForTraveller(db, t.id);
  if (list.length === 0) return <EmptyState title="No enquiries yet" />;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {list.map((e) => (
        <li key={e.id}>
          <Link href={`/enquiries?enquiry=${e.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/60">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {e.ref} · {e.destination}
              </p>
              <p className="text-xs text-muted-foreground">
                {e.nights}N · {e.pax.adults + e.pax.children} pax · {formatINR(e.budgetINR, { compact: true })} · {formatDate(e.createdAt, "short")}
              </p>
            </div>
            <StageBadge stage={e.stage} />
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TripsTab({ t }: { t: Traveller }) {
  const db = useDb();
  const list = tripsForTraveller(db, t.id);
  if (list.length === 0) return <EmptyState title="No trips yet" hint="Trips appear once an enquiry's advance is paid." />;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {list.map((tr) => (
        <li key={tr.id}>
          <Link href={`/trips/${tr.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/60">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{tr.title}</p>
              <p className="text-xs text-muted-foreground">
                {tr.ref} · {formatDate(tr.startDate, "short")} – {formatDate(tr.endDate, "short")} · {formatINR(tr.totalINR, { compact: true })}
              </p>
            </div>
            <TripStatusBadge status={tr.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ReferralTab({ t, onToast }: { t: Traveller; onToast: (m: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const manage = can(me.role, "travellers.manage");
  const referral = db.referrals.find((r) => r.travellerId === t.id);
  const code = t.referralCode ?? referral?.code;
  const link = code ? `wishtrip.co/r/${code}` : null;

  function generate() {
    const newCode = `${t.fullName.split(" ")[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "WISH"}${10 + Math.floor(Math.random() * 90)}`;
    mutateDb((d) => {
      const x = travellerById(d, t.id);
      if (!x) return;
      x.referralCode = newCode;
      d.referrals.push({ id: newId("ref"), code: newCode, travellerId: x.id, discountPct: 5, uses: 0, maxUses: 10, active: true, referredEnquiryIds: [], createdAt: nowIso() });
      logActivity(d, { actor: me.name, actorKind: "user", type: "referral_created", text: `Generated referral code ${newCode} for ${x.fullName}`, travellerId: x.id });
    });
    onToast("Referral code generated");
  }

  async function copy() {
    if (!link) return;
    const ok = await copyToClipboard(`https://${link}`);
    onToast(ok ? "Referral link copied" : "Could not copy");
  }

  if (!code) {
    return (
      <EmptyState
        icon={Gift}
        title="No referral code yet"
        hint="Codes give friends 5% off and the traveller ₹2,000 off their next trip."
        action={manage ? <Button onClick={generate}>Generate code</Button> : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:flex-row sm:items-center">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-secondary/60 text-muted-foreground" aria-label="QR placeholder">
          <QrCode className="h-14 w-14" strokeWidth={1.2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Referral code</p>
          <p className="font-display text-2xl font-semibold tracking-wide text-foreground">{code}</p>
          <p className="truncate text-sm text-muted-foreground">{link}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copy}>
              <Copy className="h-4 w-4" /> Copy link
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-secondary p-3">
          <p className="text-xl font-semibold">{referral?.uses ?? 0}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Uses</p>
        </div>
        <div className="rounded-lg bg-secondary p-3">
          <p className="text-xl font-semibold">{referral?.discountPct ?? 5}%</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Friend discount</p>
        </div>
        <div className="rounded-lg bg-secondary p-3">
          <p className="text-xl font-semibold">{referral ? referral.maxUses - referral.uses : 10}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Left</p>
        </div>
      </div>
      {referral && referral.referredEnquiryIds.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Referred enquiries</p>
          <ul className="space-y-1 text-sm">
            {referral.referredEnquiryIds.map((id) => {
              const e = db.enquiries.find((x) => x.id === id);
              return (
                <li key={id}>
                  <Link href={`/enquiries?enquiry=${id}`} className="text-brand-700 hover:underline">
                    {e?.ref ?? id} {e && `· ${e.destination}`}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
