"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Plus, Search, LayoutGrid, List, MapPin, Phone } from "lucide-react";
import type { SupplierType } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { destinationById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { SUPPLIER_TYPE_LABEL } from "@/lib/pipeline";
import { cn, formatINR } from "@/lib/utils";
import { Badge, Button, Card, Input, Select } from "@/components/ui";
import { EmptyState, StatCard, useToast } from "@/components/shared";
import { PageHeader } from "@/components/app/page-header";
import { SupplierSheet, NewSupplierDialog, Stars, SUPPLIER_TYPE_CLASS } from "./supplier-sheet";

export function SuppliersWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const router = useRouter();
  const params = useSearchParams();
  const { toast, node } = useToast();
  const openId = params.get("supplier");
  const manage = can(me.role, "suppliers.manage");
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<"" | SupplierType>("");
  const [destination, setDestination] = React.useState("");
  const [view, setView] = React.useState<"cards" | "table">("cards");
  const [newOpen, setNewOpen] = React.useState(false);

  React.useEffect(() => {
    if (window.innerWidth >= 1024) setView("table");
  }, []);

  const list = db.suppliers
    .filter((s) => !type || s.type === type)
    .filter((s) => !destination || s.destinationId === destination)
    .filter((s) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return [s.name, s.city, s.contactName, s.email, s.phone, ...s.tags].some((x) => x?.toLowerCase().includes(needle));
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || b.bookingsCount - a.bookingsCount);

  const payable = db.suppliers.reduce((s, x) => s + x.payableINR, 0);
  const open = (id: string) => router.push(`/suppliers?supplier=${id}`);

  return (
    <>
      {node}
      <PageHeader title="Suppliers" subtitle="Hotels, DMCs, transport, activities, visa and insurance partners.">
        {manage && (
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New supplier
          </Button>
        )}
      </PageHeader>

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active suppliers" value={db.suppliers.filter((s) => s.active).length} icon={Building2} />
          <StatCard label="Payable" value={formatINR(payable, { compact: true })} tint="text-amber-600" hint={`${db.suppliers.filter((s) => s.payableINR > 0).length} with balance`} />
          <StatCard label="Hotels & stays" value={db.suppliers.filter((s) => s.type === "hotel").length} />
          <StatCard label="Avg rating" value={(db.suppliers.reduce((s, x) => s + x.rating, 0) / Math.max(1, db.suppliers.length)).toFixed(1)} tint="text-saffron-400" />
        </div>

        <Card className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, city, contact or tag" className="pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <Select value={type} onChange={(e) => setType(e.target.value as SupplierType | "")} className="md:w-48">
              <option value="">All types</option>
              {(Object.keys(SUPPLIER_TYPE_LABEL) as SupplierType[]).map((t) => (
                <option key={t} value={t}>
                  {SUPPLIER_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
            <Select value={destination} onChange={(e) => setDestination(e.target.value)} className="md:w-44">
              <option value="">All destinations</option>
              {db.destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.emoji} {d.name}
                </option>
              ))}
            </Select>
            <div className="hidden overflow-hidden rounded-md border border-border md:flex">
              <button type="button" onClick={() => setView("cards")} className={cn("flex h-9 w-10 items-center justify-center", view === "cards" ? "bg-secondary text-foreground" : "text-muted-foreground")} aria-label="Cards">
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setView("table")} className={cn("flex h-9 w-10 items-center justify-center", view === "table" ? "bg-secondary text-foreground" : "text-muted-foreground")} aria-label="Table">
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </Card>

        {list.length === 0 ? (
          <EmptyState icon={Building2} title="No suppliers match" />
        ) : view === "cards" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => {
              const dest = destinationById(db, s.destinationId);
              return (
                <Card key={s.id} className={cn("p-4 transition-shadow hover:shadow-md", !s.active && "opacity-60")}>
                  <button type="button" onClick={() => open(s.id)} className="block w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {s.city}
                          {dest && ` · ${dest.emoji} ${dest.name}`}
                        </p>
                      </div>
                      <Badge className={SUPPLIER_TYPE_CLASS[s.type]}>{SUPPLIER_TYPE_LABEL[s.type]}</Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <Stars rating={s.rating} />
                      <span className="text-xs text-muted-foreground">{s.bookingsCount} bookings</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.ratesNote}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" /> {s.contactName}
                      </span>
                      <span className={cn("font-semibold", s.payableINR > 0 ? "text-amber-700" : "text-emerald-700")}>{s.payableINR > 0 ? `Payable ${formatINR(s.payableINR, { compact: true })}` : "Settled"}</span>
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-secondary/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-semibold">Supplier</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Destination</th>
                  <th className="px-3 py-2 font-semibold">Contact</th>
                  <th className="px-3 py-2 font-semibold">Rating</th>
                  <th className="px-3 py-2 font-semibold">Terms</th>
                  <th className="px-3 py-2 text-right font-semibold">Payable</th>
                  <th className="px-3 py-2 text-right font-semibold">Bookings</th>
                  <th className="px-3 py-2 font-semibold">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((s) => {
                  const dest = destinationById(db, s.destinationId);
                  return (
                    <tr key={s.id} onClick={() => open(s.id)} className={cn("cursor-pointer hover:bg-secondary/50", !s.active && "opacity-60")}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.city}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className={SUPPLIER_TYPE_CLASS[s.type]}>{SUPPLIER_TYPE_LABEL[s.type]}</Badge>
                      </td>
                      <td className="px-3 py-2.5">{dest ? `${dest.emoji} ${dest.name}` : "—"}</td>
                      <td className="px-3 py-2.5">
                        <p>{s.contactName}</p>
                        <p className="text-xs text-muted-foreground">{s.phone}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Stars rating={s.rating} />
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-muted-foreground" title={`${s.paymentTerms} · ${s.ratesNote}`}>
                        {s.paymentTerms}
                      </td>
                      <td className={cn("px-3 py-2.5 text-right font-semibold tabular-nums", s.payableINR > 0 ? "text-amber-700" : "text-muted-foreground")}>{formatINR(s.payableINR)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.bookingsCount}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-block h-2.5 w-2.5 rounded-full", s.active ? "bg-emerald-500" : "bg-zinc-300")} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <SupplierSheet supplierId={openId} onClose={() => router.push("/suppliers")} onToast={toast} />
      <NewSupplierDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => { toast("Supplier added"); open(id); }} />
    </>
  );
}
