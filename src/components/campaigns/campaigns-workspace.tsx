"use client";

import * as React from "react";
import { CalendarClock, Instagram, Megaphone, Plus, Sparkles, Trophy } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button, Card, ScrollableTabs } from "@/components/ui";
import { EmptyState, StatCard, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { CHANNEL_LABEL } from "@/lib/pipeline";
import { WON_STAGES } from "@/lib/pipeline";
import type { Campaign } from "@/lib/demo/types";
import { CampaignCard } from "./campaign-card";
import { NewCampaignDialog } from "./new-campaign-dialog";
import { simulateSend } from "./campaign-helpers";

type Tab = "all" | "instagram" | "broadcast" | "drip";

export function CampaignsWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const { toast, node } = useToast();
  const canManage = can(me.role, "campaigns.manage");
  const [tab, setTab] = React.useState<Tab>("all");
  const [newOpen, setNewOpen] = React.useState(false);

  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const campaignLeads30d = db.enquiries.filter((e) => e.campaign && new Date(e.createdAt).getTime() >= thirtyDaysAgo).length;
  const bookingsAttributed = db.enquiries.filter((e) => e.campaign && WON_STAGES.includes(e.stage)).length;
  const byChannel = db.campaigns.reduce<Record<string, number>>((acc, c) => {
    acc[c.channel] = (acc[c.channel] ?? 0) + c.stats.leadsCreated;
    return acc;
  }, {});
  const best = Object.entries(byChannel).sort((a, b) => b[1] - a[1])[0];
  const scheduled = db.campaigns.filter((c) => c.status === "scheduled").length;

  const visible = db.campaigns.filter((c) => {
    if (tab === "instagram") return c.type === "comment_automation" || c.type === "story_reply";
    if (tab === "broadcast") return c.type === "broadcast";
    if (tab === "drip") return c.type === "drip";
    return true;
  });

  const toggle = (c: Campaign) => {
    mutateDb((d) => {
      const x = d.campaigns.find((k) => k.id === c.id);
      if (!x) return;
      if (x.status === "running") x.status = "paused";
      else {
        x.status = "running";
        x.startedAt = x.startedAt ?? nowIso();
      }
      logActivity(d, { actor: me.name, actorKind: "user", type: "campaign", text: `${x.status === "running" ? "Resumed" : "Paused"} campaign "${x.name}"` });
    });
    toast(c.status === "running" ? "Campaign paused" : "Campaign running");
  };
  const duplicate = (c: Campaign) => {
    mutateDb((d) => {
      d.campaigns.unshift({ ...c, id: newId("cmp"), name: `${c.name} (copy)`, status: "draft", scheduledAt: undefined, startedAt: undefined, completedAt: undefined, stats: { sent: 0, delivered: 0, read: 0, replied: 0, leadsCreated: 0, bookings: 0 }, createdBy: me.sub, createdAt: nowIso(), audience: { ...c.audience } });
    });
    toast("Duplicated as draft");
  };
  const remove = (c: Campaign) => {
    mutateDb((d) => {
      d.campaigns = d.campaigns.filter((k) => k.id !== c.id);
      logActivity(d, { actor: me.name, actorKind: "user", type: "campaign", text: `Deleted campaign "${c.name}"` });
    });
    toast("Campaign deleted");
  };
  const sendNow = (c: Campaign) => {
    mutateDb((d) => {
      const x = d.campaigns.find((k) => k.id === c.id);
      if (!x) return;
      x.status = "completed";
      x.startedAt = nowIso();
      x.completedAt = nowIso();
      x.stats = simulateSend(x.audience.count);
      logActivity(d, { actor: me.name, actorKind: "user", type: "campaign", text: `Sent "${x.name}" to ${x.audience.count.toLocaleString("en-IN")} travellers on ${CHANNEL_LABEL[x.channel]}` });
    });
    toast(`Sent to ${c.audience.count.toLocaleString("en-IN")} travellers`);
  };

  return (
    <>
      <PageHeader title="Campaigns & automations" subtitle="Instagram comment automations, WhatsApp broadcasts and drips that feed the pipeline.">
        {canManage && (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New campaign
          </Button>
        )}
      </PageHeader>
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Leads from campaigns · 30d" value={campaignLeads30d} icon={Sparkles} hint="Enquiries carrying a campaign tag" />
          <StatCard label="Bookings attributed" value={bookingsAttributed} icon={Trophy} tint="text-emerald-500" hint={`${db.campaigns.reduce((s, c) => s + c.stats.bookings, 0)} reported by campaign stats`} />
          <StatCard label="Best channel" value={best ? CHANNEL_LABEL[best[0] as keyof typeof CHANNEL_LABEL] : "—"} icon={Instagram} tint="text-pink-500" hint={best ? `${best[1]} leads created` : undefined} />
          <StatCard label="Scheduled" value={scheduled} icon={CalendarClock} tint="text-amber-500" />
        </div>

        <ScrollableTabs
          tabs={[
            { key: "all", label: `All (${db.campaigns.length})` },
            { key: "instagram", label: "Instagram automations" },
            { key: "broadcast", label: "WhatsApp broadcasts" },
            { key: "drip", label: "Drips" },
          ]}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
        />

        {visible.length === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns here yet" hint="Create a broadcast or turn on a comment automation." action={canManage ? <Button onClick={() => setNewOpen(true)}>New campaign</Button> : undefined} />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {visible.map((c) => (
              <CampaignCard key={c.id} c={c} db={db} canManage={canManage} onToggle={toggle} onDuplicate={duplicate} onDelete={remove} onSendNow={sendNow} />
            ))}
          </div>
        )}

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pink-100 text-pink-700">
              <Instagram className="h-5 w-5" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-foreground">How &ldquo;comment PLAN&rdquo; works</p>
              <ol className="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <li className="rounded-lg bg-secondary/60 p-3"><span className="font-semibold text-foreground">1 · Comment.</span> A viewer comments <span className="font-mono">PLAN</span> on any @wishtrip.ai reel.</li>
                <li className="rounded-lg bg-secondary/60 p-3"><span className="font-semibold text-foreground">2 · DM in seconds.</span> Wish replies in the DM with three questions: dates, who&apos;s travelling, budget per person.</li>
                <li className="rounded-lg bg-secondary/60 p-3"><span className="font-semibold text-foreground">3 · Enquiry created.</span> A WT-ref enquiry lands on the board tagged <span className="font-mono">ig-plan</span>, scored and auto-assigned.</li>
                <li className="rounded-lg bg-secondary/60 p-3"><span className="font-semibold text-foreground">4 · Itinerary.</span> The reel&apos;s package is rebuilt for their dates and sent on WhatsApp within the {db.settings.sla.itineraryHours}h SLA.</li>
              </ol>
            </div>
          </div>
        </Card>
      </div>
      <NewCampaignDialog open={newOpen} onClose={() => setNewOpen(false)} db={db} me={me} onCreated={() => toast("Campaign created")} />
      {node}
    </>
  );
}
