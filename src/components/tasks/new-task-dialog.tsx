"use client";

import * as React from "react";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { Field } from "@/components/shared";
import { TASK_KIND_LABEL } from "@/lib/pipeline";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity, travellerById } from "@/lib/demo/queries";
import type { DemoData, TaskKind, TaskPriority } from "@/lib/demo/types";
import { toLocalInput } from "./task-helpers";

export function NewTaskDialog({ open, onClose, db, me, onCreated }: { open: boolean; onClose: () => void; db: DemoData; me: { sub: string; name: string }; onCreated: () => void }) {
  const [title, setTitle] = React.useState("");
  const [kind, setKind] = React.useState<TaskKind>("follow_up");
  const [due, setDue] = React.useState(() => toLocalInput(new Date(Date.now() + 86400000)));
  const [priority, setPriority] = React.useState<TaskPriority>("normal");
  const [assignee, setAssignee] = React.useState(me.sub);
  const [q, setQ] = React.useState("");
  const [enquiryId, setEnquiryId] = React.useState<string>("");

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setKind("follow_up");
      setDue(toLocalInput(new Date(Date.now() + 86400000)));
      setPriority("normal");
      setAssignee(me.sub);
      setQ("");
      setEnquiryId("");
    }
  }, [open, me.sub]);

  const matches = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return db.enquiries
      .filter((e) => {
        const t = travellerById(db, e.travellerId);
        return e.ref.toLowerCase().includes(s) || t?.fullName.toLowerCase().includes(s) || e.destination.toLowerCase().includes(s);
      })
      .slice(0, 6);
  }, [q, db]);

  const selected = db.enquiries.find((e) => e.id === enquiryId);

  function submit() {
    if (!title.trim()) return;
    mutateDb((d) => {
      d.tasks.unshift({
        id: newId("task"),
        title: title.trim(),
        kind,
        enquiryId: selected?.id,
        travellerId: selected?.travellerId,
        tripId: selected?.tripId,
        assignedTo: assignee || undefined,
        dueAt: new Date(due).toISOString(),
        status: "open",
        priority,
        createdBy: me.sub,
        createdAt: nowIso(),
      });
      logActivity(d, { actor: me.name, actorKind: "user", type: "task_created", text: `Created task "${title.trim()}"`, enquiryId: selected?.id, travellerId: selected?.travellerId });
    });
    onCreated();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="New task">
      <div className="space-y-3 p-4">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call back about Bali dates" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
              {(Object.keys(TASK_KIND_LABEL) as TaskKind[])
                .filter((k) => k !== "approval")
                .map((k) => (
                  <option key={k} value={k}>
                    {TASK_KIND_LABEL[k]}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Due">
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Assignee">
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {db.users
                .filter((u) => u.active)
                .map((u) => (
                  <option key={u.sub} value={u.sub}>
                    {u.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        <Field label="Link to enquiry" hint="Search by WT ref, traveller or destination">
          {selected ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{selected.ref}</span> · {travellerById(db, selected.travellerId)?.fullName} · {selected.destination}
              </span>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setEnquiryId("")}>
                Change
              </button>
            </div>
          ) : (
            <>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="WT-1042 or Ananya…" />
              {matches.length > 0 && (
                <ul className="mt-1 divide-y divide-border rounded-md border border-border bg-card">
                  {matches.map((e) => (
                    <li key={e.id}>
                      <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => setEnquiryId(e.id)}>
                        <span>
                          <span className="font-medium">{e.ref}</span> · {travellerById(db, e.travellerId)?.fullName}
                        </span>
                        <span className="text-xs text-muted-foreground">{e.destination}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            Create task
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
