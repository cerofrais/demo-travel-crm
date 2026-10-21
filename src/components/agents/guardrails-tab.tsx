"use client";

import { Ban, CalendarClock, Eye, Lock, MessageSquareWarning, Moon, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";
import { Toggle } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { logActivity } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import type { DemoData } from "@/lib/demo/types";

interface Rail {
  icon: LucideIcon;
  title: string;
  detail: string;
  /** Bound setting, or undefined for a fixed, always-on policy. */
  get?: (db: DemoData) => boolean;
  set?: (db: DemoData, v: boolean) => void;
  invert?: boolean;
}

const RAILS: Rail[] = [
  { icon: Ban, title: "Never quotes refunds or cancellation fees", detail: "Any cancellation, refund or dispute is escalated to the consultant with an urgent callback task. Aanya and Wish only acknowledge and hand off." },
  { icon: ShieldAlert, title: "Never promises availability or a confirmed price", detail: "Replies say \"from ₹X per person\" and \"subject to availability\". Confirmed numbers come from a consultant-sent itinerary." },
  { icon: MessageSquareWarning, title: "Escalates on cancellation, complaint, medical and visa rejection", detail: "Hand-off topics trigger a draft or an escalation, tag the enquiry needs-human and flag it for attention." },
  { icon: CalendarClock, title: "Caps auto replies per thread", detail: "After the configured number of autonomous replies in a thread, Wish drafts instead of sending so a human takes over naturally.", get: (db) => db.settings.agents.autoReply.maxAutoRepliesPerThread > 0, set: (db, v) => { db.settings.agents.autoReply.maxAutoRepliesPerThread = v ? 6 : 0; } },
  { icon: Moon, title: "Respects quiet hours", detail: "Outside the window, chat replies are limited to an acknowledgement and consultants are not pinged until morning.", get: (db) => db.settings.agents.autoReply.quietHours != null, set: (db, v) => { db.settings.agents.autoReply.quietHours = v ? { start: "22:00", end: "08:00" } : null; } },
  { icon: Eye, title: "Human review of AI itineraries before sending", detail: "Itineraries the agent builds stay in draft until a consultant approves them in the review queue.", get: (db) => db.settings.agents.itinerary.requireReview, set: (db, v) => { db.settings.agents.itinerary.requireReview = v; } },
  { icon: Lock, title: "Payment links only from consultants", detail: "When off, Wish never pastes a payment link — it tells the traveller the consultant will send one.", get: (db) => !db.settings.agents.autoReply.allowPaymentLinks, set: (db, v) => { db.settings.agents.autoReply.allowPaymentLinks = !v; } },
  { icon: ShieldCheck, title: "Itinerary drafts from chat allowed", detail: "Wish may draft a first itinerary from a trip brief (still subject to review) instead of waiting for a consultant.", get: (db) => db.settings.agents.autoReply.allowItineraryDraft, set: (db, v) => { db.settings.agents.autoReply.allowItineraryDraft = v; } },
  { icon: Lock, title: "PII handling: passports masked in chat summaries", detail: "Passport numbers appear as ••••1234 in summaries, call transcripts and agent events. Full numbers live only in the document vault." },
];

export function GuardrailsTab() {
  const db = useDb();
  const user = useCurrentUser();
  const canConfigure = can(user.role, "agents.configure");
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Policies the agents operate under. Fixed rails are enforced in the prompt and the tool layer; the toggleable ones map to settings.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {RAILS.map((r) => {
          const Icon = r.icon;
          const bound = Boolean(r.get && r.set);
          const on = r.get ? r.get(db) : true;
          return (
            <Card key={r.title} className="flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold">{r.title}</div>
                  <Toggle
                    checked={on}
                    disabled={!bound || !canConfigure}
                    onChange={(v) => {
                      if (!r.set) return;
                      mutateDb((d) => {
                        r.set!(d, v);
                        logActivity(d, { actor: user.name, actorKind: "user", type: "settings_changed", text: `${v ? "Enabled" : "Disabled"} guardrail: ${r.title}` });
                      });
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>
                {!bound && <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-emerald-700">Always on</p>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
