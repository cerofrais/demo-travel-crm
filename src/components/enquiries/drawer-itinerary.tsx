"use client";

import * as React from "react";
import { Check, Copy, Eye, Send, Sparkles, Wand2 } from "lucide-react";
import type { Enquiry, Itinerary, ItineraryStatus } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { destinationById, itinerariesForEnquiry } from "@/lib/demo/queries";
import { itineraryToText } from "@/lib/ai/itinerary";
import { Badge, Button } from "@/components/ui";
import { EmptyState } from "@/components/shared";
import { cn, copyToClipboard, formatDateTime, formatINR } from "@/lib/utils";
import { ItineraryView } from "@/components/itineraries/itinerary-view";
import { ItineraryBuilderDialog } from "@/components/itineraries/itinerary-builder";
import { confirmBooking, sendItinerary, type Actor } from "./booking-actions";

const STATUS_CLASS: Record<ItineraryStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  sent: "bg-sky-100 text-sky-700",
  viewed: "bg-indigo-100 text-indigo-700",
  accepted: "bg-emerald-100 text-emerald-800",
  revised: "bg-amber-100 text-amber-800",
  rejected: "bg-rose-100 text-rose-700",
};

export function ItineraryTab({ enquiry: e, actor, canEdit, onToast }: { enquiry: Enquiry; actor: Actor; canEdit: boolean; onToast: (m: string) => void }) {
  const db = useDb();
  const versions = itinerariesForEnquiry(db, e.id);
  const dest = destinationById(db, e.destinationId);
  const [selectedId, setSelectedId] = React.useState<string | null>(versions[0]?.id ?? null);
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const selected: Itinerary | undefined = versions.find((v) => v.id === selectedId) ?? versions[0];

  React.useEffect(() => {
    if (!versions.some((v) => v.id === selectedId)) setSelectedId(versions[0]?.id ?? null);
  }, [versions, selectedId]);

  function send(it: Itinerary) {
    mutateDb((d) => sendItinerary(d, it.id, actor));
    onToast(`Itinerary v${it.version} sent to traveller`);
  }
  function accept(it: Itinerary) {
    const had = Boolean(e.tripId);
    mutateDb((d) => {
      const x = d.itineraries.find((i) => i.id === it.id);
      if (x) x.status = "accepted";
      for (const other of d.itineraries) if (other.enquiryId === e.id && other.id !== it.id && other.status === "accepted") other.status = "revised";
      confirmBooking(d, e.id, it.id, actor);
    });
    const trip = db.trips.find((t) => t.id === db.enquiries.find((x) => x.id === e.id)?.tripId);
    onToast(had ? `v${it.version} marked accepted` : `Accepted — booking ${trip?.ref ?? ""} created`);
  }
  async function copy(it: Itinerary) {
    const ok = await copyToClipboard(itineraryToText(it));
    onToast(ok ? "Itinerary copied as text" : "Couldn't copy");
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Itinerary versions</h3>
          <p className="text-xs text-muted-foreground">{versions.length ? `${versions.length} version${versions.length === 1 ? "" : "s"} · latest v${versions[0].version}` : "Nothing drafted yet"}</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setBuilderOpen(true)}><Sparkles className="h-4 w-4" />Build with AI</Button>
        )}
      </div>

      {versions.length === 0 ? (
        <EmptyState icon={Wand2} title="No itinerary yet" hint={`Rebuild a ${e.destination} reel package for ${e.nights} nights, ${e.pax.adults + e.pax.children + e.pax.infants} travellers and a ${formatINR(e.budgetINR, { compact: true })} budget.`} action={canEdit ? <Button onClick={() => setBuilderOpen(true)}><Sparkles className="h-4 w-4" />Build with AI</Button> : undefined} />
      ) : (
        <div className="space-y-2">
          {versions.map((v) => {
            const active = v.id === selected?.id;
            return (
              <div key={v.id} className={cn("rounded-lg border p-3 transition-colors", active ? "border-primary bg-brand-50/50" : "border-border bg-card hover:bg-secondary/40")}>
                <button type="button" onClick={() => setSelectedId(v.id)} className="flex w-full items-start justify-between gap-2 text-left">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">v{v.version}</span>
                      <span className="truncate text-sm">{v.title}</span>
                      <Badge className={STATUS_CLASS[v.status]}>{v.status}</Badge>
                      {v.generatedByAI && <Badge className="bg-brand-50 text-brand-700">AI</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {v.nights}N · {formatINR(v.pricing.totalINR)} total ({formatINR(v.pricing.perPersonINR)} pp)
                      {v.sentAt && <> · sent {formatDateTime(v.sentAt)}</>}
                      {v.viewedAt && <> · <Eye className="inline h-3 w-3" /> viewed {formatDateTime(v.viewedAt)}</>}
                    </div>
                    {v.changeNote && <p className="mt-1 text-xs italic text-muted-foreground">“{v.changeNote}”</p>}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-primary">{active ? "Viewing" : "View"}</span>
                </button>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {canEdit && (v.status === "draft" || v.status === "revised") && (
                    <Button size="sm" onClick={() => send(v)}><Send className="h-3.5 w-3.5" />Send to traveller</Button>
                  )}
                  {canEdit && v.status !== "accepted" && v.status !== "rejected" && (
                    <Button size="sm" variant="secondary" onClick={() => accept(v)}><Check className="h-3.5 w-3.5" />Mark accepted</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => copy(v)}><Copy className="h-3.5 w-3.5" />Copy as text</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <ItineraryView itinerary={selected} destination={dest} compact />
        </div>
      )}

      <ItineraryBuilderDialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        enquiryId={e.id}
        onCreated={(id) => {
          setSelectedId(id);
          setBuilderOpen(false);
          onToast("Itinerary drafted — review before sending");
        }}
      />
    </div>
  );
}
