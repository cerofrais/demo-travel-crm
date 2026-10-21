"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Gift, QrCode } from "lucide-react";
import { Avatar, Button, Card } from "@/components/ui";
import { EmptyState, Toggle } from "@/components/shared";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity, travellerById } from "@/lib/demo/queries";
import { copyToClipboard, formatDate } from "@/lib/utils";
import type { DemoData, Referral } from "@/lib/demo/types";

export function makeCode(fullName: string, existing: Set<string>): string {
  const base = `WISH-${fullName.replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "X")}`;
  let n = 5;
  let code = `${base}${n}`;
  while (existing.has(code)) code = `${base}${++n}`;
  return code;
}

export function referredEnquiries(db: DemoData, r: Referral) {
  const ids = new Set(r.referredEnquiryIds);
  for (const e of db.enquiries) {
    const t = travellerById(db, e.travellerId);
    if (t?.referredById === r.travellerId || (e.source === "referral" && e.campaign === r.code)) ids.add(e.id);
  }
  return db.enquiries.filter((e) => ids.has(e.id));
}

export function ReferralsTab({ db, me, canManage, onToast }: { db: DemoData; me: { sub: string; name: string }; canManage: boolean; onToast: (m: string) => void }) {
  const withCode = new Set(db.referrals.map((r) => r.travellerId));
  const candidates = db.travellers.filter((t) => !withCode.has(t.id) && db.trips.some((tr) => tr.status === "completed" && (tr.travellerId === t.id || tr.travellerIds.includes(t.id)))).slice(0, 8);

  const toggleActive = (r: Referral, v: boolean) => {
    mutateDb((d) => {
      const x = d.referrals.find((k) => k.id === r.id);
      if (x) x.active = v;
    });
    onToast(v ? "Code activated" : "Code paused");
  };
  const generate = (travellerId: string) => {
    mutateDb((d) => {
      const t = d.travellers.find((x) => x.id === travellerId);
      if (!t) return;
      const code = makeCode(t.fullName, new Set(d.referrals.map((r) => r.code)));
      d.referrals.unshift({ id: newId("ref"), code, travellerId, discountPct: 5, uses: 0, maxUses: 10, active: true, referredEnquiryIds: [], createdAt: nowIso() });
      t.referralCode = code;
      logActivity(d, { actor: me.name, actorKind: "user", type: "referral", text: `Generated referral code ${code} for ${t.fullName}`, travellerId });
    });
    onToast("Referral code generated");
  };
  const copyLink = async (code: string) => {
    const ok = await copyToClipboard(`https://wishtrip.co/r/${code}`);
    onToast(ok ? "Link copied" : "Could not copy");
  };

  return (
    <div className="space-y-4">
      {db.referrals.length === 0 ? (
        <EmptyState icon={Gift} title="No referral codes yet" hint="Generate one for a traveller who has completed a trip." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-secondary/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Code</th>
                  <th className="px-3 py-2 text-left font-semibold">Traveller</th>
                  <th className="px-3 py-2 text-right font-semibold">Discount</th>
                  <th className="px-3 py-2 text-right font-semibold">Uses</th>
                  <th className="px-3 py-2 text-left font-semibold">Referred enquiries</th>
                  <th className="px-3 py-2 text-left font-semibold">Active</th>
                  <th className="px-3 py-2 text-right font-semibold">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {db.referrals.map((r) => {
                  const t = travellerById(db, r.travellerId);
                  const refs = referredEnquiries(db, r);
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-secondary text-muted-foreground" title="QR (demo)">
                            <QrCode className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-mono text-sm font-semibold text-foreground">{r.code}</div>
                            <div className="text-[11px] text-muted-foreground">since {formatDate(r.createdAt)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={t?.fullName} className="h-7 w-7 text-[10px]" />
                          <Link href={`/travellers?traveller=${r.travellerId}`} className="hover:underline">
                            {t?.fullName ?? "—"}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.discountPct}%</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.uses}/{r.maxUses}
                      </td>
                      <td className="px-3 py-3">
                        {refs.length === 0 ? (
                          <span className="text-xs text-muted-foreground">None yet</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {refs.slice(0, 3).map((e) => (
                              <Link key={e.id} href={`/enquiries?enquiry=${e.id}`} className="rounded bg-saffron-100 px-1.5 py-0.5 text-[10px] font-semibold text-saffron-700 hover:underline">
                                {e.ref}
                              </Link>
                            ))}
                            {refs.length > 3 && <span className="text-[10px] text-muted-foreground">+{refs.length - 3}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Toggle checked={r.active} onChange={(v) => toggleActive(r, v)} disabled={!canManage} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => copyLink(r.code)}>
                          <Copy className="h-3.5 w-3.5" /> wishtrip.co/r/{r.code}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {canManage && candidates.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground">Travellers back from a trip without a code</h3>
          <p className="text-xs text-muted-foreground">Completed trips, no referral code yet. Generate one and the post-trip template fills {"{{code}}"} automatically.</p>
          <ul className="mt-3 divide-y divide-border">
            {candidates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={t.fullName} className="h-7 w-7 text-[10px]" />
                  <div className="min-w-0">
                    <div className="truncate text-sm">{t.fullName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.city} · {t.tripsCount} trip{t.tripsCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => generate(t.id)}>
                  <Gift className="h-3.5 w-3.5" /> Generate code
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
