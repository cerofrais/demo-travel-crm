"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Film, Plus, ExternalLink, Package, Send, Sparkles } from "lucide-react";
import type { ItineraryStatus, TripType } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { destinationById, enquiryById, logActivity, travellerById, userName } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { COMFORT_LABEL, PACE_LABEL, TRIP_TYPE_LABEL } from "@/lib/pipeline";
import { cn, formatDate, formatINR, formatDateTime } from "@/lib/utils";
import { Button, Card, Select, Sheet, ScrollableTabs } from "@/components/ui";
import { EmptyState, Toggle, useToast } from "@/components/shared";
import { PageHeader } from "@/components/app/page-header";
import { ItineraryView, ItineraryStatusBadge } from "./itinerary-view";
import { PackageSheet } from "./package-sheet";
import { NewPackageDialog } from "./package-new-dialog";
import { ReelBuilder } from "./reel-builder";
import { monthsLabel } from "./package-utils";

type Tab = "library" | "sent";

export function PackagesWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const params = useSearchParams();
  const { toast, node } = useToast();
  const [tab, setTab] = React.useState<Tab>(params.get("tab") === "sent" ? "sent" : "library");
  const [pkgId, setPkgId] = React.useState<string | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [itinId, setItinId] = React.useState<string | null>(null);
  const canEdit = can(me.role, "itineraries.edit");

  return (
    <>
      {node}
      <PageHeader title="Itineraries & Packages" subtitle="Reusable packages built from reels, and every itinerary version sent to a traveller.">
        {canEdit && (
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New package
          </Button>
        )}
      </PageHeader>

      <div className="space-y-6 p-4 md:p-6">
        <ReelBuilder onToast={toast} />

        <Card className="overflow-hidden">
          <ScrollableTabs
            tabs={[
              { key: "library", label: `Package library (${db.packages.length})`, icon: <Package className="h-4 w-4" /> },
              { key: "sent", label: `Sent itineraries (${db.itineraries.length})`, icon: <Send className="h-4 w-4" /> },
            ]}
            active={tab}
            onChange={(k) => setTab(k as Tab)}
          />
          <div className="p-4">{tab === "library" ? <Library onOpen={setPkgId} canEdit={canEdit} onToast={toast} /> : <SentItineraries onOpen={setItinId} />}</div>
        </Card>
      </div>

      <PackageSheet packageId={pkgId} onClose={() => setPkgId(null)} onToast={toast} />
      <NewPackageDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => { toast("Package created"); setPkgId(id); }} />
      <ItinerarySheet itineraryId={itinId} onClose={() => setItinId(null)} />
    </>
  );
}

function Library({ onOpen, canEdit, onToast }: { onOpen: (id: string) => void; canEdit: boolean; onToast: (m: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const [destination, setDestination] = React.useState("");
  const [tripType, setTripType] = React.useState<"" | TripType>("");
  const [showInactive, setShowInactive] = React.useState(false);

  const list = db.packages
    .filter((p) => !destination || p.destinationId === destination)
    .filter((p) => !tripType || p.tripTypes.includes(tripType))
    .filter((p) => showInactive || p.active)
    .sort((a, b) => b.timesSold - a.timesSold);

  function toggleActive(id: string, v: boolean) {
    mutateDb((d) => {
      const p = d.packages.find((x) => x.id === id);
      if (!p) return;
      p.active = v;
      logActivity(d, { actor: me.name, actorKind: "user", type: "package_updated", text: `${v ? "Activated" : "Deactivated"} package ${p.code}` });
    });
    onToast(v ? "Package activated" : "Package deactivated");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={destination} onChange={(e) => setDestination(e.target.value)} className="sm:w-48">
          <option value="">All destinations</option>
          {db.destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.emoji} {d.name}
            </option>
          ))}
        </Select>
        <Select value={tripType} onChange={(e) => setTripType(e.target.value as TripType | "")} className="sm:w-44">
          <option value="">All trip types</option>
          {(Object.keys(TRIP_TYPE_LABEL) as TripType[]).map((t) => (
            <option key={t} value={t}>
              {TRIP_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <label className="inline-flex min-h-[36px] items-center gap-1.5 text-xs">
          <input type="checkbox" className="h-4 w-4" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
        </label>
        <span className="text-xs text-muted-foreground sm:ml-auto">{list.length} packages</span>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Package} title="No packages match" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const dest = destinationById(db, p.destinationId);
            return (
              <Card key={p.id} className={cn("flex flex-col p-4 transition-shadow hover:shadow-md", !p.active && "opacity-60")}>
                <button type="button" onClick={() => onOpen(p.id)} className="flex-1 text-left">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">{dest?.emoji ?? "🧳"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p.code}</p>
                      <p className="font-display text-base font-semibold leading-tight text-foreground">{p.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.nights}N/{p.nights + 1}D · {p.tripTypes.map((t) => TRIP_TYPE_LABEL[t]).join(", ")} · {PACE_LABEL[p.pace]} · {COMFORT_LABEL[p.comfort]}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                    {p.highlights.slice(0, 3).map((h, i) => (
                      <li key={i} className="truncate">• {h}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {p.sourceReel && (
                      <span className="inline-flex max-w-full items-center gap-1 truncate rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-medium text-pink-700">
                        <Film className="h-3 w-3 shrink-0" /> Built from reel: {p.sourceReel.replace(/^https?:\/\//, "")}
                      </span>
                    )}
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">Best {monthsLabel(p.bestMonths).split(" · ").slice(0, 3).join("/")}</span>
                  </div>
                </button>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">From</p>
                    <p className="text-sm font-semibold">{formatINR(p.fromPriceINR, { compact: true })} <span className="text-xs font-normal text-muted-foreground">pp</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sold <span className="font-semibold text-foreground">{p.timesSold}</span>×
                  </p>
                  {canEdit ? <Toggle checked={p.active} onChange={(v) => toggleActive(p.id, v)} /> : <span className={cn("text-[10px] font-semibold uppercase", p.active ? "text-emerald-700" : "text-muted-foreground")}>{p.active ? "Active" : "Inactive"}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SentItineraries({ onOpen }: { onOpen: (id: string) => void }) {
  const db = useDb();
  const [status, setStatus] = React.useState<"" | ItineraryStatus>("");
  const [destination, setDestination] = React.useState("");

  const rows = db.itineraries
    .filter((i) => !status || i.status === status)
    .filter((i) => !destination || i.destinationId === destination)
    .map((i) => ({ i, enquiry: enquiryById(db, i.enquiryId) }))
    .map((r) => ({ ...r, traveller: travellerById(db, r.enquiry?.travellerId), dest: destinationById(db, r.i.destinationId) }))
    .sort((a, b) => (b.i.sentAt ?? b.i.createdAt).localeCompare(a.i.sentAt ?? a.i.createdAt));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={status} onChange={(e) => setStatus(e.target.value as ItineraryStatus | "")} className="sm:w-40">
          <option value="">All statuses</option>
          {(["draft", "sent", "viewed", "accepted", "revised", "rejected"] as ItineraryStatus[]).map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </Select>
        <Select value={destination} onChange={(e) => setDestination(e.target.value)} className="sm:w-48">
          <option value="">All destinations</option>
          {db.destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.emoji} {d.name}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted-foreground sm:ml-auto">{rows.length} itineraries · {rows.filter((r) => r.i.generatedByAI).length} AI-built</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Send} title="No itineraries match" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Enquiry</th>
                <th className="px-3 py-2 font-semibold">Traveller</th>
                <th className="px-3 py-2 font-semibold">Itinerary</th>
                <th className="px-3 py-2 font-semibold">Ver</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 font-semibold">Sent / viewed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ i, enquiry, traveller, dest }) => (
                <tr key={i.id} onClick={() => onOpen(i.id)} className="cursor-pointer hover:bg-secondary/50">
                  <td className="px-3 py-2.5 font-medium text-foreground">{enquiry?.ref ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <p className="text-foreground">{traveller?.fullName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{userName(db, i.createdBy)}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="inline-flex items-center gap-1 text-foreground">
                      {dest?.emoji} {i.title}
                      {i.generatedByAI && <Sparkles className="h-3 w-3 text-brand-600" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(i.createdAt, "short")}</p>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">v{i.version}</td>
                  <td className="px-3 py-2.5">
                    <ItineraryStatusBadge status={i.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatINR(i.pricing.totalINR, { compact: true })}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {i.sentAt ? formatDate(i.sentAt, "short") : "—"} / {i.viewedAt ? formatDate(i.viewedAt, "short") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ItinerarySheet({ itineraryId, onClose }: { itineraryId: string | null; onClose: () => void }) {
  const db = useDb();
  const it = db.itineraries.find((i) => i.id === itineraryId) ?? null;
  const enquiry = it ? enquiryById(db, it.enquiryId) : undefined;
  const traveller = travellerById(db, enquiry?.travellerId);
  const dest = it ? destinationById(db, it.destinationId) : undefined;
  return (
    <Sheet open={!!it} onClose={onClose} side="right" widthClassName="w-full max-w-2xl" title={it ? `${enquiry?.ref ?? "Itinerary"} · v${it.version}` : undefined}>
      {it && (
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-xs">
            <span>
              {traveller?.fullName ?? "—"} · created by {userName(db, it.createdBy)} {formatDateTime(it.createdAt)}
              {it.sentAt && ` · sent ${formatDate(it.sentAt, "short")}`}
              {it.viewedAt && ` · viewed ${formatDate(it.viewedAt, "short")}`}
            </span>
            {enquiry && (
              <Link href={`/enquiries?enquiry=${enquiry.id}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                Open enquiry <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          {it.changeNote && <p className="text-xs text-muted-foreground">Change note: {it.changeNote}</p>}
          <ItineraryView itinerary={it} destination={dest} />
        </div>
      )}
    </Sheet>
  );
}
