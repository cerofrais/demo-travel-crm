"use client";

import * as React from "react";
import { BookUser, Image as ImageIcon, Stamp, Ticket, FileCheck, Shield, Receipt, Map, File, Eye, Trash2, Plus, ShieldCheck, AlertTriangle, type LucideIcon } from "lucide-react";
import type { Document, DocumentCategory } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { logActivity, tripById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { DOC_CATEGORY_LABEL } from "@/lib/pipeline";
import { cn, daysUntil, formatDate, formatDateTime } from "@/lib/utils";
import { Button, Dialog, Input, Select } from "@/components/ui";
import { EmptyState, Field, Toggle } from "@/components/shared";

const ICONS: Record<DocumentCategory, LucideIcon> = {
  passport: BookUser,
  photo: ImageIcon,
  visa: Stamp,
  ticket: Ticket,
  voucher: FileCheck,
  insurance: Shield,
  invoice: Receipt,
  receipt: Receipt,
  itinerary: Map,
  other: File,
};

function expiryState(d: Document): { tone: "none" | "warn" | "expired"; label: string } {
  if (!d.expiresAt) return { tone: "none", label: "" };
  const days = daysUntil(d.expiresAt);
  if (days < 0) return { tone: "expired", label: `Expired ${formatDate(d.expiresAt, "short")}` };
  if (days <= 180) return { tone: "warn", label: `Expires in ${days} days` };
  return { tone: "none", label: `Valid till ${formatDate(d.expiresAt)}` };
}

/**
 * Document list for an enquiry / trip / traveller. Metadata only — this demo
 * has no file store, so "upload" just records name, size and category.
 */
export function DocumentList({ enquiryId, tripId, travellerId, compact = false }: { enquiryId?: string; tripId?: string; travellerId?: string; compact?: boolean }) {
  const db = useDb();
  const me = useCurrentUser();
  const [preview, setPreview] = React.useState<Document | null>(null);
  const [del, setDel] = React.useState<Document | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const canEdit = can(me.role, "trips.manage");

  const docs = db.documents
    .filter((d) => (enquiryId && d.enquiryId === enquiryId) || (tripId && d.tripId === tripId) || (travellerId && d.travellerId === travellerId))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  function toggleVerified(doc: Document, v: boolean) {
    mutateDb((d) => {
      const x = d.documents.find((y) => y.id === doc.id);
      if (!x) return;
      x.verified = v;
      logActivity(d, { actor: me.name, actorKind: "user", type: "document_verified", text: `${v ? "Verified" : "Un-verified"} ${DOC_CATEGORY_LABEL[x.category].toLowerCase()} "${x.name}"`, enquiryId: x.enquiryId, tripId: x.tripId, travellerId: x.travellerId });
    });
  }

  function remove() {
    if (!del) return;
    const doc = del;
    mutateDb((d) => {
      d.documents = d.documents.filter((x) => x.id !== doc.id);
      logActivity(d, { actor: me.name, actorKind: "user", type: "document_deleted", text: `Deleted document "${doc.name}" (${doc.fileName})`, enquiryId: doc.enquiryId, tripId: doc.tripId, travellerId: doc.travellerId });
    });
    setDel(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {docs.length} document{docs.length === 1 ? "" : "s"} · {docs.filter((d) => d.verified).length} verified
        </p>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add document
          </Button>
        )}
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={File} title="No documents yet" hint="Passports, visas, tickets and vouchers will show up here." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {docs.map((doc) => {
            const Icon = ICONS[doc.category];
            const exp = expiryState(doc);
            return (
              <li key={doc.id} className="flex items-start gap-3 p-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", doc.verified ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground")}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">{DOC_CATEGORY_LABEL[doc.category]}</span>
                    {doc.verified && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {doc.fileName} · {doc.sizeKB >= 1024 ? `${(doc.sizeKB / 1024).toFixed(1)} MB` : `${doc.sizeKB} KB`}
                    {!compact && ` · by ${doc.uploadedBy} · ${formatDateTime(doc.uploadedAt)}`}
                  </p>
                  {exp.tone !== "none" && (
                    <p className={cn("mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium", exp.tone === "expired" ? "text-rose-600" : "text-amber-700")}>
                      <AlertTriangle className="h-3 w-3" /> {exp.label}
                    </p>
                  )}
                  {exp.tone === "none" && exp.label && !compact && <p className="mt-0.5 text-[11px] text-muted-foreground">{exp.label}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canEdit && !compact && <Toggle checked={doc.verified} onChange={(v) => toggleVerified(doc, v)} />}
                  <Button size="icon" variant="ghost" title="Preview" onClick={() => setPreview(doc)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canEdit && (
                    <Button size="icon" variant="ghost" title="Delete" onClick={() => setDel(doc)}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Preview */}
      <Dialog open={!!preview} onClose={() => setPreview(null)} title={preview?.name} className="md:max-w-lg">
        {preview && (
          <div className="space-y-3 p-4">
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-dashed border-border bg-secondary/60">
              <svg viewBox="0 0 240 180" className="h-40 w-auto text-muted-foreground" aria-hidden>
                <rect x="30" y="20" width="180" height="140" rx="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
                <path d="M60 120 L100 80 L130 110 L150 95 L180 125" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="160" cy="55" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                <text x="120" y="150" textAnchor="middle" fontSize="10" fill="currentColor">
                  Demo file — no document store in this build
                </text>
              </svg>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">File</dt>
                <dd className="truncate font-medium">{preview.fileName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Size</dt>
                <dd className="font-medium">{preview.sizeKB} KB</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Uploaded</dt>
                <dd className="font-medium">{formatDateTime(preview.uploadedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">By</dt>
                <dd className="font-medium">{preview.uploadedBy}</dd>
              </div>
            </dl>
          </div>
        )}
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!del} onClose={() => setDel(null)} title="Delete document?">
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Remove <span className="font-medium text-foreground">{del?.name}</span> from this record? This only deletes the metadata in the demo.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDel(null)}>
              Keep
            </Button>
            <Button variant="destructive" onClick={remove}>
              Delete
            </Button>
          </div>
        </div>
      </Dialog>

      <AddDocumentDialog open={addOpen} onClose={() => setAddOpen(false)} enquiryId={enquiryId} tripId={tripId} travellerId={travellerId} />
    </div>
  );
}

function AddDocumentDialog({ open, onClose, enquiryId, tripId, travellerId }: { open: boolean; onClose: () => void; enquiryId?: string; tripId?: string; travellerId?: string }) {
  const me = useCurrentUser();
  const [category, setCategory] = React.useState<DocumentCategory>("passport");
  const [name, setName] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [sizeKB, setSizeKB] = React.useState(0);
  const [expires, setExpires] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setCategory("passport");
      setName("");
      setFileName("");
      setSizeKB(0);
      setExpires("");
    }
  }, [open]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setSizeKB(Math.max(1, Math.round(f.size / 1024)));
    if (!name) setName(f.name.replace(/\.[a-z0-9]+$/i, ""));
  }

  function save() {
    const finalName = name.trim() || fileName || `${DOC_CATEGORY_LABEL[category]} document`;
    mutateDb((d) => {
      const trip = tripId ? tripById(d, tripId) : undefined;
      d.documents.push({
        id: newId("doc"),
        enquiryId: enquiryId ?? trip?.enquiryId,
        tripId: tripId ?? undefined,
        travellerId: travellerId ?? trip?.travellerId,
        category,
        name: finalName,
        fileName: fileName || `${finalName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.pdf`,
        sizeKB: sizeKB || Math.round(120 + Math.random() * 600),
        uploadedAt: nowIso(),
        uploadedBy: me.name || "Ops",
        verified: false,
        expiresAt: expires ? new Date(`${expires}T00:00:00`).toISOString() : undefined,
      });
      logActivity(d, { actor: me.name, actorKind: "user", type: "document_added", text: `Added ${DOC_CATEGORY_LABEL[category].toLowerCase()} "${finalName}"`, enquiryId: enquiryId ?? trip?.enquiryId, tripId, travellerId: travellerId ?? trip?.travellerId });
    });
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add document">
      <div className="space-y-3 p-4">
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
            {(Object.keys(DOC_CATEGORY_LABEL) as DocumentCategory[]).map((k) => (
              <option key={k} value={k}>
                {DOC_CATEGORY_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Passport — Ananya Rao" />
        </Field>
        <Field label="File" hint="Demo: only the file name and size are stored.">
          <input type="file" onChange={onFile} className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-2 file:text-xs file:font-medium file:text-secondary-foreground" />
          {fileName && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {fileName} · {sizeKB} KB
            </span>
          )}
        </Field>
        <Field label="Expiry date (optional)">
          <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save document</Button>
        </div>
      </div>
    </Dialog>
  );
}
