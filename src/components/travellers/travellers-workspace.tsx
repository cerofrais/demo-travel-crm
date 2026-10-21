"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, LayoutGrid, List, Download, UserPlus, Tags, Repeat, AlertTriangle, Phone, Instagram, Mail } from "lucide-react";
import type { Channel, Traveller } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { can } from "@/lib/rbac";
import { CHANNEL_LABEL } from "@/lib/pipeline";
import { cn, formatINR, formatDate, downloadText, toCsv } from "@/lib/utils";
import { Avatar, Button, Card, Input, Select } from "@/components/ui";
import { ChannelBadge, EmptyState, TagChip, useToast } from "@/components/shared";
import { PageHeader } from "@/components/app/page-header";
import { TravellerSheet } from "./traveller-sheet";
import { NewTravellerDialog, BulkTagDialog } from "./traveller-dialogs";
import { passportExpiryState } from "@/components/ops/helpers";

type Sort = "recent" | "ltv" | "trips";

export function TravellersWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const router = useRouter();
  const params = useSearchParams();
  const { toast, node } = useToast();
  const openId = params.get("traveller");
  const manage = can(me.role, "travellers.manage");

  const [q, setQ] = React.useState("");
  const [city, setCity] = React.useState("");
  const [channel, setChannel] = React.useState<"" | Channel>("");
  const [returning, setReturning] = React.useState(false);
  const [hasPassport, setHasPassport] = React.useState(false);
  const [sort, setSort] = React.useState<Sort>("recent");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [newOpen, setNewOpen] = React.useState(false);
  const [tagOpen, setTagOpen] = React.useState(false);

  React.useEffect(() => {
    if (window.innerWidth < 768) setView("list");
  }, []);

  const cities = React.useMemo(() => Array.from(new Set(db.travellers.map((t) => t.city))).sort(), [db.travellers]);

  const rows = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const lastTripMap = new Map<string, string>();
    for (const t of db.trips) {
      const prev = lastTripMap.get(t.travellerId);
      if (!prev || t.startDate > prev) lastTripMap.set(t.travellerId, t.startDate);
    }
    return db.travellers
      .filter((t) => !needle || [t.fullName, t.phone, t.email, t.city, t.instagramHandle, ...t.tags].some((x) => x?.toLowerCase().includes(needle)))
      .filter((t) => !city || t.city === city)
      .filter((t) => !channel || t.preferredChannel === channel)
      .filter((t) => !returning || t.tripsCount >= 2 || t.tags.includes("repeat"))
      .filter((t) => !hasPassport || !!t.passportNo)
      .map((t) => ({ t, lastTrip: lastTripMap.get(t.id) }))
      .sort((a, b) => {
        if (sort === "ltv") return b.t.lifetimeValueINR - a.t.lifetimeValueINR;
        if (sort === "trips") return b.t.tripsCount - a.t.tripsCount;
        return b.t.createdAt.localeCompare(a.t.createdAt);
      });
  }, [db.travellers, db.trips, q, city, channel, returning, hasPassport, sort]);

  function open(id: string) {
    router.push(`/travellers?traveller=${id}`);
  }
  function close() {
    router.push("/travellers");
  }

  function exportCsv() {
    const csv = toCsv(
      rows.map(({ t, lastTrip }) => ({
        name: t.fullName,
        phone: t.phone,
        email: t.email ?? "",
        city: t.city,
        channel: CHANNEL_LABEL[t.preferredChannel],
        trips: t.tripsCount,
        ltv_inr: t.lifetimeValueINR,
        last_trip: lastTrip ? formatDate(lastTrip) : "",
        tags: t.tags.join("|"),
        passport_expiry: t.passportExpiry ? formatDate(t.passportExpiry) : "",
      })),
    );
    downloadText(`wishtrip-travellers-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
    toast(`Exported ${rows.length} travellers`);
  }

  function toggleSel(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.t.id));

  return (
    <>
      {node}
      <PageHeader title="Travellers" subtitle={`${db.travellers.length} travellers · ${db.travellers.filter((t) => t.tripsCount >= 2).length} repeat`}>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" /> CSV
        </Button>
        {manage && selected.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setTagOpen(true)}>
            <Tags className="h-4 w-4" /> Tag {selected.length}
          </Button>
        )}
        {manage && (
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <UserPlus className="h-4 w-4" /> New traveller
          </Button>
        )}
      </PageHeader>

      <div className="space-y-4 p-4 md:p-6">
        <Card className="space-y-3 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email, city or tag" className="pl-9" />
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex">
              <Select value={city} onChange={(e) => setCity(e.target.value)} className="md:w-40">
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel | "")} className="md:w-40">
                <option value="">Any channel</option>
                {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABEL[c]}
                  </option>
                ))}
              </Select>
              <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="md:w-40">
                <option value="recent">Newest first</option>
                <option value="ltv">Highest LTV</option>
                <option value="trips">Most trips</option>
              </Select>
              <div className="hidden overflow-hidden rounded-md border border-border md:flex">
                <button type="button" onClick={() => setView("grid")} className={cn("flex h-9 w-10 items-center justify-center", view === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground")} aria-label="Grid view">
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setView("list")} className={cn("flex h-9 w-10 items-center justify-center", view === "list" ? "bg-secondary text-foreground" : "text-muted-foreground")} aria-label="List view">
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex min-h-[32px] items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4" checked={returning} onChange={(e) => setReturning(e.target.checked)} /> Returning only
            </label>
            <label className="inline-flex min-h-[32px] items-center gap-1.5">
              <input type="checkbox" className="h-4 w-4" checked={hasPassport} onChange={(e) => setHasPassport(e.target.checked)} /> Has passport
            </label>
            {manage && (
              <label className="inline-flex min-h-[32px] items-center gap-1.5">
                <input type="checkbox" className="h-4 w-4" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.t.id) : [])} /> Select all ({rows.length})
              </label>
            )}
            <span className="ml-auto text-muted-foreground">{rows.length} shown</span>
          </div>
        </Card>

        {rows.length === 0 ? (
          <EmptyState title="No travellers match" hint="Loosen a filter or search for something else." />
        ) : view === "grid" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ t, lastTrip }) => (
              <TravellerCard key={t.id} t={t} lastTrip={lastTrip} selected={selected.includes(t.id)} onSelect={manage ? () => toggleSel(t.id) : undefined} onOpen={() => open(t.id)} tags={db.tags} />
            ))}
          </div>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {rows.map(({ t, lastTrip }) => (
              <TravellerRow key={t.id} t={t} lastTrip={lastTrip} selected={selected.includes(t.id)} onSelect={manage ? () => toggleSel(t.id) : undefined} onOpen={() => open(t.id)} tags={db.tags} />
            ))}
          </Card>
        )}
      </div>

      <TravellerSheet travellerId={openId} onClose={close} />
      <NewTravellerDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => { toast("Traveller created"); open(id); }} />
      <BulkTagDialog open={tagOpen} onClose={() => setTagOpen(false)} ids={selected} onDone={(m) => { toast(m); setSelected([]); }} />
    </>
  );
}

function ChannelIcon({ c }: { c: Channel }) {
  if (c === "instagram") return <Instagram className="h-3.5 w-3.5" />;
  if (c === "email") return <Mail className="h-3.5 w-3.5" />;
  return <Phone className="h-3.5 w-3.5" />;
}

interface RowProps {
  t: Traveller;
  lastTrip?: string;
  selected: boolean;
  onSelect?: () => void;
  onOpen: () => void;
  tags: { name: string; category: "intent" | "destination" | "stage" | "campaign" | "ops" | "custom"; color: string }[];
}

function TravellerCard({ t, lastTrip, selected, onSelect, onOpen, tags }: RowProps) {
  const exp = passportExpiryState(t.passportExpiry);
  const repeat = t.tripsCount >= 2 || t.tags.includes("repeat");
  return (
    <Card className={cn("relative flex flex-col gap-2 p-4 transition-shadow hover:shadow-md", selected && "ring-2 ring-primary")}>
      {onSelect && <input type="checkbox" checked={selected} onChange={onSelect} className="absolute right-3 top-3 h-4 w-4" aria-label={`Select ${t.fullName}`} onClick={(e) => e.stopPropagation()} />}
      <button type="button" onClick={onOpen} className="flex items-start gap-3 text-left">
        <Avatar name={t.fullName} className="h-11 w-11 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{t.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t.city} · {t.phone}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <ChannelBadge channel={t.preferredChannel} />
            {repeat && (
              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                <Repeat className="h-3 w-3" /> Repeat
              </span>
            )}
            {t.blocked && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Blocked</span>}
          </div>
        </div>
      </button>
      <div className="grid grid-cols-3 gap-2 border-t border-border pt-2 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Trips</p>
          <p className="font-semibold">{t.tripsCount}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">LTV</p>
          <p className="font-semibold">{formatINR(t.lifetimeValueINR, { compact: true })}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last trip</p>
          <p className="font-semibold">{lastTrip ? formatDate(lastTrip, "short") : "—"}</p>
        </div>
      </div>
      {(t.tags.length > 0 || exp.tone !== "ok") && (
        <div className="flex flex-wrap items-center gap-1">
          {t.tags.slice(0, 4).map((tag) => (
            <TagChip key={tag} name={tag} tags={tags} />
          ))}
          {(exp.tone === "warn" || exp.tone === "expired") && (
            <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold", exp.tone === "expired" ? "text-rose-600" : "text-amber-700")}>
              <AlertTriangle className="h-3 w-3" /> Passport {exp.tone === "expired" ? "expired" : `${exp.days}d`}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function TravellerRow({ t, lastTrip, selected, onSelect, onOpen, tags }: RowProps) {
  const exp = passportExpiryState(t.passportExpiry);
  const repeat = t.tripsCount >= 2 || t.tags.includes("repeat");
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5", selected && "bg-brand-50/60")}>
      {onSelect && <input type="checkbox" checked={selected} onChange={onSelect} className="h-4 w-4 shrink-0" aria-label={`Select ${t.fullName}`} />}
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar name={t.fullName} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium text-foreground">{t.fullName}</p>
            {repeat && (
              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                <Repeat className="h-3 w-3" /> Repeat
              </span>
            )}
            {(exp.tone === "warn" || exp.tone === "expired") && <AlertTriangle className={cn("h-3.5 w-3.5", exp.tone === "expired" ? "text-rose-600" : "text-amber-600")} />}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {t.city} · {t.phone}
            {t.tags.length > 0 && ` · ${t.tags.slice(0, 3).join(", ")}`}
          </p>
        </div>
        <div className="hidden items-center gap-1 text-muted-foreground sm:flex">
          <ChannelIcon c={t.preferredChannel} />
          <span className="text-xs">{CHANNEL_LABEL[t.preferredChannel]}</span>
        </div>
        <div className="w-14 text-right text-xs">
          <p className="font-semibold">{t.tripsCount}</p>
          <p className="text-[10px] text-muted-foreground">trips</p>
        </div>
        <div className="w-16 text-right text-xs">
          <p className="font-semibold">{formatINR(t.lifetimeValueINR, { compact: true })}</p>
          <p className="text-[10px] text-muted-foreground">{lastTrip ? formatDate(lastTrip, "short") : "no trip"}</p>
        </div>
      </button>
    </div>
  );
}
