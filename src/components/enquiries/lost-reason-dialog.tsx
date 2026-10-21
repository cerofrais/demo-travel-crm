"use client";

import * as React from "react";
import { Button, Dialog, Select, Textarea } from "@/components/ui";
import { Field } from "@/components/shared";

export const LOST_REASONS = ["No response after follow-ups", "Budget too high", "Booked elsewhere", "Dates didn't work", "Trip postponed", "Visa / passport issue", "Other"];

/** Small confirm dialog asking why an enquiry was lost. */
export function LostReasonDialog({ open, travellerName, onClose, onConfirm }: { open: boolean; travellerName?: string; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = React.useState(LOST_REASONS[0]);
  const [note, setNote] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setReason(LOST_REASONS[0]);
      setNote("");
    }
  }, [open]);
  const final = reason === "Other" ? note.trim() || "Other" : note.trim() ? `${reason} — ${note.trim()}` : reason;
  return (
    <Dialog open={open} onClose={onClose} title={`Mark ${travellerName ?? "enquiry"} as lost`}>
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(final);
        }}
      >
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)} autoFocus>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label={reason === "Other" ? "Tell us more" : "Note (optional)"}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened? Helps the follow-up agent re-engage later." rows={3} />
        </Field>
        <p className="text-xs text-muted-foreground">Open tasks on this enquiry will be cancelled. The traveller stays in the CRM for future campaigns.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="destructive">Mark lost</Button>
        </div>
      </form>
    </Dialog>
  );
}
