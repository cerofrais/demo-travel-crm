"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Bot, Clock, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Play, Sparkles, UserPlus } from "lucide-react";
import { Badge, Button, Input, ScoreBadge, ScrollableTabs, Select, Sheet } from "@/components/ui";
import { EmptyState, StatCard, useToast } from "@/components/shared";
import { PageHeader } from "@/components/app/page-header";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { enquiryById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import type { Call, CallOutcome } from "@/lib/demo/types";
import { cn, formatDateTime, toDateInput } from "@/lib/utils";
import { CallDetail } from "./calls-panel";
import { CALL_STATUS_CLASS, OUTCOME_CLASS, OUTCOME_LABEL, SENTIMENT_CLASS, callerName, createEnquiryFromCall, formatDuration, handledByLabel } from "./call-utils";

const TABS = [
  { key: "all", label: "All" },
  { key: "voice", label: "Voice agent" },
  { key: "human", label: "Consultants" },
  { key: "missed", label: "Missed" },
];
const MISSED: Call["status"][] = ["missed", "voicemail", "no_answer"];

export function CallsWorkspace() {
  const db = useDb();
  const user = useCurrentUser();
  const { toast, node } = useToast();
  const [tab, setTab] = React.useState("all");
  const [direction, setDirection] = React.useState<"" | Call["direction"]>("");
  const [outcome, setOutcome] = React.useState<"" | CallOutcome>("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const aanya = db.settings.agents.voice.name;

  const stats = React.useMemo(() => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const week = db.calls.filter((c) => c.startedAt >= since);
    const voice = week.filter((c) => c.kind === "voice_agent").length;
    const completed = week.filter((c) => c.status === "completed");
    const avg = completed.length ? Math.round(completed.reduce((s, c) => s + c.durationSec, 0) / completed.length) : 0;
    return {
      total: week.length,
      aanyaPct: week.length ? Math.round((voice / week.length) * 100) : 0,
      avg,
      missed: week.filter((c) => MISSED.includes(c.status)).length,
      escalations: week.filter((c) => c.outcome === "handoff").length,
    };
  }, [db.calls]);

  const rows = React.useMemo(() => {
    return db.calls
      .filter((c) => {
        if (tab === "voice" && c.kind !== "voice_agent") return false;
        if (tab === "human" && c.kind !== "human") return false;
        if (tab === "missed" && !MISSED.includes(c.status)) return false;
        if (direction && c.direction !== direction) return false;
        if (outcome && c.outcome !== outcome) return false;
        if (from && toDateInput(c.startedAt) < from) return false;
        if (to && toDateInput(c.startedAt) > to) return false;
        return true;
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [db.calls, tab, direction, outcome, from, to]);

  const open = openId ? db.calls.find((c) => c.id === openId) : undefined;
  const canCreate = can(user.role, "enquiries.work") || can(user.role, "enquiries.manage");

  return (
    <div>
      <PageHeader title="Calls" subtitle={`Every call — ${aanya}'s and the team's — with transcripts, outcomes and quality scores.`} />
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard label="Total · 7d" value={stats.total} icon={Phone} />
          <StatCard label={`Handled by ${aanya}`} value={`${stats.aanyaPct}%`} icon={Bot} hint="of calls this week" />
          <StatCard label="Avg duration" value={formatDuration(stats.avg)} icon={Clock} />
          <StatCard label="Missed / voicemail" value={stats.missed} icon={PhoneMissed} tint={stats.missed > 0 ? "text-amber-600" : "text-emerald-600"} />
          <StatCard label="Escalations" value={stats.escalations} icon={AlertTriangle} tint={stats.escalations > 0 ? "text-rose-600" : "text-emerald-600"} />
        </div>

        <div className="rounded-xl border border-border bg-card">
          <ScrollableTabs tabs={TABS} active={tab} onChange={setTab} />
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as "" | Call["direction"])} className="h-9 w-auto lg:h-9" aria-label="Direction">
              <option value="">Any direction</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </Select>
            <Select value={outcome} onChange={(e) => setOutcome(e.target.value as "" | CallOutcome)} className="h-9 w-auto lg:h-9" aria-label="Outcome">
              <option value="">Any outcome</option>
              {(Object.keys(OUTCOME_LABEL) as CallOutcome[]).map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>)}
            </Select>
            <div className="flex items-center gap-1.5">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-auto lg:h-9" aria-label="From date" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-auto lg:h-9" aria-label="To date" />
            </div>
            {(direction || outcome || from || to) && (
              <Button variant="ghost" size="sm" onClick={() => { setDirection(""); setOutcome(""); setFrom(""); setTo(""); }}>Clear</Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{rows.length} calls</span>
          </div>
          {rows.length === 0 ? (
            <div className="p-4"><EmptyState icon={Phone} title="No calls match" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold" />
                    <th className="px-3 py-2 font-semibold">Caller</th>
                    <th className="px-3 py-2 font-semibold">Enquiry</th>
                    <th className="px-3 py-2 font-semibold">Handled by</th>
                    <th className="px-3 py-2 font-semibold">Started</th>
                    <th className="px-3 py-2 font-semibold">Duration</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Outcome</th>
                    <th className="px-3 py-2 font-semibold">Sentiment</th>
                    <th className="px-3 py-2 font-semibold">Quality</th>
                    <th className="px-3 py-2 font-semibold">Rec.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((c) => {
                    const e = enquiryById(db, c.enquiryId);
                    const Dir = c.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
                    return (
                      <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer transition-colors hover:bg-secondary">
                        <td className="px-3 py-2.5">
                          <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", MISSED.includes(c.status) ? "bg-amber-100 text-amber-700" : c.kind === "voice_agent" ? "bg-brand-100 text-brand-700" : "bg-sand-100 text-ink-600")}>
                            <Dir className="h-4 w-4" />
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{callerName(db, c)}</div>
                          {c.travellerId && <div className="text-[11px] text-muted-foreground">{c.phone}</div>}
                        </td>
                        <td className="px-3 py-2.5">
                          {e ? (
                            <Link href={`/enquiries?enquiry=${e.id}`} onClick={(ev) => ev.stopPropagation()} className="font-medium text-brand-700 hover:underline">
                              {e.ref}
                            </Link>
                          ) : c.extracted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700"><Sparkles className="h-3 w-3" /> unlinked lead</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {c.kind === "voice_agent" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-800"><Bot className="h-3 w-3" /> {aanya}</span>
                          ) : (
                            <span className="text-xs">{handledByLabel(db, c)}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">{formatDateTime(c.startedAt)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{formatDuration(c.durationSec)}</td>
                        <td className="px-3 py-2.5"><Badge className={CALL_STATUS_CLASS[c.status]}>{c.status.replace("_", " ")}</Badge></td>
                        <td className="px-3 py-2.5">{c.outcome ? <Badge className={OUTCOME_CLASS[c.outcome]}>{OUTCOME_LABEL[c.outcome]}</Badge> : "—"}</td>
                        <td className={cn("px-3 py-2.5 text-xs capitalize", c.sentiment ? SENTIMENT_CLASS[c.sentiment] : "text-muted-foreground")}>{c.sentiment ?? "—"}</td>
                        <td className="px-3 py-2.5">{c.qualityScore != null ? <ScoreBadge score={c.qualityScore} /> : <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2.5">
                          {c.recordingAvailable ? (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary" title="Play recording"><Play className="h-3.5 w-3.5 pl-0.5" /></span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Sheet open={Boolean(open)} onClose={() => setOpenId(null)} title={open ? `Call · ${callerName(db, open)}` : "Call"} widthClassName="w-full max-w-xl">
        {open && (
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{handledByLabel(db, open)}</span>
              <span>· {open.direction}</span>
              <span>· {formatDateTime(open.startedAt)}</span>
              <span>· {formatDuration(open.durationSec)}</span>
              <Badge className={CALL_STATUS_CLASS[open.status]}>{open.status.replace("_", " ")}</Badge>
              {open.outcome && <Badge className={OUTCOME_CLASS[open.outcome]}>{OUTCOME_LABEL[open.outcome]}</Badge>}
              {open.qualityScore != null && <ScoreBadge score={open.qualityScore} />}
            </div>
            {open.enquiryId ? (
              <Link href={`/enquiries?enquiry=${open.enquiryId}`} className="inline-flex text-xs font-medium text-brand-700 hover:underline">
                Open enquiry {enquiryById(db, open.enquiryId)?.ref} →
              </Link>
            ) : open.extracted && canCreate ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="text-xs text-amber-900">{aanya} captured a brief but no enquiry exists yet.</span>
                <Button
                  size="sm"
                  onClick={() => {
                    let ref = "";
                    mutateDb((d) => {
                      const e = createEnquiryFromCall(d, open.id, user);
                      ref = e?.ref ?? "";
                    });
                    toast(ref ? `Created enquiry ${ref} from the call` : "Could not create enquiry");
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Create enquiry from call
                </Button>
              </div>
            ) : null}
            <CallDetail call={open} />
          </div>
        )}
      </Sheet>
      {node}
    </div>
  );
}
