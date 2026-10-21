"use client";

import * as React from "react";
import { AlertTriangle, Link2, Link2Off, Search, Users2 } from "lucide-react";
import type { DemoData, Enquiry } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { enquiryById, isOpen, logActivity, travellerById, userName } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { StageBadge } from "@/components/shared";
import { cn, relativeTime } from "@/lib/utils";
import type { Actor } from "./booking-actions";

/** Past this a "party" is a sign something went wrong, not a family. */
export const MAX_LINKED = 6;
export const PARTY_TAG = "travel-party";

export type LinkRefusal = "same-enquiry" | "already-linked" | "too-many" | "missing";

export const LINK_REFUSAL_MESSAGE: Record<LinkRefusal, string> = {
  "same-enquiry": "That is the same enquiry.",
  "already-linked": "These enquiries are already in the same party.",
  "too-many": `Up to ${MAX_LINKED} enquiries can travel as one party.`,
  missing: "That enquiry no longer exists.",
};

/** Every member of the party, including `enquiry` itself (oldest first). */
export function partyOf(db: DemoData, enquiry: Enquiry): Enquiry[] {
  if (!enquiry.linkGroupId) return [enquiry];
  return db.enquiries.filter((e) => e.linkGroupId === enquiry.linkGroupId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Distinct owners across a set — unassigned is not an owner. */
export function ownersOf(party: Enquiry[]): string[] {
  return [...new Set(party.map((e) => e.assignedTo).filter((s): s is string => Boolean(s)))];
}

/** Why two enquiries may not be joined, or null when they may. */
export function checkLink(db: DemoData, aId: string, bId: string): LinkRefusal | null {
  const a = enquiryById(db, aId);
  const b = enquiryById(db, bId);
  if (!a || !b) return "missing";
  if (a.id === b.id) return "same-enquiry";
  if (a.linkGroupId && a.linkGroupId === b.linkGroupId) return "already-linked";
  const size = partyOf(db, a).length + partyOf(db, b).length;
  if (size > MAX_LINKED) return "too-many";
  return null;
}

/** Join two enquiries (merging their parties when both already have one). Run inside mutateDb. */
export function linkEnquiries(db: DemoData, aId: string, bId: string, actor: Actor): LinkRefusal | null {
  const refusal = checkLink(db, aId, bId);
  if (refusal) return refusal;
  const a = enquiryById(db, aId)!;
  const b = enquiryById(db, bId)!;
  const gid = a.linkGroupId ?? b.linkGroupId ?? newId("party");
  const members = [...partyOf(db, a), ...partyOf(db, b)];
  const at = nowIso();
  for (const m of members) {
    m.linkGroupId = gid;
    if (!m.tags.includes(PARTY_TAG)) m.tags.push(PARTY_TAG);
    m.updatedAt = at;
    m.lastActivityAt = at;
  }
  const nameOf = (e: Enquiry) => travellerById(db, e.travellerId)?.fullName.split(" ")[0] ?? e.ref;
  for (const [self, other] of [[a, b], [b, a]] as const) {
    logActivity(db, { actor: actor.name, actorSub: actor.sub, actorKind: "user", type: "enquiries_linked", text: `Linked with ${nameOf(other)} (${other.ref}) as one travel party of ${members.length}`, enquiryId: self.id, travellerId: self.travellerId });
  }
  return null;
}

/** Take one enquiry out of its party; a party of one is dissolved. Run inside mutateDb. */
export function unlinkEnquiry(db: DemoData, id: string, actor: Actor): void {
  const e = enquiryById(db, id);
  if (!e?.linkGroupId) return;
  const rest = partyOf(db, e).filter((m) => m.id !== e.id);
  const at = nowIso();
  const drop = (m: Enquiry) => {
    delete m.linkGroupId;
    m.tags = m.tags.filter((t) => t !== PARTY_TAG);
    m.updatedAt = at;
  };
  drop(e);
  if (rest.length === 1) drop(rest[0]);
  logActivity(db, { actor: actor.name, actorSub: actor.sub, actorKind: "user", type: "enquiries_unlinked", text: `Removed from travel party (${rest.length} still linked)`, enquiryId: e.id, travellerId: e.travellerId });
}

/**
 * Who this enquiry travels with, and the way to add another member.
 * Families and friend groups message separately about the same trip; one
 * party keeps consultants from quoting twice.
 */
export function LinkedEnquiriesDialog({ enquiryId, onClose, onOpenEnquiry }: { enquiryId: string; onClose: () => void; onOpenEnquiry: (id: string) => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const actor = React.useMemo<Actor>(() => ({ sub: me.sub, name: me.name || "You" }), [me.sub, me.name]);
  const canEdit = can(me.role, "enquiries.work") || can(me.role, "enquiries.manage");
  const canReassign = can(me.role, "enquiries.manage");
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // No useMemo on db-derived values: the store mutates in place, so the
  // references never change and a memo would show the party before the link.
  const self = enquiryById(db, enquiryId);
  const party = self ? partyOf(db, self) : [];
  const owners = ownersOf(party);
  const splitOwners = owners.length > 1;

  const results = (() => {
    const q = query.trim().toLowerCase();
    if (!self || q.length < 2) return [];
    const digits = q.replace(/\D/g, "");
    const inParty = new Set(party.map((p) => p.id));
    return db.enquiries
      .filter((e) => !inParty.has(e.id) && isOpen(e))
      .filter((e) => {
        const t = travellerById(db, e.travellerId);
        return t?.fullName.toLowerCase().includes(q) || e.ref.toLowerCase().includes(q) || (digits.length >= 3 && (t?.phone ?? "").replace(/\D/g, "").includes(digits));
      })
      .slice(0, 8);
  })();

  function link(otherId: string) {
    if (!self) return;
    // Object holder: TS keeps a plain `let` narrowed to null across the closure.
    const out: { refusal: LinkRefusal | null } = { refusal: null };
    mutateDb((d) => {
      out.refusal = linkEnquiries(d, self.id, otherId, actor);
    });
    setError(out.refusal ? LINK_REFUSAL_MESSAGE[out.refusal] : null);
    if (!out.refusal) setQuery("");
  }

  function assignAll(sub: string) {
    if (!self) return;
    mutateDb((d) => {
      const at = nowIso();
      for (const m of partyOf(d, enquiryById(d, self.id)!)) {
        if (m.assignedTo === sub) continue;
        m.assignedTo = sub;
        m.updatedAt = at;
        logActivity(d, { actor: actor.name, actorSub: actor.sub, actorKind: "user", type: "assigned", text: `Assigned to ${userName(d, sub)} (whole travel party)`, enquiryId: m.id, travellerId: m.travellerId });
      }
    });
  }

  const title = (
    <span className="flex items-center gap-2"><Users2 className="h-4 w-4 text-brand-600" /> Travel party{party.length > 1 ? ` · ${party.length}` : ""}</span>
  );

  return (
    <Dialog open onClose={onClose} title={title} className="md:max-w-lg">
      <div className="space-y-4 p-4">
        {!self ? (
          <p className="text-sm text-muted-foreground">This enquiry no longer exists.</p>
        ) : party.length === 1 ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{travellerById(db, self.travellerId)?.fullName}</span> isn&apos;t linked to anyone yet. Find the family or friends messaging about the same trip below — each keeps their own conversation, but the party is quoted once.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {party.map((m) => {
              const t = travellerById(db, m.travellerId);
              const isSelf = m.id === self.id;
              return (
                <li key={m.id} className="flex items-center gap-2 px-3 py-2.5">
                  <button type="button" disabled={isSelf} onClick={() => onOpenEnquiry(m.id)} className={cn("min-w-0 flex-1 text-left", !isSelf && "hover:text-primary")}>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate text-sm font-medium text-foreground">{t?.fullName ?? "Unknown traveller"}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{m.ref}</span>
                      {isSelf && <span className="text-[11px] text-muted-foreground">(this one)</span>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <StageBadge stage={m.stage} className="text-[10px]" />
                      <span>{userName(db, m.assignedTo)}</span>
                      <span>· active {relativeTime(m.lastActivityAt)}</span>
                    </span>
                  </button>
                  {canEdit && (
                    <Button variant="ghost" size="sm" className="h-9 shrink-0 text-muted-foreground hover:text-rose-600" title="Unlink from the party" aria-label={`Unlink ${t?.fullName ?? m.ref}`} onClick={() => mutateDb((d) => unlinkEnquiry(d, m.id, actor))}>
                      <Link2Off className="h-4 w-4" /> Unlink
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {self && splitOwners && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <p className="flex items-start gap-1.5 font-medium"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />{owners.length} consultants are working this party — pick one owner?</p>
            {canReassign ? (
              <Select defaultValue="" onChange={(ev) => ev.target.value && assignAll(ev.target.value)} className="h-9 bg-card text-sm" aria-label="Assign the whole party to">
                <option value="" disabled>Assign all to…</option>
                {owners.map((sub) => <option key={sub} value={sub}>Assign all to {userName(db, sub)}</option>)}
              </Select>
            ) : (
              <p>Ask a manager to assign the whole party to one consultant.</p>
            )}
          </div>
        )}

        {self && canEdit && party.length < MAX_LINKED && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Add to the party</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(ev) => { setQuery(ev.target.value); setError(null); }} placeholder="Search open enquiries by name, phone or ref…" className="pl-9" autoFocus />
            </div>
            {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
            {query.trim().length >= 2 && results.length === 0 && <p className="py-1 text-sm text-muted-foreground">No open enquiries match.</p>}
            {results.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {results.map((r) => {
                  const t = travellerById(db, r.travellerId);
                  const size = partyOf(db, r).length;
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => link(r.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary">
                        <Link2 className="h-4 w-4 shrink-0 text-brand-600" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2"><span className="truncate text-sm font-medium">{t?.fullName ?? "Unknown"}</span><span className="font-mono text-[11px] text-muted-foreground">{r.ref}</span></span>
                          <span className="block truncate text-xs text-muted-foreground">{t?.phone} · {r.destination} · {userName(db, r.assignedTo)}{size > 1 ? ` · already a party of ${size} (will merge)` : ""}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {self && canEdit && party.length >= MAX_LINKED && <p className="text-xs text-muted-foreground">{LINK_REFUSAL_MESSAGE["too-many"]}</p>}
        {self && !canEdit && <p className="text-xs text-muted-foreground">Your role can view the party but not change it.</p>}
      </div>
    </Dialog>
  );
}
