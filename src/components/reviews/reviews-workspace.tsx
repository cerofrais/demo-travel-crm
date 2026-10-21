"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Gift, Globe, MessageSquareReply, RefreshCw, Send, Star, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Avatar, Badge, Button, Card, Dialog, ScrollableTabs, Textarea } from "@/components/ui";
import { EmptyState, StatCard, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity, travellerById, tripById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { cn, formatDate, relativeTime } from "@/lib/utils";
import type { Review } from "@/lib/demo/types";
import { ReferralsTab, referredEnquiries } from "./referrals-tab";

const STATUS_CLASS: Record<Review["status"], string> = {
  requested: "bg-amber-100 text-amber-800",
  received: "bg-sky-100 text-sky-800",
  published: "bg-emerald-100 text-emerald-800",
  resolution: "bg-rose-100 text-rose-700",
};
const PLATFORM_CLASS: Record<Review["platform"], string> = {
  google: "bg-sky-100 text-sky-800",
  instagram: "bg-pink-100 text-pink-700",
  internal: "bg-zinc-100 text-zinc-700",
};

function Stars({ n }: { n: number }) {
  if (!n) return <span className="text-xs text-muted-foreground">awaiting</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-3.5 w-3.5", i <= n ? "fill-saffron-400 text-saffron-400" : "text-border")} />
      ))}
    </span>
  );
}

export function ReviewsWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const { toast, node } = useToast();
  const canManage = can(me.role, "travellers.manage");
  const [tab, setTab] = React.useState<"reviews" | "referrals">("reviews");
  const [replying, setReplying] = React.useState<Review | null>(null);
  const [replyText, setReplyText] = React.useState("");

  const ninety = Date.now() - 90 * 86400000;
  const rated = db.reviews.filter((r) => r.rating > 0);
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
  const received90 = db.reviews.filter((r) => r.rating > 0 && new Date(r.at).getTime() >= ninety).length;
  const published = db.reviews.filter((r) => r.status === "published").length;
  const openRes = db.reviews.filter((r) => r.status === "resolution").length;
  const activeCodes = db.referrals.filter((r) => r.active).length;
  const referred = new Set(db.referrals.flatMap((r) => referredEnquiries(db, r).map((e) => e.id))).size;

  const reviews = [...db.reviews].sort((a, b) => b.at.localeCompare(a.at));

  const resend = (r: Review) => {
    mutateDb((d) => {
      const t = d.travellers.find((x) => x.id === r.travellerId);
      const trip = d.trips.find((x) => x.id === r.tripId);
      const tpl = d.templates.find((x) => x.id === "tpl_review");
      if (t) {
        const body = (tpl?.body ?? "Welcome home {{first_name}}! How was {{destination}}? Rate us 1–5.").replace("{{first_name}}", t.fullName.split(" ")[0]).replace("{{destination}}", trip?.destination ?? "your trip").replace("{{code}}", t.referralCode ?? "WISH5");
        d.messages.push({ id: newId("msg"), travellerId: t.id, enquiryId: trip?.enquiryId, channel: t.preferredChannel === "instagram" ? "instagram" : "whatsapp", direction: "outbound", body, at: nowIso(), sentBy: me.sub, status: "sent", templateId: tpl?.id });
        if (tpl) tpl.usageCount += 1;
      }
      logActivity(d, { actor: me.name, actorKind: "user", type: "review_request", text: `Re-sent review request to ${t?.fullName ?? "traveller"}`, travellerId: r.travellerId, tripId: r.tripId });
    });
    toast("Review request sent on WhatsApp");
  };
  const markPublished = (r: Review) => {
    mutateDb((d) => {
      const x = d.reviews.find((k) => k.id === r.id);
      if (!x) return;
      x.status = "published";
      if (x.platform === "internal") x.platform = "google";
      logActivity(d, { actor: me.name, actorKind: "user", type: "review", text: `Marked ${x.rating}★ review as published on ${x.platform}`, travellerId: r.travellerId, tripId: r.tripId });
    });
    toast("Marked published");
  };
  const openResolution = (r: Review) => {
    const t = travellerById(db, r.travellerId);
    const trip = tripById(db, r.tripId);
    mutateDb((d) => {
      const x = d.reviews.find((k) => k.id === r.id);
      if (x) x.status = "resolution";
      d.tasks.unshift({ id: newId("task"), title: `Resolve ${r.rating || "low"}★ feedback — ${t?.fullName ?? "traveller"}`, kind: "review", enquiryId: trip?.enquiryId, tripId: r.tripId, travellerId: r.travellerId, assignedTo: trip?.tripCaptain ?? me.sub, dueAt: new Date(Date.now() + 86400000).toISOString(), status: "open", priority: "high", createdBy: me.sub, createdAt: nowIso(), notes: r.text });
      logActivity(d, { actor: me.name, actorKind: "user", type: "task_created", text: `Opened resolution task for ${t?.fullName ?? "traveller"}'s ${r.rating}★ review`, travellerId: r.travellerId, tripId: r.tripId });
    });
    toast("Resolution task created");
  };
  const saveReply = () => {
    if (!replying) return;
    mutateDb((d) => {
      const x = d.reviews.find((k) => k.id === replying.id);
      if (!x) return;
      x.responseText = replyText.trim();
      if (x.status === "received") x.status = "published";
      logActivity(d, { actor: me.name, actorKind: "user", type: "review", text: `Replied to ${x.rating}★ review`, travellerId: x.travellerId, tripId: x.tripId });
    });
    setReplying(null);
    toast("Reply saved");
  };

  return (
    <>
      <PageHeader title="Reviews & Referrals" subtitle="Close the loop after every trip — ratings, public reviews and referral codes." />
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Avg rating" value={avg ? avg.toFixed(1) : "—"} icon={Star} tint="text-saffron-400" hint={`${rated.length} rated`} />
          <StatCard label="Reviews · 90d" value={received90} icon={MessageSquareReply} />
          <StatCard label="Published" value={published} icon={Globe} tint="text-emerald-500" hint="Google + Instagram" />
          <StatCard label="Open resolutions" value={openRes} icon={AlertCircle} tint="text-rose-500" />
          <StatCard label="Active codes" value={activeCodes} icon={Gift} tint="text-clay-500" />
          <StatCard label="Referred enquiries" value={referred} icon={Users} />
        </div>

        <ScrollableTabs tabs={[{ key: "reviews", label: `Reviews (${db.reviews.length})` }, { key: "referrals", label: `Referrals (${db.referrals.length})` }]} active={tab} onChange={(k) => setTab(k as "reviews" | "referrals")} />

        {tab === "reviews" &&
          (reviews.length === 0 ? (
            <EmptyState icon={Star} title="No reviews yet" hint="Reviews are requested automatically 48h after a trip ends." />
          ) : (
            <Card className="divide-y divide-border">
              {reviews.map((r) => {
                const t = travellerById(db, r.travellerId);
                const trip = tripById(db, r.tripId);
                return (
                  <div key={r.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <Avatar name={t?.fullName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/travellers?traveller=${r.travellerId}`} className="text-sm font-semibold hover:underline">
                            {t?.fullName ?? "—"}
                          </Link>
                          {trip && (
                            <Link href={`/trips/${trip.id}`} className="text-xs text-primary hover:underline">
                              {trip.ref} · {trip.destination}
                            </Link>
                          )}
                          <Stars n={r.rating} />
                          <Badge className={cn("capitalize", PLATFORM_CLASS[r.platform])}>{r.platform}</Badge>
                          <Badge className={cn("capitalize", STATUS_CLASS[r.status])}>{r.status}</Badge>
                        </div>
                        {r.text && <p className="mt-1 text-sm text-foreground/90">&ldquo;{r.text}&rdquo;</p>}
                        {r.responseText && (
                          <p className="mt-1 rounded-md bg-brand-50 px-2 py-1 text-xs text-brand-900">
                            <span className="font-semibold">wishtrip replied:</span> {r.responseText}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground" title={formatDate(r.at, "long")}>
                          {r.status === "requested" ? "Requested" : "Received"} {relativeTime(r.at)}
                        </p>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex flex-wrap gap-1.5 md:justify-end">
                        {r.status === "requested" && (
                          <Button size="sm" variant="outline" onClick={() => resend(r)}>
                            <RefreshCw className="h-3.5 w-3.5" /> Resend request
                          </Button>
                        )}
                        {r.rating >= 4 && r.status !== "published" && (
                          <Button size="sm" variant="outline" onClick={() => markPublished(r)}>
                            <Globe className="h-3.5 w-3.5" /> Mark published
                          </Button>
                        )}
                        {r.rating > 0 && r.rating <= 3 && r.status !== "resolution" && (
                          <Button size="sm" variant="outline" onClick={() => openResolution(r)}>
                            <AlertCircle className="h-3.5 w-3.5" /> Open resolution task
                          </Button>
                        )}
                        {r.rating > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplying(r);
                              setReplyText(r.responseText ?? "");
                            }}
                          >
                            <Send className="h-3.5 w-3.5" /> {r.responseText ? "Edit reply" : "Reply"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          ))}

        {tab === "referrals" && <ReferralsTab db={db} me={me} canManage={canManage} onToast={toast} />}

        <Card className="p-4">
          <p className="text-sm font-semibold text-foreground">The post-trip loop</p>
          <ol className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <li className="rounded-lg bg-secondary/60 p-3"><span className="font-semibold text-foreground">Return +48h.</span> The follow-up agent sends the review template on WhatsApp.</li>
            <li className="rounded-lg bg-secondary/60 p-3"><span className="font-semibold text-foreground">Rating comes back.</span> A 1–5 reply is parsed into the review record.</li>
            <li className="rounded-lg bg-secondary/60 p-3"><span className="font-semibold text-foreground">4–5★.</span> Traveller gets a Google / Instagram link plus a referral code (5% off for friends, ₹2,000 for them).</li>
            <li className="rounded-lg bg-secondary/60 p-3"><span className="font-semibold text-foreground">1–3★.</span> A resolution task goes to the trip captain within a day; nothing is published.</li>
          </ol>
        </Card>
      </div>

      <Dialog open={!!replying} onClose={() => setReplying(null)} title="Reply to review">
        <div className="space-y-3 p-4">
          {replying?.text && <p className="rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">&ldquo;{replying.text}&rdquo;</p>}
          <Textarea rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Thank you for travelling with wishtrip…" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReplying(null)}>
              Cancel
            </Button>
            <Button onClick={saveReply} disabled={!replyText.trim()}>
              Save reply
            </Button>
          </div>
        </div>
      </Dialog>
      {node}
    </>
  );
}
