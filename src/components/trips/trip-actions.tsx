"use client";

import * as React from "react";
import { Send, MessageSquareHeart, PlaneLanding, Star, Ban } from "lucide-react";
import type { Trip } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { enquiryById, logActivity, travellerById, tripById, destinationById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { daysUntil, formatDate, formatINR } from "@/lib/utils";
import { Button, Dialog, Textarea } from "@/components/ui";
import { Field } from "@/components/shared";
import { fillTemplate, firstName, templateBody } from "@/components/ops/helpers";

/** Action buttons for the trip detail header: traveller touchpoints + cancellation. */
export function TripActions({ trip, onToast }: { trip: Trip; onToast: (m: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const manage = can(me.role, "trips.manage");
  const canSend = can(me.role, "messaging.send");
  if (trip.status === "cancelled") return null;

  const checklistDone = (key: string) => trip.checklist.find((c) => c.key === key)?.done ?? false;

  function sendMessage(opts: { templateId: string; body: string; attachmentName?: string; checklistKey?: string; activityType: string; activityText: string }) {
    mutateDb((d) => {
      const t = tripById(d, trip.id);
      if (!t) return;
      d.messages.push({
        id: newId("msg"),
        travellerId: t.travellerId,
        enquiryId: t.enquiryId,
        channel: "whatsapp",
        direction: "outbound",
        body: opts.body,
        at: nowIso(),
        sentBy: me.sub || "system",
        status: "sent",
        templateId: opts.templateId,
        attachmentName: opts.attachmentName,
      });
      const tpl = d.templates.find((x) => x.id === opts.templateId);
      if (tpl) tpl.usageCount += 1;
      if (opts.checklistKey) {
        const item = t.checklist.find((c) => c.key === opts.checklistKey);
        if (item && !item.done) {
          item.done = true;
          item.doneAt = nowIso();
        }
      }
      logActivity(d, { actor: me.name, actorKind: "user", type: opts.activityType, text: opts.activityText, tripId: t.id, enquiryId: t.enquiryId, travellerId: t.travellerId });
    });
  }

  const traveller = travellerById(db, trip.travellerId);
  const dest = destinationById(db, trip.destinationId);
  const itin = db.itineraries.find((i) => i.id === trip.itineraryId);
  const first = firstName(traveller?.fullName);

  function sendVouchers() {
    const stays = itin?.stays.length ?? 0;
    const attachmentName = `${trip.ref}_vouchers.pdf`;
    sendMessage({
      templateId: "tpl_booking_confirmed",
      body: `Hi ${first}, your ${trip.destination} vouchers are here 🎉 ${stays} stay voucher${stays === 1 ? "" : "s"}${itin?.flights.length ? " + e-tickets" : ""} attached for ${trip.ref} (${formatDate(trip.startDate, "short")}–${formatDate(trip.endDate, "short")}). Keep this chat handy — your trip captain is one message away.`,
      attachmentName,
      checklistKey: "vouchers",
      activityType: "vouchers_sent",
      activityText: `Sent ${stays} hotel voucher${stays === 1 ? "" : "s"} on WhatsApp — ${trip.ref}`,
    });
    mutateDb((d) => {
      if (d.documents.some((x) => x.tripId === trip.id && x.category === "voucher")) return;
      d.documents.push({
        id: newId("doc"),
        tripId: trip.id,
        enquiryId: trip.enquiryId,
        travellerId: trip.travellerId,
        category: "voucher",
        name: `Hotel vouchers (${stays})`,
        fileName: attachmentName,
        sizeKB: 240 + stays * 60,
        uploadedAt: nowIso(),
        uploadedBy: me.name || "Ops",
        verified: true,
      });
    });
    onToast("Vouchers sent on WhatsApp");
  }

  function preDeparture() {
    const body = fillTemplate(templateBody(db, "tpl_predeparture", "Tomorrow's the day, {{first_name}} ✈️ Vouchers + tickets are in this chat. Local contact: {{local_contact}}. Weather: {{weather}}. Packing tip: {{tip}}."), {
      first_name: first,
      local_contact: dest?.region === "international" ? "+91 80 4710 0100 (24×7 wishtrip desk)" : "Trip captain on this chat, 24×7",
      weather: dest?.region === "international" ? "Pleasant, 24–30°C" : "Clear mornings, light evening breeze",
      tip: dest?.id === "ladakh" || dest?.id === "kashmir" || dest?.id === "dharamshala" ? "Layers + a warm jacket for evenings" : "Light cottons, sunscreen and a hat",
    });
    sendMessage({ templateId: "tpl_predeparture", body, checklistKey: "predeparture", activityType: "predeparture_sent", activityText: `Pre-departure message sent — ${trip.ref}` });
    onToast("Pre-departure message sent");
  }

  function midTrip() {
    const body = fillTemplate(templateBody(db, "tpl_midtrip", "Hi {{first_name}}, how's {{destination}} treating you? Anything we can fix or add for the next days? 🙂"), { first_name: first, destination: trip.destination });
    sendMessage({ templateId: "tpl_midtrip", body, checklistKey: "midtrip", activityType: "midtrip_checkin", activityText: `Mid-trip check-in sent — ${trip.ref}` });
    onToast("Mid-trip check-in sent");
  }

  function requestReview() {
    let code = traveller?.referralCode;
    mutateDb((d) => {
      const trav = travellerById(d, trip.travellerId);
      if (trav && !trav.referralCode) {
        code = `${trav.fullName.split(" ")[0].toUpperCase().slice(0, 5)}${10 + Math.floor(Math.random() * 90)}`;
        trav.referralCode = code;
        d.referrals.push({ id: newId("ref"), code, travellerId: trav.id, discountPct: 5, uses: 0, maxUses: 10, active: true, referredEnquiryIds: [], createdAt: nowIso() });
      }
      if (!d.reviews.some((r) => r.tripId === trip.id)) {
        d.reviews.push({ id: newId("rev"), tripId: trip.id, travellerId: trip.travellerId, rating: 0, platform: "internal", status: "requested", at: nowIso() });
      }
      d.agentEvents.unshift({ id: newId("evt"), agent: "followup", at: nowIso(), enquiryId: trip.enquiryId, tripId: trip.id, travellerId: trip.travellerId, action: "Review + referral request sent", detail: "Awaiting rating — 4★+ routes to Google/Instagram, below routes to a resolution task", confidence: 1, status: "auto" });
    });
    const body = fillTemplate(templateBody(db, "tpl_review", "Welcome home, {{first_name}}! How was {{destination}}? Rate us 1–5 here and we'll send your referral code {{code}}."), { first_name: first, destination: trip.destination, code: code ?? "WISH5" });
    sendMessage({ templateId: "tpl_review", body, checklistKey: "review", activityType: "review_requested", activityText: `Review & referral request sent — ${trip.ref}` });
    onToast("Review request sent");
  }

  const live = trip.status === "on_trip";
  const past = trip.status === "completed";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canSend && !past && (
        <>
          <Button size="sm" variant={checklistDone("vouchers") ? "outline" : "primary"} onClick={sendVouchers} title="Send hotel vouchers & tickets on WhatsApp">
            <Send className="h-4 w-4" /> {checklistDone("vouchers") ? "Resend vouchers" : "Send vouchers"}
          </Button>
          {!live && (
            <Button size="sm" variant="outline" onClick={preDeparture}>
              <PlaneLanding className="h-4 w-4" /> Pre-departure
            </Button>
          )}
          {live && (
            <Button size="sm" variant="outline" onClick={midTrip}>
              <MessageSquareHeart className="h-4 w-4" /> Mid-trip check-in
            </Button>
          )}
        </>
      )}
      {canSend && (past || live) && (
        <Button size="sm" variant="outline" onClick={requestReview}>
          <Star className="h-4 w-4" /> Request review
        </Button>
      )}
      {manage && !past && !live && (
        <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setCancelOpen(true)}>
          <Ban className="h-4 w-4" /> Cancel trip
        </Button>
      )}
      <CancelTripDialog trip={trip} open={cancelOpen} onClose={() => setCancelOpen(false)} onDone={onToast} />
    </div>
  );
}

export function cancellationQuote(trip: Trip, slabs: { minDaysBefore: number; feePct: number }[]): { days: number; feePct: number; feeINR: number; refundINR: number } {
  const days = daysUntil(trip.startDate);
  const sorted = [...slabs].sort((a, b) => b.minDaysBefore - a.minDaysBefore);
  const slab = sorted.find((s) => days >= s.minDaysBefore) ?? sorted[sorted.length - 1];
  const feePct = slab?.feePct ?? 100;
  const feeINR = Math.round((trip.totalINR * feePct) / 100);
  const refundINR = Math.max(0, trip.paidINR - feeINR);
  return { days, feePct, feeINR, refundINR };
}

function CancelTripDialog({ trip, open, onClose, onDone }: { trip: Trip; open: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const [reason, setReason] = React.useState("");
  const quote = cancellationQuote(trip, db.settings.payment.cancellationSlabs);

  function confirm() {
    mutateDb((d) => {
      const t = tripById(d, trip.id);
      if (!t) return;
      t.status = "cancelled";
      t.cancelledAt = nowIso();
      t.cancelReason = reason.trim() || "Traveller cancelled";
      t.refundINR = quote.refundINR;
      const enq = enquiryById(d, t.enquiryId);
      if (enq) {
        enq.stage = "lost";
        enq.lostReason = `Trip cancelled — ${t.cancelReason}`;
        enq.lastStageChangeAt = nowIso();
        enq.updatedAt = nowIso();
      }
      d.payments.forEach((p) => {
        if (p.tripId === t.id && (p.status === "pending" || p.status === "overdue")) p.status = "failed";
      });
      d.tasks.forEach((x) => {
        if (x.tripId === t.id && x.status === "open") x.status = "cancelled";
      });
      if (quote.refundINR > 0) {
        d.tasks.push({ id: newId("task"), title: `Process refund ${formatINR(quote.refundINR)} — ${t.ref}`, kind: "approval", tripId: t.id, enquiryId: t.enquiryId, travellerId: t.travellerId, assignedTo: "u_vikram", dueAt: new Date(Date.now() + 3 * 86400000).toISOString(), status: "open", priority: "high", createdBy: me.sub || "system", createdAt: nowIso(), approval: { kind: "refund", payload: `${t.ref}: refund ${formatINR(quote.refundINR)} after ${quote.feePct}% cancellation fee` } });
      }
      logActivity(d, { actor: me.name, actorKind: "user", type: "trip_cancelled", text: `Cancelled ${t.ref} (${quote.days} days before departure) — fee ${quote.feePct}%, refund ${formatINR(quote.refundINR)}. Reason: ${t.cancelReason}`, tripId: t.id, enquiryId: t.enquiryId, travellerId: t.travellerId });
    });
    onClose();
    onDone("Trip cancelled");
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Cancel ${trip.ref}?`}>
      <div className="space-y-3 p-4">
        <div className="rounded-lg bg-secondary p-3 text-sm">
          <p className="text-muted-foreground">
            {quote.days >= 0 ? `${quote.days} days before departure` : "Departure already passed"} → cancellation fee <span className="font-semibold text-foreground">{quote.feePct}%</span> of {formatINR(trip.totalINR)}
          </p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Paid so far</dt>
              <dd className="font-semibold">{formatINR(trip.paidINR)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fee</dt>
              <dd className="font-semibold text-rose-600">{formatINR(quote.feeINR)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Refund due</dt>
              <dd className="font-semibold text-emerald-700">{formatINR(quote.refundINR)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">{trip.cancellationPolicy}</p>
        </div>
        <Field label="Reason">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Traveller's leave got cancelled / medical / dates clash…" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Keep trip
          </Button>
          <Button variant="destructive" onClick={confirm}>
            Cancel trip & mark lost
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
