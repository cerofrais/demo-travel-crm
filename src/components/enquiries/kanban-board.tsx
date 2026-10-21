"use client";

import * as React from "react";
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { ArrowRightLeft, Inbox } from "lucide-react";
import type { DemoData, Enquiry, EnquiryStage } from "@/lib/demo/types";
import { mutateDb } from "@/lib/demo/store";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { can } from "@/lib/rbac";
import { STAGES, STAGE_MAP, stageLabel, type StageDef } from "@/lib/pipeline";
import { Button, HorizontalScrollbar, Select, Sheet } from "@/components/ui";
import { cn, formatINR } from "@/lib/utils";
import { EnquiryCard } from "./enquiry-card";
import { LostReasonDialog } from "./lost-reason-dialog";
import { markLost, moveStage } from "./booking-actions";

const BOARD_STAGES = STAGES.filter((s) => s.board);

/** True below Tailwind's `md` breakpoint (phones). */
export function useIsPhone(): boolean {
  const [phone, setPhone] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}

export interface KanbanBoardProps {
  enquiries: Enquiry[];
  onOpen: (id: string) => void;
  onToast?: (msg: string) => void;
}

export function KanbanBoard({ enquiries, onOpen, onToast }: KanbanBoardProps) {
  const db = useDb();
  const me = useCurrentUser();
  const canDrag = can(me.role, "enquiries.work") || can(me.role, "enquiries.manage");
  const phone = useIsPhone();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [lostFor, setLostFor] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStage = React.useMemo(() => {
    const map = new Map<EnquiryStage, Enquiry[]>();
    for (const s of BOARD_STAGES) map.set(s.id, []);
    for (const e of enquiries) map.get(e.stage)?.push(e);
    for (const list of map.values()) list.sort((a, b) => Number(b.needsAttention) - Number(a.needsAttention) || b.lastActivityAt.localeCompare(a.lastActivityAt));
    return map;
  }, [enquiries]);

  const actor = React.useMemo(() => ({ sub: me.sub, name: me.name || "You" }), [me.sub, me.name]);

  const applyMove = React.useCallback(
    (enquiryId: string, stage: EnquiryStage) => {
      const e = db.enquiries.find((x) => x.id === enquiryId);
      if (!e || e.stage === stage) return;
      if (stage === "lost") {
        setLostFor(enquiryId);
        return;
      }
      const hadTrip = Boolean(e.tripId);
      mutateDb((d) => moveStage(d, enquiryId, stage, actor));
      const after = db.enquiries.find((x) => x.id === enquiryId);
      if (stage === "advance_paid" && !hadTrip && after?.tripId) {
        const trip = db.trips.find((t) => t.id === after.tripId);
        onToast?.(`Booking ${trip?.ref ?? ""} created — advance marked paid`);
      } else onToast?.(`Moved to ${stageLabel(stage)}`);
    },
    [db, actor, onToast],
  );

  function onDragStart(ev: DragStartEvent) {
    setActiveId(String(ev.active.id));
  }
  function onDragEnd(ev: DragEndEvent) {
    setActiveId(null);
    const over = ev.over?.id;
    if (!over) return;
    applyMove(String(ev.active.id), String(over) as EnquiryStage);
  }

  const activeEnquiry = activeId ? db.enquiries.find((e) => e.id === activeId) : undefined;
  const lostEnquiry = lostFor ? db.enquiries.find((e) => e.id === lostFor) : undefined;
  const lostTraveller = lostEnquiry ? db.travellers.find((t) => t.id === lostEnquiry.travellerId) : undefined;

  const lostDialog = (
    <LostReasonDialog
      open={Boolean(lostFor)}
      travellerName={lostTraveller?.fullName}
      onClose={() => setLostFor(null)}
      onConfirm={(reason) => {
        if (lostFor) mutateDb((d) => markLost(d, lostFor, reason, actor));
        setLostFor(null);
        onToast?.("Marked as lost");
      }}
    />
  );

  if (phone) {
    return (
      <>
        <MobileBoard db={db} byStage={byStage} onOpen={onOpen} canMove={canDrag} onMove={applyMove} />
        {lostDialog}
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full min-w-max gap-3 px-4 pb-2 pt-3 md:px-6">
            {BOARD_STAGES.map((s) => (
              <Column key={s.id} stage={s} db={db} items={byStage.get(s.id) ?? []} onOpen={onOpen} canDrag={canDrag} activeId={activeId} />
            ))}
          </div>
        </div>
        <HorizontalScrollbar targetRef={scrollRef} className="mx-4 mb-2 md:mx-6" />
        <DragOverlay dropAnimation={null}>
          {activeEnquiry ? <div className="w-[256px]"><EnquiryCard enquiry={activeEnquiry} db={db} overlay /></div> : null}
        </DragOverlay>
      </DndContext>
      {lostDialog}
    </div>
  );
}

function Column({ stage, db, items, onOpen, canDrag, activeId }: { stage: StageDef; db: DemoData; items: Enquiry[]; onOpen: (id: string) => void; canDrag: boolean; activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, disabled: !canDrag });
  const total = items.reduce((s, e) => s + e.budgetINR, 0);
  const attention = items.filter((e) => e.needsAttention).length;
  return (
    <section
      ref={setNodeRef}
      aria-label={stage.label}
      className={cn(
        "flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/40 transition-colors",
        isOver && activeId && "border-primary/60 bg-brand-50/60 ring-2 ring-primary/30",
      )}
    >
      <div className={cn("h-1 shrink-0", stage.accent)} />
      <header className="shrink-0 border-b border-border/60 px-3 py-2" title={stage.description}>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-foreground">{stage.label}</span>
          <span className="flex items-center gap-1">
            {attention > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800" title={`${attention} need attention`}>{attention}</span>}
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border">{items.length}</span>
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{items.length ? formatINR(total, { compact: true }) : "—"}</div>
      </header>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {items.map((e) => (
          <DraggableCard key={e.id} enquiry={e} db={db} onOpen={onOpen} disabled={!canDrag} ghost={activeId === e.id} />
        ))}
        {items.length === 0 && (
          <div className={cn("flex h-24 flex-col items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground", isOver && activeId && "border-primary text-primary")}>
            <Inbox className="mb-1 h-4 w-4 opacity-60" />
            {activeId ? "Drop here" : "Nothing here"}
          </div>
        )}
      </div>
    </section>
  );
}

function DraggableCard({ enquiry, db, onOpen, disabled, ghost }: { enquiry: Enquiry; db: DemoData; onOpen: (id: string) => void; disabled: boolean; ghost: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: enquiry.id, disabled });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn(!disabled && "touch-none")}>
      <EnquiryCard enquiry={enquiry} db={db} onOpen={onOpen} ghost={ghost} />
    </div>
  );
}

/** Phone layout: one stage at a time with a selector and a "Move to stage" bottom sheet. */
function MobileBoard({ db, byStage, onOpen, canMove, onMove }: { db: DemoData; byStage: Map<EnquiryStage, Enquiry[]>; onOpen: (id: string) => void; canMove: boolean; onMove: (id: string, stage: EnquiryStage) => void }) {
  const [stage, setStage] = React.useState<EnquiryStage>(() => BOARD_STAGES.find((s) => (byStage.get(s.id)?.length ?? 0) > 0)?.id ?? "new");
  const [moving, setMoving] = React.useState<string | null>(null);
  const items = byStage.get(stage) ?? [];
  const def = STAGE_MAP[stage];
  const movingEnquiry = moving ? db.enquiries.find((e) => e.id === moving) : undefined;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-1 border-b border-border bg-card px-4 py-2">
        <Select value={stage} onChange={(e) => setStage(e.target.value as EnquiryStage)} aria-label="Stage">
          {BOARD_STAGES.map((s) => (
            <option key={s.id} value={s.id}>{s.label} ({byStage.get(s.id)?.length ?? 0})</option>
          ))}
        </Select>
        <p className="text-[11px] text-muted-foreground">{def.description} · {formatINR(items.reduce((s, e) => s + e.budgetINR, 0), { compact: true })}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {items.map((e) => (
          <EnquiryCard
            key={e.id}
            enquiry={e}
            db={db}
            onOpen={onOpen}
            action={canMove ? (
              <button type="button" onClick={(ev) => { ev.stopPropagation(); setMoving(e.id); }} className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium text-foreground" aria-label="Move to stage">
                <ArrowRightLeft className="h-3 w-3" />Move
              </button>
            ) : undefined}
          />
        ))}
        {items.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No enquiries in {def.label}.</p>}
      </div>
      <Sheet open={Boolean(moving)} onClose={() => setMoving(null)} side="bottom" title={movingEnquiry ? `Move ${db.travellers.find((t) => t.id === movingEnquiry.travellerId)?.fullName ?? "enquiry"} to…` : "Move to stage"}>
        <div className="grid gap-1 p-3">
          {BOARD_STAGES.map((s) => (
            <Button
              key={s.id}
              variant={s.id === movingEnquiry?.stage ? "secondary" : "ghost"}
              className="justify-start"
              disabled={s.id === movingEnquiry?.stage}
              onClick={() => {
                if (moving) onMove(moving, s.id);
                setMoving(null);
              }}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", s.accent)} />
              {s.label}
            </Button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
