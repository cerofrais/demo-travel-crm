"use client";

import * as React from "react";
import { Download, Printer } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button, Input, ScrollableTabs, Select } from "@/components/ui";
import { useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { can } from "@/lib/rbac";
import { downloadText, formatDate, toCsv, toDateInput } from "@/lib/utils";
import { buildCtx, rangeBounds, type RangeKey } from "./report-helpers";
import { buildFunnel, FunnelTab } from "./report-funnel";
import { buildSources, SourcesTab } from "./report-sources";
import { buildDestinations, DestinationsTab } from "./report-destinations";
import { buildConsultants, ConsultantsTab } from "./report-consultants";
import { buildRevenue, RevenueTab } from "./report-revenue";

type Tab = "funnel" | "sources" | "destinations" | "consultants" | "revenue";

export function ReportsWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const { toast, node } = useToast();
  const canAll = can(me.role, "reports.all");
  const [tab, setTab] = React.useState<Tab>("funnel");
  const [range, setRange] = React.useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = React.useState(toDateInput(new Date(Date.now() - 30 * 86400000)));
  const [customTo, setCustomTo] = React.useState(toDateInput(new Date()));
  const [consultant, setConsultant] = React.useState(me.role === "SALES" ? me.sub : "");

  const { from, to } = React.useMemo(() => rangeBounds(range, customFrom, customTo), [range, customFrom, customTo]);
  const ctx = React.useMemo(() => buildCtx(db, from, to, consultant, canAll), [db, from, to, consultant, canAll]);

  const data = React.useMemo(() => {
    switch (tab) {
      case "funnel":
        return { kind: "funnel" as const, d: buildFunnel(ctx) };
      case "sources":
        return { kind: "sources" as const, d: buildSources(ctx) };
      case "destinations":
        return { kind: "destinations" as const, d: buildDestinations(ctx) };
      case "consultants":
        return { kind: "consultants" as const, d: buildConsultants(ctx) };
      default:
        return { kind: "revenue" as const, d: buildRevenue(ctx) };
    }
  }, [tab, ctx]);

  const exportCsv = () => {
    const csv = toCsv(data.d.table as Record<string, unknown>[]);
    if (!csv) return toast("Nothing to export");
    downloadText(`wishtrip-${tab}-${toDateInput(from)}_${toDateInput(to)}.csv`, csv, "text/csv");
    toast("CSV downloaded");
  };

  const consultants = db.users.filter((u) => (u.role === "SALES" || u.role === "MANAGER") && u.active);

  return (
    <>
      <PageHeader title="Reports" subtitle={`${formatDate(from)} – ${formatDate(to)}${consultant ? ` · ${db.users.find((u) => u.sub === consultant)?.name ?? ""}` : " · all consultants"}`}>
        <div className="no-print flex flex-wrap items-center gap-2">
          <Select value={range} onChange={(e) => setRange(e.target.value as RangeKey)} className="w-auto" aria-label="Range">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
            <option value="custom">Custom…</option>
          </Select>
          {range === "custom" && (
            <>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-auto" aria-label="From" />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-auto" aria-label="To" />
            </>
          )}
          <Select value={consultant} onChange={(e) => setConsultant(e.target.value)} className="w-auto" aria-label="Consultant" disabled={me.role === "SALES"}>
            <option value="">All consultants</option>
            {consultants.map((u) => (
              <option key={u.sub} value={u.sub}>
                {u.name}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => window.print()} aria-label="Print">
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Print</span>
          </Button>
          <Button variant="outline" onClick={exportCsv} aria-label="Export CSV">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </PageHeader>
      <div className="space-y-6 p-4 md:p-6">
        <ScrollableTabs
          className="no-print"
          tabs={[
            { key: "funnel", label: "Funnel" },
            { key: "sources", label: "Sources" },
            { key: "destinations", label: "Destinations" },
            { key: "consultants", label: "Consultants" },
            { key: "revenue", label: "Revenue" },
          ]}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
        />
        {data.kind === "funnel" && <FunnelTab data={data.d} />}
        {data.kind === "sources" && <SourcesTab data={data.d} />}
        {data.kind === "destinations" && <DestinationsTab data={data.d} />}
        {data.kind === "consultants" && <ConsultantsTab data={data.d} />}
        {data.kind === "revenue" && <RevenueTab data={data.d} />}
        <p className="text-[11px] text-muted-foreground">Enquiries are counted by creation date, bookings by booking date. Demo data regenerates relative to today.</p>
      </div>
      {node}
    </>
  );
}
