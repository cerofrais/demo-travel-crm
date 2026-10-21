"use client";

import * as React from "react";
import { Database, Download, Instagram, Mail, MessageCircle, Phone, RotateCcw, Sheet as SheetIcon, CreditCard, Plug } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Avatar, Badge, Button, Card, Dialog, Input } from "@/components/ui";
import { Field, SectionTitle, Toggle, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { getDb, mutateDb, resetDemoData } from "@/lib/demo/store";
import { ROLE_LABEL, can } from "@/lib/rbac";
import { STAGES } from "@/lib/pipeline";
import { cn, downloadText, formatDateTime } from "@/lib/utils";
import { CompanyCard, HoursSlaCard, PaymentsCard } from "./settings-sections";

const INTEGRATIONS: { name: string; status: string; tone: "ok" | "test" | "warn" | "off"; icon: React.ElementType; detail: string; connect?: boolean }[] = [
  { name: "WhatsApp Business API", status: "Connected · +91 80 4710 0100", tone: "ok", icon: MessageCircle, detail: "Meta Cloud API · templates synced hourly" },
  { name: "Instagram Messaging", status: "Connected · @wishtrip.ai", tone: "ok", icon: Instagram, detail: "Comment & story-reply automations, DM inbox" },
  { name: "Razorpay", status: "Test mode", tone: "test", icon: CreditCard, detail: "Payment links, UPI, cards, EMI · webhooks on" },
  { name: "Telephony (Plivo)", status: "Connected", tone: "ok", icon: Phone, detail: "Aanya inbound/outbound, recordings, transcripts" },
  { name: "Email (support@wishtrip.co)", status: "IMAP polling", tone: "warn", icon: Mail, detail: "Polling every 5 min · OAuth upgrade recommended" },
  { name: "Google Sheets", status: "Not connected", tone: "off", icon: SheetIcon, detail: "Nightly export of enquiries & bookings", connect: true },
];

const TONE: Record<string, string> = { ok: "bg-emerald-100 text-emerald-800", test: "bg-amber-100 text-amber-800", warn: "bg-saffron-100 text-saffron-700", off: "bg-zinc-100 text-zinc-700" };

export function SettingsWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const { toast, node } = useToast();
  const canEdit = can(me.role, "settings.manage");
  const [resetOpen, setResetOpen] = React.useState(false);
  const meUser = db.users.find((u) => u.sub === me.sub);
  const [phone, setPhone] = React.useState(meUser?.phone ?? "");
  React.useEffect(() => setPhone(meUser?.phone ?? ""), [meUser?.phone]);

  const savePhone = () => {
    mutateDb((d) => {
      const u = d.users.find((x) => x.sub === me.sub);
      if (u) u.phone = phone.trim() || undefined;
    });
    toast("Profile saved");
  };
  const setOnline = (v: boolean) => {
    mutateDb((d) => {
      const u = d.users.find((x) => x.sub === me.sub);
      if (u) u.online = v;
    });
    toast(v ? "You're online" : "You're away");
  };
  const exportJson = () => {
    downloadText(`wishtrip-demo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(getDb(), null, 2), "application/json");
    toast("JSON exported");
  };

  const counts: [string, number][] = [
    ["Travellers", db.travellers.length],
    ["Enquiries", db.enquiries.length],
    ["Itineraries", db.itineraries.length],
    ["Trips", db.trips.length],
    ["Payments", db.payments.length],
    ["Messages", db.messages.length],
    ["Calls", db.calls.length],
    ["Tasks", db.tasks.length],
    ["Agent events", db.agentEvents.length],
    ["Activities", db.activities.length],
  ];

  return (
    <>
      <PageHeader title="Settings" subtitle={canEdit ? "Company, SLAs, payments, pipeline and integrations." : "Read-only view — ask an Administrator to change these."} />
      <div className="space-y-6 p-4 md:p-6">
        <Card className="p-4">
          <SectionTitle>My profile</SectionTitle>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex items-center gap-3">
              <Avatar name={me.name} className="h-12 w-12 text-base" />
              <div>
                <div className="font-medium">{me.name || "—"}</div>
                <div className="text-xs text-muted-foreground">{me.email}</div>
                <Badge className="mt-1 bg-brand-100 text-brand-800">{ROLE_LABEL[me.role]}</Badge>
              </div>
            </div>
            <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" disabled={!meUser} />
              </Field>
              <Button variant="secondary" onClick={savePhone} disabled={!meUser || phone === (meUser?.phone ?? "")}>
                Save
              </Button>
              <Toggle checked={meUser?.online ?? false} onChange={setOnline} label={meUser?.online ? "Online — receiving new leads" : "Away"} disabled={!meUser} />
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <CompanyCard value={db.settings.company} canEdit={canEdit} actor={me.name} onSaved={() => toast("Company saved")} />
          <HoursSlaCard value={{ businessHours: db.settings.businessHours, sla: db.settings.sla }} canEdit={canEdit} actor={me.name} onSaved={() => toast("SLA saved")} />
          <PaymentsCard value={db.settings.payment} canEdit={canEdit} actor={me.name} onSaved={() => toast("Payment rules saved")} />

          <Card className="p-4">
            <SectionTitle>Pipeline</SectionTitle>
            <ol className="space-y-1.5">
              {STAGES.map((s) => (
                <li key={s.id} className="flex items-start gap-3 text-sm">
                  <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", s.accent)} />
                  <div>
                    <span className="font-medium">{s.label}</span>
                    {s.won && <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-700">won</span>}
                    {!s.board && <span className="ml-1 rounded bg-zinc-100 px-1 text-[10px] font-semibold text-zinc-600">hidden</span>}
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] text-muted-foreground">Stages are fixed in this demo; production lets admins rename and reorder them.</p>
          </Card>

          <Card className="p-4 xl:col-span-2">
            <SectionTitle>Channels &amp; integrations</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {INTEGRATIONS.map((i) => (
                <div key={i.name} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
                    <i.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{i.name}</div>
                    <Badge className={cn("mt-1", TONE[i.tone])}>{i.status}</Badge>
                    <div className="mt-1 text-xs text-muted-foreground">{i.detail}</div>
                    {i.connect && (
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => toast("Google Sheets connect opens an OAuth window in production")} disabled={!canEdit}>
                        <Plug className="h-3.5 w-3.5" /> Connect
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 xl:col-span-2">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" /> Demo data
              </span>
            </SectionTitle>
            <p className="text-xs text-muted-foreground">Seeded {formatDateTime(db.seededAt)} · stored in this browser only (localStorage). Reset regenerates everything relative to today.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {counts.map(([k, v]) => (
                <div key={k} className="rounded-md bg-secondary/60 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
                  <div className="text-sm font-semibold tabular-nums">{v.toLocaleString("en-IN")}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportJson}>
                <Download className="h-4 w-4" /> Export JSON
              </Button>
              <Button variant="destructive" onClick={() => setResetOpen(true)}>
                <RotateCcw className="h-4 w-4" /> Reset demo data
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} title="Reset demo data?">
        <div className="space-y-3 p-4 text-sm">
          <p>This throws away every change made in this browser and reseeds the demo relative to today. It cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetDemoData();
                setResetOpen(false);
                toast("Demo data reset");
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      </Dialog>
      {node}
    </>
  );
}
