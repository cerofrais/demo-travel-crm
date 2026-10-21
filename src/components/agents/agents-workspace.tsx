"use client";

import * as React from "react";
import { Activity, Bot, BrainCircuit, ClipboardCheck, Map, MessageSquareText, PhoneCall, ShieldCheck, type LucideIcon } from "lucide-react";
import { Card, ScrollableTabs } from "@/components/ui";
import { Toggle, useToast } from "@/components/shared";
import { PageHeader } from "@/components/app/page-header";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { logActivity } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import type { DemoData } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { ReviewQueue } from "./review-queue";
import { ActivityFeed } from "./activity-feed";
import { VoiceAgentTab } from "./voice-agent-tab";
import { AutoReplyAgentTab } from "./autoreply-agent-tab";
import { GuardrailsTab } from "./guardrails-tab";

type Window = "24h" | "7d";
type Metric = { label: string; value: string };

function since(w: Window) {
  return new Date(Date.now() - (w === "24h" ? 1 : 7) * 86400000).toISOString();
}

function voiceMetrics(db: DemoData, w: Window): Metric[] {
  const from = since(w);
  const calls = db.calls.filter((c) => c.kind === "voice_agent" && c.startedAt >= from);
  const completed = calls.filter((c) => c.status === "completed");
  const avg = completed.length ? Math.round(completed.reduce((s, c) => s + c.durationSec, 0) / completed.length) : 0;
  const qualified = completed.length ? Math.round((completed.filter((c) => c.outcome === "qualified").length / completed.length) * 100) : 0;
  return [
    { label: "Calls handled", value: String(calls.length) },
    { label: "Avg duration", value: `${Math.floor(avg / 60)}:${String(avg % 60).padStart(2, "0")}` },
    { label: "Qualified", value: `${qualified}%` },
    { label: "Escalations", value: String(calls.filter((c) => c.outcome === "handoff").length) },
  ];
}

function autoreplyMetrics(db: DemoData, w: Window): Metric[] {
  const from = since(w);
  const evs = db.agentEvents.filter((e) => e.agent === "autoreply" && e.at >= from);
  const auto = evs.filter((e) => e.status === "auto").length;
  const nonAuto = evs.filter((e) => e.status !== "auto" && e.status !== "info");
  const escalated = nonAuto.filter((e) => /escalat/i.test(e.action)).length;
  const drafted = nonAuto.length - escalated;
  const total = auto + drafted + escalated;
  const conf = evs.filter((e) => e.confidence != null);
  const avgConf = conf.length ? Math.round((conf.reduce((s, e) => s + (e.confidence ?? 0), 0) / conf.length) * 100) : 0;
  return [
    { label: "Auto-sent", value: String(auto) },
    { label: "Drafted / escalated", value: `${drafted} / ${escalated}` },
    { label: "Containment", value: total ? `${Math.round((auto / total) * 100)}%` : "—" },
    { label: "Avg confidence", value: conf.length ? `${avgConf}%` : "—" },
  ];
}

function scoringMetrics(db: DemoData, w: Window): Metric[] {
  const from = since(w);
  const scored = db.agentEvents.filter((e) => e.agent === "scoring" && e.at >= from).length;
  const open = db.enquiries.filter((e) => !["lost", "non_lead", "completed"].includes(e.stage));
  const hot = open.filter((e) => (e.aiScore ?? 0) >= 75).length;
  const avg = open.length ? Math.round(open.reduce((s, e) => s + (e.aiScore ?? 0), 0) / open.length) : 0;
  return [
    { label: "Enquiries scored", value: String(scored) },
    { label: "Hot (75+)", value: String(hot) },
    { label: "Avg score", value: String(avg) },
    { label: "Open pipeline", value: String(open.length) },
  ];
}

function itineraryMetrics(db: DemoData, w: Window): Metric[] {
  const from = since(w);
  const it = db.agentEvents.filter((e) => e.agent === "itinerary" && e.at >= from);
  const nudges = db.messages.filter((m) => m.direction === "outbound" && m.ai?.intent === "no_reply_followup" && m.at >= from);
  const won = nudges.filter((n) => db.messages.some((m) => m.travellerId === n.travellerId && m.direction === "inbound" && m.at > n.at)).length;
  return [
    { label: "Drafts created", value: String(it.length) },
    { label: "Approved", value: String(it.filter((e) => e.status === "approved").length) },
    { label: "Nudges sent", value: String(nudges.length) },
    { label: "Replies won", value: String(won) },
  ];
}

interface AgentCardDef {
  key: "voice" | "autoReply" | "scoring" | "itinerary";
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
  bg: string;
  enabled: (db: DemoData) => boolean;
  setEnabled: (db: DemoData, v: boolean) => void;
  status: (db: DemoData) => "Active" | "Draft-only" | "Off";
  metrics: (db: DemoData, w: Window) => Metric[];
  tab: string;
}

const CARDS: AgentCardDef[] = [
  {
    key: "voice",
    title: "Aanya · Voice agent",
    subtitle: "Calls new leads, answers FAQs, hands off anything sensitive",
    icon: PhoneCall,
    tint: "text-brand-700",
    bg: "bg-brand-100",
    enabled: (db) => db.settings.agents.voice.enabled,
    setEnabled: (db, v) => { db.settings.agents.voice.enabled = v; },
    status: (db) => (db.settings.agents.voice.enabled ? "Active" : "Off"),
    metrics: voiceMetrics,
    tab: "voice",
  },
  {
    key: "autoReply",
    title: "Wish · Auto-reply agent",
    subtitle: "Replies on WhatsApp and Instagram, drafts when unsure",
    icon: MessageSquareText,
    tint: "text-emerald-700",
    bg: "bg-emerald-100",
    enabled: (db) => db.settings.agents.autoReply.enabled,
    setEnabled: (db, v) => { db.settings.agents.autoReply.enabled = v; },
    status: (db) => (!db.settings.agents.autoReply.enabled ? "Off" : db.settings.agents.autoReply.mode === "draft" ? "Draft-only" : "Active"),
    metrics: autoreplyMetrics,
    tab: "autoreply",
  },
  {
    key: "scoring",
    title: "Scoring",
    subtitle: "Conversion likelihood for every open enquiry, explained",
    icon: BrainCircuit,
    tint: "text-indigo-700",
    bg: "bg-indigo-100",
    enabled: (db) => db.settings.agents.scoring.enabled,
    setEnabled: (db, v) => { db.settings.agents.scoring.enabled = v; },
    status: (db) => (db.settings.agents.scoring.enabled ? "Active" : "Off"),
    metrics: scoringMetrics,
    tab: "feed",
  },
  {
    key: "itinerary",
    title: "Itinerary & follow-up",
    subtitle: "Builds plans from reels and nudges silent threads",
    icon: Map,
    tint: "text-saffron-700",
    bg: "bg-saffron-100",
    enabled: (db) => db.settings.agents.itinerary.enabled && db.settings.agents.followUp.enabled,
    setEnabled: (db, v) => { db.settings.agents.itinerary.enabled = v; db.settings.agents.followUp.enabled = v; },
    status: (db) => (!db.settings.agents.itinerary.enabled && !db.settings.agents.followUp.enabled ? "Off" : db.settings.agents.itinerary.requireReview ? "Draft-only" : "Active"),
    metrics: itineraryMetrics,
    tab: "feed",
  },
];

const STATUS_CLASS = { Active: "bg-emerald-100 text-emerald-800", "Draft-only": "bg-amber-100 text-amber-800", Off: "bg-zinc-100 text-zinc-700" } as const;

const TABS = [
  { key: "review", label: "Review queue", icon: <ClipboardCheck className="h-4 w-4" /> },
  { key: "feed", label: "Activity feed", icon: <Activity className="h-4 w-4" /> },
  { key: "voice", label: "Voice agent", icon: <PhoneCall className="h-4 w-4" /> },
  { key: "autoreply", label: "Auto-reply agent", icon: <Bot className="h-4 w-4" /> },
  { key: "guardrails", label: "Guardrails", icon: <ShieldCheck className="h-4 w-4" /> },
];

export function AgentsWorkspace() {
  const db = useDb();
  const user = useCurrentUser();
  const { toast, node } = useToast();
  const canConfigure = can(user.role, "agents.configure");
  const [tab, setTab] = React.useState("review");
  const [win, setWin] = React.useState<Window>("7d");
  const pending = db.agentEvents.filter((e) => e.status === "needs_review").length;

  return (
    <div>
      <PageHeader title="AI Agents" subtitle="Aanya on the phone, Wish in the chats, scoring and follow-up in the background — with humans reviewing what matters.">
        <div className="flex rounded-md border border-border bg-card p-0.5 text-xs">
          {(["24h", "7d"] as Window[]).map((w) => (
            <button key={w} type="button" onClick={() => setWin(w)} className={cn("h-8 rounded px-3 font-medium", win === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              Last {w}
            </button>
          ))}
        </div>
      </PageHeader>
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {CARDS.map((c) => {
            const Icon = c.icon;
            const status = c.status(db);
            return (
              <Card key={c.key} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", c.bg, c.tint)}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{c.title}</div>
                      <span className={cn("mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_CLASS[status])}>{status}</span>
                    </div>
                  </div>
                  <Toggle
                    checked={c.enabled(db)}
                    disabled={!canConfigure}
                    onChange={(v) => {
                      mutateDb((d) => {
                        c.setEnabled(d, v);
                        logActivity(d, { actor: user.name, actorKind: "user", type: "settings_changed", text: `${v ? "Enabled" : "Disabled"} ${c.title}` });
                      });
                      toast(`${c.title} ${v ? "enabled" : "switched off"}`);
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{c.subtitle}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                  {c.metrics(db, win).map((m) => (
                    <div key={m.label}>
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{m.label}</dt>
                      <dd className="font-display text-lg font-semibold leading-tight">{m.value}</dd>
                    </div>
                  ))}
                </dl>
                <button type="button" onClick={() => setTab(c.tab)} className="mt-3 self-start text-xs font-medium text-brand-700 hover:underline">
                  {c.tab === "feed" ? "See activity →" : "Configure →"}
                </button>
              </Card>
            );
          })}
        </div>

        <Card className="overflow-hidden">
          <ScrollableTabs tabs={TABS.map((t) => (t.key === "review" && pending > 0 ? { ...t, label: `${t.label} (${pending})` } : t))} active={tab} onChange={setTab} />
          <div className="p-4">
            {tab === "review" && <ReviewQueue />}
            {tab === "feed" && <ActivityFeed />}
            {tab === "voice" && <VoiceAgentTab />}
            {tab === "autoreply" && <AutoReplyAgentTab />}
            {tab === "guardrails" && <GuardrailsTab />}
          </div>
        </Card>
      </div>
      {node}
    </div>
  );
}
