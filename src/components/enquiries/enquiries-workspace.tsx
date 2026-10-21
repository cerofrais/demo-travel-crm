"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, KanbanSquare, List, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { Enquiry, EnquiryStage, LeadSource, TripType } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { userName, visibleEnquiries } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { SOURCE_LABEL, STAGES, TRIP_TYPE_LABEL, stageLabel } from "@/lib/pipeline";
import { Button, Input, Select, Sheet } from "@/components/ui";
import { TagChip, Toggle, useToast } from "@/components/shared";
import { cn, downloadText, formatDate, paxCount, toCsv, toDateInput } from "@/lib/utils";
import { KanbanBoard } from "./kanban-board";
import { EnquiriesTable } from "./enquiries-table";
import { EnquiryDrawer } from "./enquiry-drawer";
import { NewEnquiryDialog } from "./new-enquiry-dialog";
import { datesLabel } from "./enquiry-card";
import { isConsultant } from "./booking-actions";

type View = "board" | "list";
type OwnerFilter = "all" | "mine" | "unassigned" | string;

interface Filters {
  q: string;
  source: LeadSource | "";
  destination: string;
  tripType: TripType | "";
  owner: OwnerFilter;
  stage: EnquiryStage | "";
  attention: boolean;
  tags: string[];
  tagMode: "any" | "all";
}

const EMPTY: Filters = { q: "", source: "", destination: "", tripType: "", owner: "all", stage: "", attention: false, tags: [], tagMode: "any" };

export function EnquiriesWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast, node: toastNode } = useToast();

  const [view, setView] = React.useState<View>(() => (params.get("view") === "list" ? "list" : "board"));
  const [filters, setFilters] = React.useState<Filters>(EMPTY);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [showTags, setShowTags] = React.useState(false);

  const openId = params.get("enquiry");

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  const openEnquiry = React.useCallback((id: string) => setParam("enquiry", id), [setParam]);
  const closeEnquiry = React.useCallback(() => setParam("enquiry", null), [setParam]);
  const switchView = (v: View) => {
    setView(v);
    setParam("view", v === "list" ? "list" : null);
  };

  const scoped = React.useMemo(() => visibleEnquiries(db, me), [db, me]);
  const consultants = React.useMemo(() => db.users.filter(isConsultant), [db]);

  const filtered = React.useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return scoped.filter((e) => {
      if (filters.source && e.source !== filters.source) return false;
      if (filters.destination && e.destinationId !== filters.destination) return false;
      if (filters.tripType && e.tripType !== filters.tripType) return false;
      if (filters.stage && view === "list" && e.stage !== filters.stage) return false;
      if (filters.attention && !e.needsAttention) return false;
      if (filters.owner === "mine" && e.assignedTo !== me.sub) return false;
      if (filters.owner === "unassigned" && e.assignedTo) return false;
      if (!["all", "mine", "unassigned"].includes(filters.owner) && e.assignedTo !== filters.owner) return false;
      if (filters.tags.length) {
        const has = filters.tags.map((t) => e.tags.includes(t));
        if (filters.tagMode === "all" ? !has.every(Boolean) : !has.some(Boolean)) return false;
      }
      if (q) {
        const t = db.travellers.find((x) => x.id === e.travellerId);
        const hay = [t?.fullName, t?.city, t?.instagramHandle, e.destination, e.ref, ...e.altDestinations].filter(Boolean).join(" ").toLowerCase();
        const phoneHit = digits.length >= 3 && (t?.phone.replace(/\D/g, "") ?? "").includes(digits);
        if (!hay.includes(q) && !phoneHit) return false;
      }
      return true;
    });
  }, [scoped, filters, view, me.sub, db.travellers]);

  const mine = React.useMemo(() => filtered.filter((e) => e.assignedTo === me.sub).length, [filtered, me.sub]);
  const activeCount = [filters.source, filters.destination, filters.tripType, filters.stage && view === "list" ? filters.stage : "", filters.owner !== "all" ? "x" : "", filters.attention ? "x" : "", ...filters.tags].filter(Boolean).length;

  function exportCsv() {
    const rows = filtered.map((e) => {
      const t = db.travellers.find((x) => x.id === e.travellerId);
      return {
        ref: e.ref,
        traveller: t?.fullName ?? "",
        phone: t?.phone ?? "",
        city: t?.city ?? "",
        destination: e.destination,
        stage: stageLabel(e.stage),
        source: SOURCE_LABEL[e.source],
        trip_type: TRIP_TYPE_LABEL[e.tripType],
        dates: datesLabel(e),
        travel_start: toDateInput(e.travelStart),
        nights: e.nights,
        pax: paxCount(e.pax),
        budget_inr: e.budgetINR,
        owner: e.assignedTo ? userName(db, e.assignedTo) : "",
        ai_score: e.aiScore ?? "",
        tags: e.tags.join("|"),
        needs_attention: e.needsAttention ? "yes" : "no",
        created: formatDate(e.createdAt),
        last_activity: formatDate(e.lastActivityAt),
      };
    });
    downloadText(`wishtrip-enquiries-${toDateInput(new Date())}.csv`, toCsv(rows), "text/csv");
    toast(`Exported ${rows.length} enquiries`);
  }

  const canCreate = can(me.role, "enquiries.work") || can(me.role, "enquiries.manage");

  const filterControls = (vertical: boolean) => (
    <div className={cn("gap-2", vertical ? "grid grid-cols-1" : "flex flex-wrap items-center")}>
      <Select value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value as Filters["source"] }))} className={cn(!vertical && "w-auto")} aria-label="Source">
        <option value="">All sources</option>
        {(Object.keys(SOURCE_LABEL) as LeadSource[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
      </Select>
      <Select value={filters.destination} onChange={(e) => setFilters((f) => ({ ...f, destination: e.target.value }))} className={cn(!vertical && "w-auto")} aria-label="Destination">
        <option value="">All destinations</option>
        {db.destinations.map((d) => <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>)}
      </Select>
      <Select value={filters.tripType} onChange={(e) => setFilters((f) => ({ ...f, tripType: e.target.value as Filters["tripType"] }))} className={cn(!vertical && "w-auto")} aria-label="Trip type">
        <option value="">All trip types</option>
        {(Object.keys(TRIP_TYPE_LABEL) as TripType[]).map((t) => <option key={t} value={t}>{TRIP_TYPE_LABEL[t]}</option>)}
      </Select>
      <Select value={filters.owner} onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))} className={cn(!vertical && "w-auto")} aria-label="Owner">
        <option value="all">All owners</option>
        <option value="mine">Mine</option>
        <option value="unassigned">Unassigned</option>
        {consultants.map((u) => <option key={u.sub} value={u.sub}>{u.name}</option>)}
      </Select>
      {view === "list" && (
        <Select value={filters.stage} onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value as Filters["stage"] }))} className={cn(!vertical && "w-auto")} aria-label="Stage">
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      )}
      <Toggle checked={filters.attention} onChange={(v) => setFilters((f) => ({ ...f, attention: v }))} label="Needs attention" />
      {!vertical && (
        <Button variant={showTags || filters.tags.length ? "secondary" : "ghost"} size="sm" onClick={() => setShowTags((s) => !s)}>
          Tags{filters.tags.length ? ` · ${filters.tags.length}` : ""}
        </Button>
      )}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setFilters((f) => ({ ...EMPTY, q: f.q }))}><X className="h-3.5 w-3.5" />Clear</Button>
      )}
    </div>
  );

  const tagControls = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tags</span>
      {db.tags.map((t) => {
        const on = filters.tags.includes(t.name);
        return (
          <button
            key={t.name}
            type="button"
            onClick={() => setFilters((f) => ({ ...f, tags: on ? f.tags.filter((x) => x !== t.name) : [...f.tags, t.name] }))}
            className={cn("rounded-md border px-0.5 py-0.5 transition-colors", on ? "border-primary ring-1 ring-primary" : "border-transparent opacity-70 hover:opacity-100")}
            aria-pressed={on}
          >
            <TagChip name={t.name} tags={db.tags} />
          </button>
        );
      })}
      {filters.tags.length > 1 && (
        <span className="ml-1 inline-flex overflow-hidden rounded-md border border-border text-[11px]">
          {(["any", "all"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setFilters((f) => ({ ...f, tagMode: m }))} className={cn("px-2 py-1 font-medium", filters.tagMode === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>
              {m === "any" ? "Match any" : "Match all"}
            </button>
          ))}
        </span>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold text-foreground">Enquiries</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} shown · {mine} assigned to you</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-md border border-border" role="tablist" aria-label="View">
              <button type="button" role="tab" aria-selected={view === "board"} onClick={() => switchView("board")} className={cn("inline-flex h-9 items-center gap-1.5 px-3 text-sm font-medium", view === "board" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground")}>
                <KanbanSquare className="h-4 w-4" /><span className="hidden sm:inline">Pipeline</span>
              </button>
              <button type="button" role="tab" aria-selected={view === "list"} onClick={() => switchView("list")} className={cn("inline-flex h-9 items-center gap-1.5 px-3 text-sm font-medium", view === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground")}>
                <List className="h-4 w-4" /><span className="hidden sm:inline">List</span>
              </button>
            </div>
            <Button variant="outline" size="md" onClick={exportCsv} title="Export CSV" className="hidden md:inline-flex"><Download className="h-4 w-4" />CSV</Button>
            {canCreate && (
              <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" />New enquiry</Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Search name, phone, destination, ref…" className="pl-9" aria-label="Search enquiries" />
            {filters.q && (
              <button type="button" onClick={() => setFilters((f) => ({ ...f, q: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X className="h-4 w-4" /></button>
            )}
          </div>
          <Button variant={activeCount ? "secondary" : "outline"} className="md:hidden" onClick={() => setSheetOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />Filters{activeCount ? ` (${activeCount})` : ""}
          </Button>
          <div className="hidden min-w-0 md:block">{filterControls(false)}</div>
        </div>
        {showTags && <div className="mt-2 hidden md:block">{tagControls}</div>}
      </div>

      {view === "board" ? (
        <div className="min-h-0 flex-1">
          <KanbanBoard enquiries={filtered} onOpen={openEnquiry} onToast={toast} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <EnquiriesTable enquiries={filtered} onOpen={openEnquiry} />
        </div>
      )}

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} side="bottom" title="Filters">
        <div className="space-y-4 p-4">
          {filterControls(true)}
          {tagControls}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</Button>
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>Show {filtered.length}</Button>
          </div>
        </div>
      </Sheet>

      <EnquiryDrawer enquiryId={openId} onClose={closeEnquiry} />
      {canCreate && <NewEnquiryDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); openEnquiry(id); }} />}
      {toastNode}
    </div>
  );
}
