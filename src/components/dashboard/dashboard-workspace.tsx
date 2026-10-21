"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Inbox, Timer, IndianRupee, Plane, Percent, Bot, ListTodo, Sparkles, ArrowRight, PhoneCall, MessageCircle, Map as MapIcon } from "lucide-react";
import { Card, Badge, Avatar, ScoreBadge } from "@/components/ui";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, BarList, StageBadge, SourceBadge, SectionTitle } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { STAGES, SOURCE_LABEL, TASK_KIND_LABEL } from "@/lib/pipeline";
import { travellerById, userName, isOpen, visibleEnquiries, destinationById } from "@/lib/demo/queries";
import { formatINR, formatDate, relativeTime, daysUntil, cn } from "@/lib/utils";
import type { EnquiryStage, LeadSource } from "@/lib/demo/types";

const DAY = 86400000;

export function DashboardWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const now = Date.now();

  const m = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const since7 = now - 7 * DAY;
    const enquiries = visibleEnquiries(db, me);
    const open = enquiries.filter(isOpen);
    const newToday = enquiries.filter((e) => now - new Date(e.createdAt).getTime() < DAY).length;
    const new7 = enquiries.filter((e) => new Date(e.createdAt).getTime() >= since7).length;
    const byStage = new Map<EnquiryStage, number>();
    const bySource = new Map<LeadSource, number>();
    let pipelineValue = 0;
    for (const e of enquiries) {
      byStage.set(e.stage, (byStage.get(e.stage) ?? 0) + 1);
      if (new Date(e.createdAt).getTime() >= since7 * 0 + (now - 90 * DAY)) bySource.set(e.source, (bySource.get(e.source) ?? 0) + 1);
      if (["qualified", "itinerary_sent", "negotiation"].includes(e.stage)) pipelineValue += e.budgetINR;
    }
    const responseTimes = enquiries.filter((e) => e.firstResponseMinutes != null).map((e) => e.firstResponseMinutes!).sort((a, b) => a - b);
    const medianResponse = responseTimes.length ? responseTimes[Math.floor(responseTimes.length / 2)] : 0;
    const tripsThisMonth = db.trips.filter((t) => new Date(t.createdAt) >= monthStart && t.status !== "cancelled");
    const bookedThisMonth = tripsThisMonth.reduce((s, t) => s + t.totalINR, 0);
    const considered = enquiries.filter((e) => e.stage !== "non_lead");
    const won = enquiries.filter((e) => e.tripId).length;
    const conversion = considered.length ? Math.round((won / considered.length) * 100) : 0;
    const departures = db.trips.filter((t) => ["confirmed", "docs_pending", "ready"].includes(t.status) && daysUntil(t.startDate) >= 0 && daysUntil(t.startDate) <= 14).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const onTrip = db.trips.filter((t) => t.status === "on_trip").length;
    const overduePayments = db.payments.filter((p) => p.status === "overdue");
    const outstanding = overduePayments.reduce((s, p) => s + p.amountINR, 0);
    const aiToday = db.agentEvents.filter((e) => now - new Date(e.at).getTime() < DAY);
    const aiAuto = aiToday.filter((e) => e.status === "auto").length;
    const aiReview = db.agentEvents.filter((e) => e.status === "needs_review").length;
    const agentCalls = db.calls.filter((c) => c.kind === "voice_agent" && now - new Date(c.startedAt).getTime() < 7 * DAY).length;
    const agentMsgs = db.messages.filter((mm) => mm.sentBy === "ai" && mm.status !== "draft" && now - new Date(mm.at).getTime() < 7 * DAY).length;
    const myTasks = db.tasks
      .filter((t) => t.status === "open" && (me.role === "ADMIN" || me.role === "MANAGER" ? true : !t.assignedTo || t.assignedTo === me.sub) && new Date(t.dueAt).getTime() <= now + DAY)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, 7);
    const attention = open.filter((e) => e.needsAttention).sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0)).slice(0, 6);
    const hot = open.filter((e) => (e.aiScore ?? 0) >= 75 && !e.needsAttention).sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0)).slice(0, 5);
    const destDemand = new Map<string, number>();
    for (const e of open) destDemand.set(e.destinationId, (destDemand.get(e.destinationId) ?? 0) + 1);
    return { enquiries, open, newToday, new7, byStage, bySource, pipelineValue, medianResponse, bookedThisMonth, tripsThisMonth: tripsThisMonth.length, conversion, departures, onTrip, overduePayments, outstanding, aiAuto, aiReview, agentCalls, agentMsgs, myTasks, attention, hot, destDemand };
  }, [db, me, now]);

  const first = me.name.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageHeader title={`${greeting}, ${first}`} subtitle={`${m.newToday} new ${m.newToday === 1 ? "enquiry" : "enquiries"} today · ${m.open.length} open in the pipeline · ${m.aiReview} agent ${m.aiReview === 1 ? "item" : "items"} awaiting review`}>
        <Link href="/enquiries" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-brand-500">
          Open pipeline <ArrowRight className="h-4 w-4" />
        </Link>
      </PageHeader>

      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-6">
          <StatCard label="New (7 days)" value={m.new7} icon={Inbox} hint={`${m.newToday} today`} href="/enquiries" />
          <StatCard label="Median first response" value={`${m.medianResponse} min`} icon={Timer} tint="text-saffron-400" hint={`SLA ${db.settings.sla.firstResponseMin} min`} />
          <StatCard label="Pipeline value" value={formatINR(m.pipelineValue, { compact: true })} icon={Sparkles} tint="text-indigo-500" hint="qualified → negotiation" href="/enquiries" />
          <StatCard label="Booked this month" value={formatINR(m.bookedThisMonth, { compact: true })} icon={IndianRupee} tint="text-emerald-600" hint={`${m.tripsThisMonth} trips`} href="/trips" />
          <StatCard label="Conversion" value={`${m.conversion}%`} icon={Percent} tint="text-clay-500" hint="enquiry → booking" href="/reports" />
          <StatCard label="Overdue collections" value={formatINR(m.outstanding, { compact: true })} icon={IndianRupee} tint="text-rose-500" hint={`${m.overduePayments.length} instalments`} href="/payments?tab=overdue" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Needs attention */}
          <Card className="p-5 lg:col-span-2">
            <SectionTitle action={<Link href="/enquiries?attention=1" className="text-xs font-medium text-primary hover:underline">View all</Link>}>Needs your attention</SectionTitle>
            {m.attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting — the agents are keeping up.</p>
            ) : (
              <ul className="divide-y divide-border">
                {m.attention.map((e) => {
                  const t = travellerById(db, e.travellerId);
                  const d = destinationById(db, e.destinationId);
                  const lastIn = db.messages.filter((mm) => mm.enquiryId === e.id && mm.direction === "inbound").pop();
                  return (
                    <li key={e.id}>
                      <Link href={`/enquiries?enquiry=${e.id}`} className="flex items-center gap-3 py-2.5 hover:bg-secondary/60 -mx-2 px-2 rounded-md">
                        <Avatar name={t?.fullName} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium">{t?.fullName}</span>
                            <span className="text-xs text-muted-foreground">{d?.emoji} {e.destination}</span>
                            <StageBadge stage={e.stage} className="text-[10px]" />
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{lastIn ? `"${lastIn.body.slice(0, 90)}"` : e.notes ?? "Awaiting first response"}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <ScoreBadge score={e.aiScore} />
                          <span className="text-[11px] text-muted-foreground">{relativeTime(e.lastActivityAt)}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Agents today */}
          <Card className="p-5">
            <SectionTitle action={<Link href="/agents" className="text-xs font-medium text-primary hover:underline">Control centre</Link>}>AI agents</SectionTitle>
            <div className="space-y-3">
              <AgentRow icon={PhoneCall} name="Aanya · voice" value={`${m.agentCalls} calls`} hint="last 7 days" on={db.settings.agents.voice.enabled} />
              <AgentRow icon={MessageCircle} name="Wish · auto-reply" value={`${m.agentMsgs} replies`} hint="last 7 days" on={db.settings.agents.autoReply.enabled} />
              <AgentRow icon={MapIcon} name="Itinerary drafts" value={`${db.agentEvents.filter((e) => e.agent === "itinerary").length} drafted`} hint="human-reviewed" on={db.settings.agents.itinerary.enabled} />
              <AgentRow icon={Bot} name="Follow-up & scoring" value={`${m.aiAuto} actions`} hint="last 24 hours" on={db.settings.agents.followUp.enabled} />
            </div>
            <Link href="/agents?tab=review" className={cn("mt-4 flex items-center justify-between rounded-lg px-3 py-2 text-sm", m.aiReview ? "bg-saffron-100 text-saffron-700" : "bg-secondary text-muted-foreground")}>
              <span>{m.aiReview} item{m.aiReview === 1 ? "" : "s"} need{m.aiReview === 1 ? "s" : ""} review</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5">
            <SectionTitle>Pipeline by stage</SectionTitle>
            <BarList rows={STAGES.filter((s) => s.board).map((s) => ({ label: s.label, value: m.byStage.get(s.id) ?? 0, color: s.accent }))} labelWidth="w-36" />
          </Card>
          <Card className="p-5">
            <SectionTitle>Enquiries by source · 90 days</SectionTitle>
            <BarList rows={Array.from(m.bySource.entries()).sort((a, b) => b[1] - a[1]).map(([s, c]) => ({ label: SOURCE_LABEL[s], value: c }))} labelWidth="w-36" colorClass="bg-clay-500" />
          </Card>
          <Card className="p-5">
            <SectionTitle>Open demand by destination</SectionTitle>
            <BarList
              rows={Array.from(m.destDemand.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([id, c]) => {
                  const d = destinationById(db, id);
                  return { label: `${d?.emoji ?? ""} ${d?.name ?? id}`, value: c };
                })}
              labelWidth="w-28"
              colorClass="bg-saffron-400"
            />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-5">
            <SectionTitle action={<Link href="/tasks" className="text-xs font-medium text-primary hover:underline">All tasks</Link>}>Due today</SectionTitle>
            {m.myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks due. Enjoy the calm.</p>
            ) : (
              <ul className="space-y-2">
                {m.myTasks.map((t) => {
                  const overdue = new Date(t.dueAt).getTime() < now;
                  return (
                    <li key={t.id} className="flex items-start gap-2 text-sm">
                      <ListTodo className={cn("mt-0.5 h-4 w-4 shrink-0", overdue ? "text-rose-500" : "text-muted-foreground")} />
                      <div className="min-w-0 flex-1">
                        <Link href={t.enquiryId ? `/enquiries?enquiry=${t.enquiryId}` : "/tasks"} className="block truncate hover:underline">{t.title}</Link>
                        <div className="text-[11px] text-muted-foreground">
                          <Badge className="mr-1 bg-secondary text-secondary-foreground">{TASK_KIND_LABEL[t.kind]}</Badge>
                          <span className={overdue ? "text-rose-600" : ""}>{relativeTime(t.dueAt)}</span>
                          {t.createdBy === "ai" && <span className="ml-1 text-brand-600">· by AI</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle action={<Link href="/trips" className="text-xs font-medium text-primary hover:underline">All trips</Link>}>Departures · next 14 days</SectionTitle>
            {m.departures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No departures in the next two weeks. {m.onTrip} traveller group{m.onTrip === 1 ? "" : "s"} on trip now.</p>
            ) : (
              <ul className="space-y-2">
                {m.departures.slice(0, 6).map((t) => {
                  const trv = travellerById(db, t.travellerId);
                  const d = destinationById(db, t.destinationId);
                  const done = t.checklist.filter((c) => c.done).length;
                  const dIn = daysUntil(t.startDate);
                  return (
                    <li key={t.id}>
                      <Link href={`/trips/${t.id}`} className="flex items-center gap-3 rounded-md -mx-2 px-2 py-1.5 hover:bg-secondary/60">
                        <Plane className="h-4 w-4 shrink-0 text-brand-600" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{trv?.fullName} · {d?.emoji} {t.destination}</div>
                          <div className="text-[11px] text-muted-foreground">{formatDate(t.startDate, "short")} · {done}/{t.checklist.length} checklist · {formatINR(t.paidINR, { compact: true })}/{formatINR(t.totalINR, { compact: true })} paid</div>
                        </div>
                        <Badge className={dIn <= 2 ? "bg-clay-100 text-clay-600" : "bg-brand-100 text-brand-700"}>{dIn === 0 ? "Today" : dIn === 1 ? "Tomorrow" : `in ${dIn}d`}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle action={<Link href="/enquiries" className="text-xs font-medium text-primary hover:underline">Pipeline</Link>}>Hot leads</SectionTitle>
            {m.hot.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hot leads right now.</p>
            ) : (
              <ul className="space-y-2">
                {m.hot.map((e) => {
                  const t = travellerById(db, e.travellerId);
                  return (
                    <li key={e.id}>
                      <Link href={`/enquiries?enquiry=${e.id}`} className="flex items-center gap-3 rounded-md -mx-2 px-2 py-1.5 hover:bg-secondary/60">
                        <ScoreBadge score={e.aiScore} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{t?.fullName} · {e.destination}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <SourceBadge source={e.source} /> {formatINR(e.budgetINR, { compact: true })} · {userName(db, e.assignedTo)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function AgentRow({ icon: Icon, name, value, hint, on }: { icon: typeof Bot; name: string; value: string; hint: string; on: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", on ? "bg-brand-100 text-brand-700" : "bg-muted text-muted-foreground")}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {name}
          <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-emerald-500" : "bg-muted-foreground/40")} />
        </div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
