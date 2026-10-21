"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, CalendarDays, Users, CheckCircle2, Circle, Clock, Bot, User as UserIcon, Sparkles } from "lucide-react";
import type { Trip } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { destinationById, enquiryById, logActivity, travellerById, tripById, userName } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { cn, formatDate, formatDateTime, formatINR, paxLabel, addDays, daysUntil, relativeTime } from "@/lib/utils";
import { Button, Card, ScrollableTabs, Select } from "@/components/ui";
import { TripStatusBadge, KV, EmptyState, useToast, SectionTitle } from "@/components/shared";
import { PageHeader } from "@/components/app/page-header";
import { ItineraryView } from "@/components/itineraries/itinerary-view";
import { PaymentSchedule } from "@/components/payments/payment-schedule";
import { DocumentList } from "@/components/documents/document-list";
import { TripActions } from "./trip-actions";
import { TripTravellers } from "./trip-travellers";
import { tripTiming, tripNights } from "@/components/ops/helpers";

type Tab = "overview" | "itinerary" | "travellers" | "payments" | "documents" | "timeline";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "itinerary", label: "Itinerary" },
  { key: "travellers", label: "Travellers" },
  { key: "payments", label: "Payments" },
  { key: "documents", label: "Documents" },
  { key: "timeline", label: "Timeline" },
];

export function TripDetail({ tripId }: { tripId: string }) {
  const db = useDb();
  const me = useCurrentUser();
  const { toast, node } = useToast();
  const [tab, setTab] = React.useState<Tab>("overview");
  const trip = tripById(db, tripId);
  const manage = can(me.role, "trips.manage");

  if (!trip) {
    return (
      <>
        <PageHeader title="Trip not found" />
        <div className="p-4 md:p-6">
          <EmptyState title="This trip doesn't exist" hint="It may have been removed when the demo data was reset." action={<Link href="/trips" className="text-sm font-medium text-brand-700 hover:underline">Back to trips</Link>} />
        </div>
      </>
    );
  }

  const traveller = travellerById(db, trip.travellerId);
  const dest = destinationById(db, trip.destinationId);
  const enquiry = enquiryById(db, trip.enquiryId);
  const itinerary = db.itineraries.find((i) => i.id === trip.itineraryId);
  const timing = tripTiming(trip);
  const captains = db.users.filter((u) => u.active && (u.role === "OPS" || u.role === "MANAGER" || u.role === "ADMIN"));

  function setCaptain(sub: string) {
    mutateDb((d) => {
      const t = tripById(d, tripId);
      if (!t) return;
      t.tripCaptain = sub || undefined;
      logActivity(d, { actor: me.name, actorKind: "user", type: "captain_changed", text: `Trip captain set to ${userName(d, sub)} — ${t.ref}`, tripId: t.id, enquiryId: t.enquiryId, travellerId: t.travellerId });
    });
    toast("Trip captain updated");
  }

  return (
    <>
      {node}
      <PageHeader
        title={trip.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href="/trips" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Trips
            </Link>
            <span>·</span>
            <span className="font-medium text-foreground">{trip.ref}</span>
            <TripStatusBadge status={trip.status} />
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ({tripNights(trip)}N)
            </span>
            <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", timing.tone === "live" ? "bg-brand-100 text-brand-800" : timing.tone === "upcoming" ? "bg-saffron-100 text-saffron-700" : "bg-secondary text-muted-foreground")}>{timing.label}</span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {paxLabel(trip.pax)}
            </span>
            {enquiry && (
              <Link href={`/enquiries?enquiry=${enquiry.id}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                Enquiry {enquiry.ref} <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </span>
        }
      >
        <TripActions trip={trip} onToast={toast} />
      </PageHeader>

      <div className="space-y-4 p-4 md:p-6">
        {/* Summary strip */}
        <Card className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
          <KV label="Lead traveller" value={traveller ? <Link href={`/travellers?traveller=${traveller.id}`} className="font-medium hover:underline">{traveller.fullName}</Link> : "—"} />
          <KV label="Destination" value={`${dest?.emoji ?? ""} ${trip.destination}`} />
          <KV label="Paid / total" value={<span>{formatINR(trip.paidINR, { compact: true })} <span className="text-muted-foreground">/ {formatINR(trip.totalINR, { compact: true })}</span></span>} />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trip captain</div>
            {manage ? (
              <Select value={trip.tripCaptain ?? ""} onChange={(e) => setCaptain(e.target.value)} className="mt-1 h-9 text-sm lg:h-8">
                <option value="">Unassigned</option>
                {captains.map((u) => (
                  <option key={u.sub} value={u.sub}>
                    {u.name}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="mt-0.5 text-sm">{userName(db, trip.tripCaptain)}</div>
            )}
          </div>
        </Card>

        {trip.status === "cancelled" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Cancelled {trip.cancelledAt ? formatDate(trip.cancelledAt) : ""}</p>
            <p className="text-xs">{trip.cancelReason} · refund {formatINR(trip.refundINR ?? 0)}</p>
          </div>
        )}

        <Card className="overflow-hidden">
          <ScrollableTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />
          <div className="p-4">
            {tab === "overview" && <Overview trip={trip} onToast={toast} />}
            {tab === "itinerary" &&
              (itinerary ? (
                <ItineraryView itinerary={itinerary} destination={dest} />
              ) : (
                <EmptyState title="No itinerary linked" hint="The accepted itinerary will show here." />
              ))}
            {tab === "travellers" && <TripTravellers trip={trip} onToast={toast} />}
            {tab === "payments" && <PaymentSchedule tripId={trip.id} />}
            {tab === "documents" && <DocumentList tripId={trip.id} />}
            {tab === "timeline" && <Timeline trip={trip} />}
          </div>
        </Card>
      </div>
    </>
  );
}

function Overview({ trip, onToast }: { trip: Trip; onToast: (m: string) => void }) {
  const me = useCurrentUser();
  const manage = can(me.role, "trips.manage");
  const done = trip.checklist.filter((c) => c.done).length;

  function toggle(key: string) {
    mutateDb((d) => {
      const t = tripById(d, trip.id);
      const item = t?.checklist.find((c) => c.key === key);
      if (!t || !item) return;
      item.done = !item.done;
      item.doneAt = item.done ? nowIso() : undefined;
      if (item.done && key === "passports" && t.status === "docs_pending" && t.checklist.filter((c) => ["passports", "visa"].includes(c.key)).every((c) => c.done)) {
        t.status = "ready";
      }
      logActivity(d, { actor: me.name, actorKind: "user", type: "checklist", text: `${item.done ? "Completed" : "Reopened"} "${item.label}" — ${t.ref}`, tripId: t.id, enquiryId: t.enquiryId, travellerId: t.travellerId });
    });
    onToast("Checklist updated");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <SectionTitle action={<span className="text-xs text-muted-foreground">{done}/{trip.checklist.length} done</span>}>Ops checklist</SectionTitle>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${trip.checklist.length ? (done / trip.checklist.length) * 100 : 0}%` }} />
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {trip.checklist.map((c) => {
            const due = addDays(trip.startDate, c.offsetDays);
            const overdue = !c.done && daysUntil(due) < 0 && trip.status !== "cancelled" && trip.status !== "completed";
            return (
              <li key={c.key} className={cn("flex items-start gap-3 px-3 py-2.5", overdue && "bg-rose-50/60")}>
                <button type="button" disabled={!manage} onClick={() => toggle(c.key)} className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-secondary disabled:cursor-default disabled:hover:bg-transparent" aria-label={c.done ? "Mark not done" : "Mark done"}>
                  {c.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className={cn("h-5 w-5", overdue ? "text-rose-500" : "text-muted-foreground/60")} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", c.done ? "text-muted-foreground line-through" : overdue ? "font-medium text-rose-700" : "text-foreground")}>{c.label}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    <span className={cn(overdue && "font-medium text-rose-600")}>
                      Due {formatDate(due)} ({c.offsetDays === 0 ? "departure day" : c.offsetDays < 0 ? `${-c.offsetDays}d before` : `day ${c.offsetDays + 1}`})
                    </span>
                    {c.done && c.doneAt && <span>· done {formatDate(c.doneAt, "short")}</span>}
                    {c.auto && (
                      <span className="inline-flex items-center gap-0.5 text-brand-700">
                        <Bot className="h-3 w-3" /> automated
                      </span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="space-y-4 lg:col-span-2">
        <Card className="p-4">
          <SectionTitle>Special requests</SectionTitle>
          <p className="text-sm text-muted-foreground">{trip.specialRequests || "None noted."}</p>
        </Card>
        <Card className="p-4">
          <SectionTitle>Cancellation policy</SectionTitle>
          <p className="text-sm text-muted-foreground">{trip.cancellationPolicy}</p>
        </Card>
        <Card className="p-4">
          <SectionTitle>Margin</SectionTitle>
          {me.role === "ADMIN" || me.role === "MANAGER" || me.role === "FINANCE" ? (
            <p className="text-sm">
              <span className="font-semibold text-emerald-700">{formatINR(trip.marginINR)}</span> <span className="text-muted-foreground">({trip.totalINR ? Math.round((trip.marginINR / trip.totalINR) * 100) : 0}% of {formatINR(trip.totalINR)})</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Visible to managers and finance.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Timeline({ trip }: { trip: Trip }) {
  const db = useDb();
  const items = db.activities.filter((a) => a.tripId === trip.id || a.enquiryId === trip.enquiryId).sort((a, b) => b.at.localeCompare(a.at));
  if (items.length === 0) return <EmptyState icon={Clock} title="Nothing logged yet" />;
  return (
    <ol className="relative space-y-3 border-l border-border pl-5">
      {items.map((a) => (
        <li key={a.id} className="relative">
          <span className={cn("absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background", a.actorKind === "ai" ? "bg-brand-100 text-brand-700" : a.actorKind === "system" ? "bg-secondary text-muted-foreground" : "bg-saffron-100 text-saffron-700")}>
            {a.actorKind === "ai" ? <Sparkles className="h-3 w-3" /> : a.actorKind === "system" ? <Bot className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
          </span>
          <p className="text-sm text-foreground">{a.text}</p>
          <p className="text-[11px] text-muted-foreground" title={formatDateTime(a.at)}>
            {a.actor} · {relativeTime(a.at)}
          </p>
        </li>
      ))}
    </ol>
  );
}
