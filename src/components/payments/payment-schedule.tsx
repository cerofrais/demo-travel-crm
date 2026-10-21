"use client";

import * as React from "react";
import { CheckCircle2, Bell, Link2, Undo2, Plus, FileText } from "lucide-react";
import type { Payment, PaymentMode } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { enquiryById, logActivity, paymentsForTrip, travellerById, tripById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { cn, copyToClipboard, formatDate, formatINR, toDateInput } from "@/lib/utils";
import { Button, Card, Dialog, Input, Select } from "@/components/ui";
import { Field, PaymentStatusBadge, useToast } from "@/components/shared";
import { fillTemplate, firstName, INVOICE_PREFIX, nextSerial, PAYMENT_MODE_LABEL, RECEIPT_PREFIX, templateBody } from "@/components/ops/helpers";

const MODES: PaymentMode[] = ["upi", "razorpay_link", "bank_transfer", "card", "cash"];

/** Effective status: pending instalments past due are shown as overdue. */
export function effectiveStatus(p: Payment, now = new Date()): Payment["status"] {
  if (p.status === "pending" && new Date(p.dueAt).getTime() < now.getTime()) return "overdue";
  return p.status;
}

// ---------------------------------------------------------------------------
// Row actions (shared by the trip payment schedule and the Payments page)
// ---------------------------------------------------------------------------

export function PaymentRowActions({ payment, onToast, compact = false }: { payment: Payment; onToast?: (msg: string) => void; compact?: boolean }) {
  const db = useDb();
  const me = useCurrentUser();
  const [markOpen, setMarkOpen] = React.useState(false);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [mode, setMode] = React.useState<PaymentMode>("upi");
  const [reference, setReference] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(toDateInput(new Date()));
  const [refundAmt, setRefundAmt] = React.useState(payment.amountINR);
  const allowed = can(me.role, "payments.manage");
  const say = (m: string) => onToast?.(m);
  const status = effectiveStatus(payment);

  if (!allowed) return null;

  function markPaid() {
    mutateDb((d) => {
      const p = d.payments.find((x) => x.id === payment.id);
      if (!p) return;
      const trip = tripById(d, p.tripId);
      const traveller = travellerById(d, p.travellerId);
      p.status = "paid";
      p.mode = mode;
      p.reference = reference.trim() || `${mode.toUpperCase()}${Date.now().toString().slice(-8)}`;
      p.paidAt = paidAt ? new Date(`${paidAt}T12:00:00`).toISOString() : nowIso();
      p.invoiceNo = p.invoiceNo ?? nextSerial(d.payments.map((x) => x.invoiceNo), INVOICE_PREFIX);
      p.receiptNo = nextSerial(d.payments.map((x) => x.receiptNo), RECEIPT_PREFIX);
      if (trip) {
        const tripPays = paymentsForTrip(d, trip.id);
        trip.paidINR = tripPays.filter((x) => x.status === "paid").reduce((s, x) => s + x.amountINR, 0);
        const allPaid = tripPays.every((x) => x.status === "paid" || x.status === "refunded");
        if (allPaid) {
          const bal = trip.checklist.find((c) => c.key === "balance");
          if (bal && !bal.done) {
            bal.done = true;
            bal.doneAt = nowIso();
          }
          const enq = enquiryById(d, trip.enquiryId);
          if (enq && (enq.stage === "docs_visa" || enq.stage === "advance_paid")) {
            enq.stage = "ready";
            enq.lastStageChangeAt = nowIso();
            enq.updatedAt = nowIso();
            enq.tags = enq.tags.filter((t) => t !== "balance-due");
            if (trip.status === "confirmed" || trip.status === "docs_pending") trip.status = "ready";
          }
        }
        d.tasks.forEach((t) => {
          if (t.tripId === trip.id && t.kind === "payment_reminder" && t.status === "open") {
            t.status = "done";
            t.doneAt = nowIso();
          }
        });
      }
      logActivity(d, {
        actor: me.name,
        actorKind: "user",
        type: "payment_received",
        text: `${p.label} ${formatINR(p.amountINR)} marked paid via ${PAYMENT_MODE_LABEL[mode]} (${p.reference}) — ${trip?.ref ?? ""} · ${traveller?.fullName ?? ""}`,
        tripId: p.tripId,
        travellerId: p.travellerId,
        enquiryId: trip?.enquiryId,
      });
    });
    setMarkOpen(false);
    say(`${payment.label} marked paid`);
  }

  function sendReminder() {
    mutateDb((d) => {
      const p = d.payments.find((x) => x.id === payment.id);
      if (!p) return;
      const trip = tripById(d, p.tripId);
      const traveller = travellerById(d, p.travellerId);
      p.reminderCount += 1;
      p.lastReminderAt = nowIso();
      const body = fillTemplate(templateBody(d, "tpl_payment_reminder", "Hi {{first_name}}, a reminder: ₹{{amount}} for your {{destination}} trip ({{ref}}) is due on {{due_date}}. Pay here: {{pay_link}}."), {
        first_name: firstName(traveller?.fullName),
        amount: p.amountINR.toLocaleString("en-IN"),
        destination: trip?.destination,
        ref: trip?.ref,
        due_date: formatDate(p.dueAt),
        pay_link: p.linkUrl ?? "https://rzp.io/l/wishtrip",
      });
      d.messages.push({
        id: newId("msg"),
        travellerId: p.travellerId,
        enquiryId: trip?.enquiryId,
        channel: "whatsapp",
        direction: "outbound",
        body,
        at: nowIso(),
        sentBy: me.sub || "ai",
        status: "sent",
        templateId: "tpl_payment_reminder",
      });
      const tpl = d.templates.find((t) => t.id === "tpl_payment_reminder");
      if (tpl) tpl.usageCount += 1;
      d.agentEvents.unshift({
        id: newId("evt"),
        agent: "followup",
        at: nowIso(),
        enquiryId: trip?.enquiryId,
        tripId: p.tripId,
        travellerId: p.travellerId,
        action: "Payment reminder sent",
        detail: `${p.label} ${formatINR(p.amountINR)} — reminder #${p.reminderCount} on WhatsApp with Pay Now link`,
        confidence: 1,
        status: "auto",
      });
      logActivity(d, {
        actor: me.name,
        actorKind: "user",
        type: "payment_reminder",
        text: `Sent ${p.label.toLowerCase()} reminder (#${p.reminderCount}) to ${traveller?.fullName ?? "traveller"} — ${trip?.ref ?? ""}`,
        tripId: p.tripId,
        travellerId: p.travellerId,
        enquiryId: trip?.enquiryId,
      });
    });
    say("Reminder sent on WhatsApp");
  }

  async function copyLink() {
    const ok = await copyToClipboard(payment.linkUrl ?? "https://rzp.io/l/wishtrip");
    say(ok ? "Payment link copied" : "Could not copy link");
  }

  function refund() {
    const amt = Math.max(0, Math.min(payment.amountINR, refundAmt));
    mutateDb((d) => {
      const p = d.payments.find((x) => x.id === payment.id);
      if (!p) return;
      const trip = tripById(d, p.tripId);
      p.status = "refunded";
      p.reference = `${p.reference ?? ""} · refund ${formatINR(amt)}`.trim();
      if (trip) {
        trip.refundINR = (trip.refundINR ?? 0) + amt;
        trip.paidINR = Math.max(0, trip.paidINR - amt);
      }
      logActivity(d, {
        actor: me.name,
        actorKind: "user",
        type: "payment_refunded",
        text: `Refunded ${formatINR(amt)} on ${p.label.toLowerCase()} — ${trip?.ref ?? ""}`,
        tripId: p.tripId,
        travellerId: p.travellerId,
        enquiryId: trip?.enquiryId,
      });
    });
    setRefundOpen(false);
    say(`Refund of ${formatINR(amt)} recorded`);
  }

  const btn = compact ? "icon" : "sm";
  const label = (text: string) => (compact ? null : text);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {(status === "pending" || status === "overdue" || status === "failed") && (
        <>
          <Button size={btn} variant="primary" onClick={() => setMarkOpen(true)} title="Mark paid">
            <CheckCircle2 className="h-4 w-4" /> {label("Mark paid")}
          </Button>
          <Button size={btn} variant="outline" onClick={sendReminder} title="Send reminder">
            <Bell className="h-4 w-4" /> {label("Remind")}
          </Button>
          <Button size={btn} variant="ghost" onClick={copyLink} title="Copy payment link">
            <Link2 className="h-4 w-4" /> {label("Copy link")}
          </Button>
        </>
      )}
      {status === "paid" && (
        <Button size={btn} variant="ghost" onClick={() => setRefundOpen(true)} title="Refund">
          <Undo2 className="h-4 w-4" /> {label("Refund")}
        </Button>
      )}

      <Dialog open={markOpen} onClose={() => setMarkOpen(false)} title={`Mark paid · ${payment.label}`}>
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Recording {formatINR(payment.amountINR)}. An invoice and receipt number will be generated.
          </p>
          <Field label="Payment mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference / UTR" hint="Leave blank to auto-generate">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI123456789" />
          </Field>
          <Field label="Paid on">
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setMarkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={markPaid}>Confirm payment</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={refundOpen} onClose={() => setRefundOpen(false)} title={`Refund · ${payment.label}`}>
        <div className="space-y-3 p-4">
          <Field label="Refund amount (₹)" hint={`Paid ${formatINR(payment.amountINR)}${payment.mode ? ` via ${PAYMENT_MODE_LABEL[payment.mode]}` : ""}`}>
            <Input type="number" min={0} max={payment.amountINR} value={refundAmt} onChange={(e) => setRefundAmt(Number(e.target.value))} />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={refund}>
              Record refund
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add instalment
// ---------------------------------------------------------------------------

function AddInstalment({ tripId, onDone }: { tripId: string; onDone: (msg: string) => void }) {
  const me = useCurrentUser();
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState("Extra instalment");
  const [amount, setAmount] = React.useState(10000);
  const [due, setDue] = React.useState(toDateInput(new Date(Date.now() + 7 * 86400000)));

  function add() {
    mutateDb((d) => {
      const trip = tripById(d, tripId);
      if (!trip) return;
      const n = d.payments.filter((p) => p.tripId === tripId).length + 1;
      d.payments.push({
        id: newId("pay"),
        tripId,
        travellerId: trip.travellerId,
        label: label.trim() || `Instalment ${n}`,
        amountINR: Math.max(0, amount),
        dueAt: due ? new Date(`${due}T10:00:00`).toISOString() : nowIso(),
        status: "pending",
        linkUrl: `https://rzp.io/l/wt-${trip.ref.toLowerCase()}-${n}`,
        reminderCount: 0,
      });
      logActivity(d, { actor: me.name, actorKind: "user", type: "payment_added", text: `Added instalment "${label}" ${formatINR(amount)} due ${formatDate(due)} — ${trip.ref}`, tripId, travellerId: trip.travellerId, enquiryId: trip.enquiryId });
    });
    setOpen(false);
    onDone("Instalment added");
  }

  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add instalment
      </Button>
    );
  return (
    <div className="grid w-full gap-2 rounded-lg border border-border bg-secondary/50 p-3 sm:grid-cols-[1fr_140px_160px_auto] sm:items-end">
      <Field label="Label">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field label="Amount ₹">
        <Input type="number" min={0} step={500} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </Field>
      <Field label="Due">
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button size="md" onClick={add}>
          Add
        </Button>
        <Button size="md" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment schedule (contract component)
// ---------------------------------------------------------------------------

export function PaymentSchedule({ tripId, compact = false }: { tripId: string; compact?: boolean }) {
  const db = useDb();
  const me = useCurrentUser();
  const { toast, node } = useToast();
  const trip = tripById(db, tripId);
  const payments = paymentsForTrip(db, tripId);
  const manage = can(me.role, "payments.manage");
  if (!trip) return <p className="text-sm text-muted-foreground">Trip not found.</p>;

  const paid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amountINR, 0);
  const total = trip.totalINR || payments.reduce((s, p) => s + p.amountINR, 0);
  const pct = total ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const outstanding = Math.max(0, total - paid);

  return (
    <div className="space-y-3">
      {node}
      <div>
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="font-medium text-foreground">
            {formatINR(paid)} <span className="text-muted-foreground">of {formatINR(total)} collected</span>
          </span>
          <span className={cn("text-xs font-medium", outstanding > 0 ? "text-amber-700" : "text-emerald-700")}>{outstanding > 0 ? `${formatINR(outstanding)} outstanding` : "Fully paid"}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : "bg-brand-500")} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {payments.map((p) => {
          const status = effectiveStatus(p);
          return (
            <Card key={p.id} className={cn("p-3", status === "overdue" && "border-rose-200")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                    <PaymentStatusBadge status={status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(p.dueAt)}
                    {p.reminderCount > 0 && ` · ${p.reminderCount} reminder${p.reminderCount === 1 ? "" : "s"}`}
                    {p.lastReminderAt && ` (last ${formatDate(p.lastReminderAt, "short")})`}
                  </p>
                  {!compact && p.status === "paid" && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Paid {formatDate(p.paidAt)} {p.mode && `· ${PAYMENT_MODE_LABEL[p.mode]}`} {p.reference && `· ${p.reference}`}
                    </p>
                  )}
                  {!compact && (p.invoiceNo || p.receiptNo) && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <FileText className="h-3 w-3" /> {[p.invoiceNo, p.receiptNo].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <p className="text-base font-semibold tabular-nums text-foreground">{formatINR(p.amountINR)}</p>
              </div>
              {manage && (
                <div className="mt-2">
                  <PaymentRowActions payment={p} onToast={toast} compact={compact} />
                </div>
              )}
            </Card>
          );
        })}
        {payments.length === 0 && <p className="text-sm text-muted-foreground">No instalments scheduled.</p>}
      </div>
      {manage && !compact && trip.status !== "cancelled" && <AddInstalment tripId={tripId} onDone={toast} />}
    </div>
  );
}
