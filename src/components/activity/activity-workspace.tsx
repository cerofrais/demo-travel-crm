"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bot, ChevronLeft, ChevronRight, Cog, Download, History, User as UserIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Avatar, Badge, Button, Card, Input, Select } from "@/components/ui";
import { EmptyState, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { enquiryById, travellerById, tripById } from "@/lib/demo/queries";
import { cn, downloadText, formatDateTime, toCsv } from "@/lib/utils";
import type { Activity, DemoData } from "@/lib/demo/types";

const PAGE = 50;

interface Row extends Activity {
  source: "activity" | "agent";
  confidence?: number;
}

const KIND_CLASS: Record<Activity["actorKind"], string> = {
  user: "bg-brand-100 text-brand-800",
  ai: "bg-indigo-100 text-indigo-800",
  system: "bg-zinc-100 text-zinc-700",
  traveller: "bg-saffron-100 text-saffron-700",
};

const AGENT_NAME: Record<string, string> = { voice: "Aanya (voice)", autoreply: "Wish (auto-reply)", scoring: "Lead scoring", itinerary: "Itinerary agent", followup: "Follow-up agent", assignment: "Assignment agent" };

export function mergedRows(db: DemoData): Row[] {
  const a: Row[] = db.activities.map((x) => ({ ...x, source: "activity" }));
  const b: Row[] = db.agentEvents.map((e) => ({
    id: e.id,
    at: e.at,
    actor: AGENT_NAME[e.agent] ?? e.agent,
    actorKind: "ai",
    type: e.agent,
    enquiryId: e.enquiryId,
    tripId: e.tripId,
    travellerId: e.travellerId,
    text: `${e.action} — ${e.detail}${e.status === "needs_review" ? " (needs review)" : e.status === "approved" ? " (approved)" : e.status === "rejected" ? " (rejected)" : ""}`,
    source: "agent",
    confidence: e.confidence,
  }));
  return [...a, ...b].sort((x, y) => y.at.localeCompare(x.at));
}

function typeLabel(t: string) {
  return t.replace(/_/g, " ");
}

export function ActivityWorkspace() {
  const db = useDb();
  const params = useSearchParams();
  const { toast, node } = useToast();
  const [kind, setKind] = React.useState<Activity["actorKind"] | "">("");
  const [actor, setActor] = React.useState("");
  const [type, setType] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [q, setQ] = React.useState("");
  const [ref, setRef] = React.useState(() => {
    const id = params.get("enquiry");
    return id ? enquiryById(db, id)?.ref ?? "" : "";
  });
  const [page, setPage] = React.useState(0);

  const all = React.useMemo(() => mergedRows(db), [db]);
  const actors = React.useMemo(() => Array.from(new Set(all.map((r) => r.actor))).sort(), [all]);
  const types = React.useMemo(() => Array.from(new Set(all.map((r) => r.type))).sort(), [all]);

  const rows = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    const refL = ref.trim().toLowerCase();
    const fromT = from ? new Date(from).setHours(0, 0, 0, 0) : null;
    const toT = to ? new Date(to).setHours(23, 59, 59, 999) : null;
    const refIds = refL ? new Set(db.enquiries.filter((e) => e.ref.toLowerCase().includes(refL)).map((e) => e.id)) : null;
    return all.filter((r) => {
      if (kind && r.actorKind !== kind) return false;
      if (actor && r.actor !== actor) return false;
      if (type && r.type !== type) return false;
      const t = new Date(r.at).getTime();
      if (fromT && t < fromT) return false;
      if (toT && t > toT) return false;
      if (refIds && !(r.enquiryId && refIds.has(r.enquiryId))) return false;
      if (s && !`${r.text} ${r.actor}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [all, kind, actor, type, from, to, q, ref, db.enquiries]);

  React.useEffect(() => setPage(0), [kind, actor, type, from, to, q, ref]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice(page * PAGE, page * PAGE + PAGE);

  const exportCsv = () => {
    const csv = toCsv(rows.map((r) => ({ at: r.at, actor: r.actor, actorKind: r.actorKind, type: r.type, text: r.text, enquiry: enquiryById(db, r.enquiryId)?.ref ?? "", trip: tripById(db, r.tripId)?.ref ?? "", traveller: travellerById(db, r.travellerId)?.fullName ?? "" })));
    if (!csv) return toast("Nothing to export");
    downloadText(`wishtrip-activity-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
    toast(`Exported ${rows.length} rows`);
  };

  const reset = () => {
    setKind("");
    setActor("");
    setType("");
    setFrom("");
    setTo("");
    setQ("");
    setRef("");
  };

  return (
    <>
      <PageHeader title="Activity log" subtitle={`${all.length.toLocaleString("en-IN")} events · humans, AI agents, system and travellers`}>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </PageHeader>
      <div className="space-y-4 p-4 md:p-6">
        <Card className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-7">
          <Select value={kind} onChange={(e) => setKind(e.target.value as Activity["actorKind"] | "")} aria-label="Actor kind">
            <option value="">Any actor kind</option>
            <option value="user">Team member</option>
            <option value="ai">AI agent</option>
            <option value="system">System</option>
            <option value="traveller">Traveller</option>
          </Select>
          <Select value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Actor">
            <option value="">Anyone</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
            <option value="">Any type</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          <Input placeholder="Search text…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Input placeholder="WT-1042" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Enquiry ref" />
        </Card>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {rows.length.toLocaleString("en-IN")} matching · page {page + 1} of {pages}
          </span>
          <button type="button" onClick={reset} className="hover:text-foreground">
            Clear filters
          </button>
        </div>

        {slice.length === 0 ? (
          <EmptyState icon={History} title="No activity matches" hint="Loosen the filters or clear the date range." />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-secondary/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">When</th>
                    <th className="px-3 py-2 text-left font-semibold">Who</th>
                    <th className="px-3 py-2 text-left font-semibold">Type</th>
                    <th className="px-3 py-2 text-left font-semibold">What</th>
                    <th className="px-3 py-2 text-left font-semibold">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {slice.map((r) => {
                    const e = enquiryById(db, r.enquiryId);
                    const t = tripById(db, r.tripId);
                    const tv = travellerById(db, r.travellerId ?? e?.travellerId);
                    return (
                      <tr key={r.id} className="align-top">
                        <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{formatDateTime(r.at)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {r.actorKind === "user" ? (
                              <Avatar name={r.actor} className="h-6 w-6 text-[9px]" />
                            ) : (
                              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", KIND_CLASS[r.actorKind])}>
                                {r.actorKind === "ai" ? <Bot className="h-3.5 w-3.5" /> : r.actorKind === "system" ? <Cog className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
                              </span>
                            )}
                            <span className="whitespace-nowrap text-xs">{r.actor}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={cn("whitespace-nowrap capitalize", KIND_CLASS[r.actorKind])}>{typeLabel(r.type)}</Badge>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {r.text}
                          {typeof r.confidence === "number" && r.confidence < 1 && <span className="ml-1 text-[10px] text-muted-foreground">{Math.round(r.confidence * 100)}% conf.</span>}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            {e && (
                              <Link href={`/enquiries?enquiry=${e.id}`} className="whitespace-nowrap text-primary hover:underline">
                                {e.ref}
                              </Link>
                            )}
                            {t && (
                              <Link href={`/trips/${t.id}`} className="whitespace-nowrap text-primary hover:underline">
                                {t.ref}
                              </Link>
                            )}
                            {tv && (
                              <Link href={`/travellers?traveller=${tv.id}`} className="whitespace-nowrap text-muted-foreground hover:underline">
                                {tv.fullName}
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                {page * PAGE + 1}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length}
              </span>
              <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        )}
      </div>
      {node}
    </>
  );
}
