"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, Check, Clock, ExternalLink, FileWarning, MessageCircle, Search, Sparkles, User } from "lucide-react";
import { Avatar, Input } from "@/components/ui";
import { ChannelBadge, EmptyState, StageBadge } from "@/components/shared";
import { PageHeader } from "@/components/app/page-header";
import { ConversationPanel } from "@/components/conversation/conversation-panel";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { enquiryById, threads, travellerById, type Thread } from "@/lib/demo/queries";
import { CHANNEL_CLASS, CHANNEL_LABEL } from "@/lib/pipeline";
import type { Channel } from "@/lib/demo/types";
import { cn, relativeTime } from "@/lib/utils";

type Filter = "all" | "unanswered" | "review" | "ai" | "mine";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unanswered", label: "Unanswered" },
  { key: "review", label: "Needs review" },
  { key: "ai", label: "AI handled" },
  { key: "mine", label: "Mine" },
];

export function InboxWorkspace() {
  const db = useDb();
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selectedKey = params.get("thread");

  const [filter, setFilter] = React.useState<Filter>("all");
  // Channel chips on top of the list — multi-select, empty means every channel.
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const toggleChannel = (c: Channel) => setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  const [q, setQ] = React.useState("");

  const allThreads = React.useMemo(() => threads(db), [db]);
  const list = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allThreads.filter((t) => {
      if (channels.length && !channels.includes(t.channel)) return false;
      const e = enquiryById(db, t.enquiryId);
      if (filter === "unanswered" && !t.unanswered) return false;
      if (filter === "review" && !t.hasDraft) return false;
      if (filter === "ai" && t.aiHandled === 0) return false;
      if (filter === "mine" && e?.assignedTo !== user.sub) return false;
      if (needle) {
        const trv = travellerById(db, t.travellerId);
        const hay = `${trv?.fullName ?? ""} ${trv?.phone ?? ""} ${trv?.instagramHandle ?? ""} ${e?.ref ?? ""} ${e?.destination ?? ""}`.toLowerCase();
        const inText = db.messages.some((m) => m.travellerId === t.travellerId && m.channel === t.channel && m.body.toLowerCase().includes(needle));
        if (!hay.includes(needle) && !inText) return false;
      }
      return true;
    });
  }, [allThreads, channels, filter, q, db, user.sub]);

  const selected = selectedKey ? allThreads.find((t) => t.key === selectedKey) : undefined;
  const selectedParts = selectedKey?.split(":") ?? [];
  const fallbackTraveller = !selected && selectedParts[0] ? travellerById(db, selectedParts[0]) : undefined;

  function select(key: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (key) sp.set("thread", key);
    else sp.delete("thread");
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  // Stats
  const stats = React.useMemo(() => {
    const today = new Date().toDateString();
    const unanswered = allThreads.filter((t) => t.unanswered).length;
    const drafts = db.messages.filter((m) => m.status === "draft").length;
    const frs = db.enquiries.map((e) => e.firstResponseMinutes).filter((n): n is number => n != null).sort((a, b) => a - b);
    const median = frs.length ? frs[Math.floor(frs.length / 2)] : null;
    const inboundToday = db.messages.filter((m) => m.direction === "inbound" && new Date(m.at).toDateString() === today).length;
    const aiToday = db.agentEvents.filter((e) => e.agent === "autoreply" && e.status === "auto" && new Date(e.at).toDateString() === today).length;
    const aiPct = inboundToday > 0 ? Math.min(100, Math.round((aiToday / inboundToday) * 100)) : null;
    return { unanswered, drafts, median, aiPct, inboundToday };
  }, [allThreads, db]);

  const showThreadOnPhone = Boolean(selectedKey);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Inbox" subtitle="WhatsApp, Instagram and email in one thread per traveller — Wish answers first, you step in when it matters." />
      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border md:grid-cols-4">
        <Stat icon={MessageCircle} label="Unanswered" value={stats.unanswered} tint={stats.unanswered > 0 ? "text-clay-500" : "text-emerald-600"} onClick={() => setFilter("unanswered")} />
        <Stat icon={Clock} label="Median first response" value={stats.median != null ? `${stats.median} min` : "—"} tint="text-brand-600" hint={`SLA ${db.settings.sla.firstResponseMin} min`} />
        <Stat icon={Sparkles} label="Handled by AI today" value={stats.aiPct != null ? `${stats.aiPct}%` : "—"} tint="text-brand-600" hint={`${stats.inboundToday} inbound today`} onClick={() => setFilter("ai")} />
        <Stat icon={FileWarning} label="Drafts awaiting review" value={stats.drafts} tint={stats.drafts > 0 ? "text-amber-600" : "text-emerald-600"} onClick={() => setFilter("review")} />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <aside className={cn("flex w-full min-w-0 flex-col border-r border-border bg-card md:w-[360px] md:shrink-0", showThreadOnPhone && "hidden md:flex")}>
          <div className="shrink-0 space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, text…" className="h-10 pl-8 lg:h-10" />
            </div>
            <div className="flex items-center gap-2">
              <div className="scrollbar-thin flex min-w-0 flex-1 gap-1 overflow-x-auto">
                {FILTERS.map((f) => {
                  const n = f.key === "unanswered" ? stats.unanswered : f.key === "review" ? allThreads.filter((t) => t.hasDraft).length : undefined;
                  return (
                    <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={cn("flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors", filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-brand-100")}>
                      {f.label}
                      {n != null && n > 0 && <span className={cn("rounded-full px-1 text-[10px] tabular-nums", filter === f.key ? "bg-white/20" : "bg-card")}>{n}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Channels as selectable tag chips — pick one or several to filter the list. */}
            <div className="scrollbar-thin flex items-center gap-1 overflow-x-auto" role="group" aria-label="Channels">
              <button
                type="button"
                onClick={() => setChannels([])}
                className={cn("flex h-7 shrink-0 items-center rounded-full px-2.5 text-[11px] font-semibold transition-colors", channels.length === 0 ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:bg-brand-100")}
              >
                All channels
              </button>
              {(["whatsapp", "instagram", "email"] as Channel[]).map((c) => {
                const on = channels.includes(c);
                const n = allThreads.filter((t) => t.channel === c).length;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleChannel(c)}
                    aria-pressed={on}
                    className={cn(
                      "flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
                      on ? `${CHANNEL_CLASS[c]} border-current` : "border-transparent bg-secondary text-muted-foreground hover:bg-brand-100",
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                    {CHANNEL_LABEL[c]}
                    <span className={cn("rounded-full px-1 tabular-nums", on ? "bg-white/60" : "bg-card")}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.length === 0 && <div className="p-4"><EmptyState title="No threads match" hint="Try another filter or clear the search." /></div>}
            {list.map((t) => (
              <ThreadRow key={t.key} t={t} active={t.key === selectedKey} onClick={() => select(t.key)} />
            ))}
          </div>
        </aside>

        {/* Thread */}
        <section className={cn("flex min-w-0 flex-1 flex-col bg-background", !showThreadOnPhone && "hidden md:flex")}>
          {selected || fallbackTraveller ? (
            <ThreadView thread={selected} travellerId={selected?.travellerId ?? fallbackTraveller!.id} channel={(selected?.channel ?? (selectedParts[1] as Channel | undefined) ?? "whatsapp") as Channel} onBack={() => select(null)} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={MessageCircle} title="Pick a conversation" hint="Threads with a clay dot are waiting on you; amber ones have an AI draft to review." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tint, hint, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; tint: string; hint?: string; onClick?: () => void }) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", tint)} />
      </div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="bg-card px-4 py-3 text-left transition-colors hover:bg-secondary">{inner}</button>
  ) : (
    <div className="bg-card px-4 py-3">{inner}</div>
  );
}

function ThreadRow({ t, active, onClick }: { t: Thread; active: boolean; onClick: () => void }) {
  const db = useDb();
  const trv = travellerById(db, t.travellerId);
  const e = enquiryById(db, t.enquiryId);
  const prefix = t.last.direction === "inbound" ? "" : t.last.sentBy === "ai" ? `${db.settings.agents.autoReply.persona}: ` : "You: ";
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-secondary", active && "bg-brand-50 hover:bg-brand-50")}>
      <div className="relative shrink-0">
        <Avatar name={trv?.fullName} className="h-9 w-9" />
        {t.unanswered && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-clay-500" title="Unanswered" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate text-sm", t.unanswered ? "font-semibold" : "font-medium")}>{trv?.fullName ?? "Unknown"}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(t.last.at)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <ChannelBadge channel={t.channel} />
          {e && <span className="truncate text-[11px] text-muted-foreground">{e.ref} · {e.destination}</span>}
        </div>
        <p className={cn("mt-1 line-clamp-1 text-xs", t.last.status === "draft" ? "italic text-amber-700" : "text-muted-foreground")}>
          {t.last.status === "draft" ? "Draft: " : prefix}
          {t.last.body}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {t.hasDraft && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">review</span>}
          {t.aiHandled > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-800">
              <Bot className="h-2.5 w-2.5" /> {t.aiHandled}
            </span>
          )}
          {t.unanswered && <span className="rounded-full bg-clay-50 px-1.5 py-0.5 text-[10px] font-medium text-clay-600">unanswered</span>}
        </div>
      </div>
    </button>
  );
}

function ThreadView({ thread, travellerId, channel, onBack }: { thread?: Thread; travellerId: string; channel: Channel; onBack: () => void }) {
  const db = useDb();
  const trv = travellerById(db, travellerId);
  const e = enquiryById(db, thread?.enquiryId) ?? db.enquiries.filter((x) => x.travellerId === travellerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2 md:px-4">
        <button type="button" onClick={onBack} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md hover:bg-secondary md:hidden" aria-label="Back to list">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={trv?.fullName} className="hidden h-9 w-9 sm:flex" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">{trv?.fullName ?? "Unknown"}</span>
            <ChannelBadge channel={channel} />
            {trv?.phone && <span className="hidden text-xs text-muted-foreground sm:inline">{trv.phone}</span>}
          </div>
          {e && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{e.ref}</span>
              <StageBadge stage={e.stage} />
              <span>{e.destination}</span>
              {e.assignedTo && <span>· {db.users.find((u) => u.sub === e.assignedTo)?.name.split(" ")[0]}</span>}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {e && (
            <Link href={`/enquiries?enquiry=${e.id}`} className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-brand-700 hover:bg-secondary" title="Open enquiry">
              <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Open enquiry</span>
            </Link>
          )}
          <Link href={`/travellers?traveller=${travellerId}`} className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-brand-700 hover:bg-secondary" title="Open traveller">
            <User className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Open traveller</span>
          </Link>
        </div>
      </div>
      <div className="min-h-0 flex-1 p-0 md:p-3">
        <ConversationPanel travellerId={travellerId} enquiryId={e?.id} channel={channel} className="rounded-none border-0 md:rounded-xl md:border" />
      </div>
    </div>
  );
}
