"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, Bot, CheckSquare, FileText, History, Map, MessageCircle, Phone, Plane, Repeat, User as UserIcon, X, XCircle } from "lucide-react";
import type { EnquiryStage } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { enquiryById, travellerById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { STAGES, STAGE_MAP } from "@/lib/pipeline";
import { Button, ScoreBadge, ScrollableTabs, Select, Sheet } from "@/components/ui";
import { SourceBadge, StageBadge, useToast } from "@/components/shared";
import { formatINR } from "@/lib/utils";
import { ConversationPanel } from "@/components/conversation/conversation-panel";
import { CallsPanel } from "@/components/calls/calls-panel";
import { DocumentList } from "@/components/documents/document-list";
import { DetailsTab } from "./drawer-details";
import { ItineraryTab } from "./drawer-itinerary";
import { TripTab } from "./drawer-trip";
import { TasksTab } from "./drawer-tasks";
import { ActivityTab } from "./drawer-activity";
import { AssistPanel } from "./assist-panel";
import { LostReasonDialog } from "./lost-reason-dialog";
import { markLost, moveStage } from "./booking-actions";

type TabKey = "details" | "itinerary" | "conversation" | "assist" | "calls" | "trip" | "documents" | "tasks" | "activity";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "details", label: "Details", icon: <UserIcon className="h-4 w-4" /> },
  { key: "itinerary", label: "Itinerary", icon: <Map className="h-4 w-4" /> },
  { key: "conversation", label: "Conversation", icon: <MessageCircle className="h-4 w-4" /> },
  { key: "assist", label: "AI Assist", icon: <Bot className="h-4 w-4" /> },
  { key: "calls", label: "Calls", icon: <Phone className="h-4 w-4" /> },
  { key: "trip", label: "Trip & payments", icon: <Plane className="h-4 w-4" /> },
  { key: "documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
  { key: "tasks", label: "Tasks", icon: <CheckSquare className="h-4 w-4" /> },
  { key: "activity", label: "Activity", icon: <History className="h-4 w-4" /> },
];

/**
 * Right-side enquiry detail sheet. Cross-area contract: other pages render
 * `<EnquiryDrawer enquiryId={id} onClose={…} />` (or link to `/enquiries?enquiry=<id>`).
 */
export function EnquiryDrawer({ enquiryId, onClose }: { enquiryId: string | null; onClose: () => void }) {
  const db = useDb();
  const me = useCurrentUser();
  const { toast, node: toastNode } = useToast();
  const [tab, setTab] = React.useState<TabKey>("details");
  const [lostOpen, setLostOpen] = React.useState(false);

  React.useEffect(() => {
    setTab("details");
    setLostOpen(false);
  }, [enquiryId]);

  const e = enquiryById(db, enquiryId);
  const traveller = travellerById(db, e?.travellerId);
  const dest = e ? db.destinations.find((d) => d.id === e.destinationId) : undefined;
  const actor = React.useMemo(() => ({ sub: me.sub, name: me.name || "You" }), [me.sub, me.name]);
  const canEdit = can(me.role, "enquiries.work") || can(me.role, "enquiries.manage");
  const canReassign = can(me.role, "enquiries.manage");
  const canItin = canEdit && can(me.role, "itineraries.edit");
  const canTasks = can(me.role, "tasks.manage");
  const canMessage = can(me.role, "messaging.send");

  function changeStage(stage: EnquiryStage) {
    if (!e || stage === e.stage) return;
    if (stage === "lost") {
      setLostOpen(true);
      return;
    }
    const hadTrip = Boolean(e.tripId);
    mutateDb((d) => moveStage(d, e.id, stage, actor));
    const after = enquiryById(db, e.id);
    if (stage === "advance_paid" && !hadTrip && after?.tripId) {
      toast(`Booking ${db.trips.find((t) => t.id === after.tripId)?.ref ?? ""} created`);
      setTab("trip");
    } else toast(`Moved to ${STAGE_MAP[stage].label}`);
  }

  const open = Boolean(enquiryId);
  const stageDef = e ? STAGE_MAP[e.stage] : undefined;

  return (
    <Sheet open={open} onClose={onClose} side="right" widthClassName="w-full max-w-3xl" scrollBody={false} ariaLabel={traveller ? `Enquiry ${e?.ref} — ${traveller.fullName}` : "Enquiry"}>
      {!e ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Enquiry</span>
            <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary lg:h-9 lg:w-9"><X className="h-5 w-5" /></button>
          </div>
          <p className="p-6 text-sm text-muted-foreground">This enquiry no longer exists (the demo data may have been reset).</p>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <header className="shrink-0 border-b border-border bg-card px-4 pt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-semibold leading-tight">{traveller?.fullName ?? "Unknown traveller"}</h2>
                  <span className="font-mono text-xs text-muted-foreground">{e.ref}</span>
                  <StageBadge stage={e.stage} />
                  <SourceBadge source={e.source} />
                  {traveller && traveller.tripsCount > 0 && <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"><Repeat className="h-3 w-3" />Repeat · {traveller.tripsCount} trip{traveller.tripsCount === 1 ? "" : "s"}</span>}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{traveller?.phone}</span>
                  {traveller?.city && <span>· {traveller.city}</span>}
                  <span>· {dest?.emoji} {e.destination} · {e.nights}N · {formatINR(e.budgetINR, { compact: true })}</span>
                  <span className="inline-flex items-center gap-1">· AI score <ScoreBadge score={e.aiScore} /></span>
                  {e.needsAttention && <span className="inline-flex items-center gap-1 text-amber-700"><Activity className="h-3 w-3" />needs attention</span>}
                </p>
              </div>
              <button onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary lg:h-9 lg:w-9"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 pb-3">
              {traveller && can(me.role, "inbox.view") && (
                <Link href={`/inbox?thread=${traveller.id}:whatsapp`}><Button size="sm" variant="secondary"><MessageCircle className="h-4 w-4 text-green-600" />WhatsApp</Button></Link>
              )}
              <Button size="sm" variant="outline" onClick={() => setTab("calls")}><Phone className="h-4 w-4" />Call</Button>
              {canEdit && e.stage !== "lost" && !["completed", "non_lead"].includes(e.stage) && (
                <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setLostOpen(true)}><XCircle className="h-4 w-4" />Mark lost</Button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">Stage</span>
                <Select value={e.stage} onChange={(ev) => changeStage(ev.target.value as EnquiryStage)} disabled={!canEdit} className="h-9 w-auto text-sm" aria-label="Stage" title={stageDef?.description}>
                  {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </div>
            </div>
            {e.stage === "lost" && e.lostReason && <p className="-mt-1 pb-2 text-xs text-rose-700">Lost: {e.lostReason}</p>}
          </header>

          <ScrollableTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} className="shrink-0 bg-card" />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "details" && <DetailsTab enquiry={e} actor={actor} canEdit={canEdit} canReassign={canReassign} onSaved={toast} />}
            {tab === "itinerary" && <ItineraryTab enquiry={e} actor={actor} canEdit={canItin} onToast={toast} />}
            {tab === "conversation" && traveller && (
              <div className="h-full min-h-[60vh] p-3">
                <ConversationPanel travellerId={traveller.id} enquiryId={e.id} className="h-full" />
              </div>
            )}
            {tab === "assist" && <AssistPanel enquiry={e} actor={actor} canAct={canEdit && canMessage} onToast={toast} />}
            {tab === "calls" && <div className="p-4"><CallsPanel enquiryId={e.id} /></div>}
            {tab === "trip" && <TripTab enquiry={e} />}
            {tab === "documents" && <div className="p-4"><DocumentList enquiryId={e.id} travellerId={e.travellerId} compact /></div>}
            {tab === "tasks" && <TasksTab enquiry={e} actor={actor} canEdit={canTasks} onToast={toast} />}
            {tab === "activity" && <ActivityTab enquiry={e} />}
          </div>
        </div>
      )}

      <LostReasonDialog
        open={lostOpen && Boolean(e)}
        travellerName={traveller?.fullName}
        onClose={() => setLostOpen(false)}
        onConfirm={(reason) => {
          if (e) mutateDb((d) => markLost(d, e.id, reason, actor));
          setLostOpen(false);
          toast("Marked as lost");
        }}
      />
      {toastNode}
    </Sheet>
  );
}
