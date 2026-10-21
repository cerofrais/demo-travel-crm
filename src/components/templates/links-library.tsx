"use client";

import * as React from "react";
import { Archive, ArchiveRestore, ExternalLink, Folder, Link as LinkIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { DemoData, ResourceLink } from "@/lib/demo/types";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity } from "@/lib/demo/queries";
import { Button, Card, Dialog, Input, Textarea } from "@/components/ui";
import { EmptyState, Field } from "@/components/shared";
import { cn } from "@/lib/utils";
import { groupLinksByFolder, LINK_DESCRIPTION_MAX, LINK_NAME_MAX, matchesLinkQuery, normalizeFolder, normalizeLinkUrl, OTHER_FOLDER, shortUrl } from "./link-utils";

type Draft = { name: string; url: string; description: string; folder: string };
const EMPTY: Draft = { name: "", url: "", description: "", folder: "" };

function LinkDialog({ open, onClose, initial, folders, onSave }: { open: boolean; onClose: () => void; initial: Draft; folders: string[]; onSave: (d: { name: string; url: string; description?: string; folder: string }) => void }) {
  const [d, setD] = React.useState<Draft>(initial);
  const [touched, setTouched] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setD(initial);
      setTouched(false);
    }
  }, [open, initial]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const name = d.name.trim();
  const url = normalizeLinkUrl(d.url);
  const nameError = !name ? "Give the link a name." : name.length > LINK_NAME_MAX ? `Keep the name under ${LINK_NAME_MAX} characters.` : null;
  const urlError = !d.url.trim() ? "Paste the address." : !url ? "Only http(s) addresses can be shared — check for typos or spaces." : null;
  const valid = !nameError && !urlError;

  return (
    <Dialog open={open} onClose={onClose} title={initial.name ? "Edit link" : "New link"} className="md:max-w-lg">
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (valid && url) onSave({ name, url, description: d.description.trim() || undefined, folder: normalizeFolder(d.folder) });
        }}
      >
        <Field label="Name" hint={touched && nameError ? nameError : `${name.length}/${LINK_NAME_MAX}`}>
          <Input value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Japan visa checklist" autoFocus maxLength={LINK_NAME_MAX + 20} />
        </Field>
        <Field label="URL" hint={touched && urlError ? urlError : url && url !== d.url.trim() ? `Will be saved as ${url}` : "https:// is added if you leave it out."}>
          <Input value={d.url} onChange={(e) => set("url", e.target.value)} placeholder="wishtrip.co/guides/japan-visa" inputMode="url" />
        </Field>
        <Field label="Folder" hint={`Leave blank for “${OTHER_FOLDER}”.`}>
          <Input value={d.folder} onChange={(e) => set("folder", e.target.value)} placeholder="Visa & docs" list="link-folders" />
          <datalist id="link-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
        </Field>
        <Field label="Description (optional)">
          <Textarea value={d.description} onChange={(e) => set("description", e.target.value.slice(0, LINK_DESCRIPTION_MAX))} rows={2} placeholder="When to send it" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={touched && !valid}>{initial.name ? "Save" : "Add link"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * The shared link library (review page, visa checklists, policies…) that the
 * composer's "Insert link" picker reads from.
 */
export function LinksLibrary({ db, me, canManage, onToast }: { db: DemoData; me: { sub: string; name: string }; canManage: boolean; onToast: (msg: string) => void }) {
  const [q, setQ] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);
  const [editing, setEditing] = React.useState<ResourceLink | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<ResourceLink | null>(null);

  // Not memoised: the store mutates links in place, so references never change.
  const folders = [...new Set(db.resourceLinks.map((l) => l.folder))].sort();
  const archivedCount = db.resourceLinks.filter((l) => l.archived).length;
  const groups = groupLinksByFolder(db.resourceLinks.filter((l) => (showArchived || !l.archived) && matchesLinkQuery(l, q)));
  const initial: Draft = editing ? { name: editing.name, url: editing.url, description: editing.description ?? "", folder: editing.folder } : EMPTY;
  const actor = { actor: me.name || "You", actorSub: me.sub, actorKind: "user" as const };

  const openDialog = (l: ResourceLink | null) => {
    setEditing(l);
    setDialogOpen(true);
  };
  const save = (d: { name: string; url: string; description?: string; folder: string }) => {
    mutateDb((x) => {
      if (editing) {
        const l = x.resourceLinks.find((k) => k.id === editing.id);
        if (l) Object.assign(l, d);
        logActivity(x, { ...actor, type: "link_updated", text: `Updated link “${d.name}”` });
      } else {
        x.resourceLinks.unshift({ id: newId("lnk"), ...d, usageCount: 0, archived: false, createdAt: nowIso() });
        logActivity(x, { ...actor, type: "link_created", text: `Added link “${d.name}” to ${d.folder}` });
      }
    });
    onToast(editing ? "Link updated" : "Link added");
    setDialogOpen(false);
    setEditing(null);
  };
  const toggleArchive = (l: ResourceLink) => {
    mutateDb((x) => {
      const k = x.resourceLinks.find((y) => y.id === l.id);
      if (k) k.archived = !k.archived;
      logActivity(x, { ...actor, type: l.archived ? "link_restored" : "link_archived", text: `${l.archived ? "Restored" : "Archived"} link “${l.name}”` });
    });
    onToast(l.archived ? "Link restored" : "Link archived — hidden from the picker");
  };
  const remove = (l: ResourceLink) => {
    mutateDb((x) => {
      x.resourceLinks = x.resourceLinks.filter((y) => y.id !== l.id);
      logActivity(x, { ...actor, type: "link_deleted", text: `Deleted link “${l.name}”` });
    });
    setDeleting(null);
    onToast("Link deleted");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search links by name, URL or folder…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex min-h-[40px] items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived ({archivedCount})
        </label>
        {canManage && (
          <Button onClick={() => openDialog(null)}><Plus className="h-4 w-4" /> New link</Button>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={LinkIcon} title="No links match" hint={q ? "Try another word, or show archived links." : "Add the pages you send travellers most — review page, visa checklists, policies."} action={canManage ? <Button onClick={() => openDialog(null)}>New link</Button> : undefined} />
      ) : (
        groups.map((g) => (
          <Card key={g.folder} className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Folder className="h-3.5 w-3.5" /> {g.folder} <span className="rounded-full bg-muted px-1.5 text-[10px] normal-case tracking-normal">{g.links.length}</span>
            </div>
            <ul className="divide-y divide-border">
              {g.links.map((l) => (
                <li key={l.id} className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center", l.archived && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{l.name}</span>
                      {l.archived && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">Archived</span>}
                    </div>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" title={l.url} className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-brand-700 hover:underline">
                      <span className="truncate">{shortUrl(l.url, 64)}</span><ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    {l.description && <p className="mt-0.5 text-xs text-muted-foreground">{l.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                    <span className="text-xs tabular-nums text-muted-foreground" title="Times inserted into a message">Used {l.usageCount}×</span>
                    {canManage && (
                      <div className="flex gap-0.5">
                        <Button size="sm" variant="ghost" onClick={() => openDialog(l)} aria-label={`Edit ${l.name}`} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleArchive(l)} aria-label={l.archived ? `Restore ${l.name}` : `Archive ${l.name}`} title={l.archived ? "Restore" : "Archive"}>
                          {l.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setDeleting(l)} aria-label={`Delete ${l.name}`} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      <LinkDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); }} initial={initial} folders={folders} onSave={save} />

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete link">
        <div className="space-y-3 p-4 text-sm">
          <p>Delete <span className="font-semibold">{deleting?.name}</span> from the library? Messages already sent keep the URL. Archiving hides it from the picker without losing the count.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            {deleting && !deleting.archived && <Button variant="secondary" onClick={() => { toggleArchive(deleting); setDeleting(null); }}>Archive instead</Button>}
            <Button variant="destructive" onClick={() => deleting && remove(deleting)}>Delete</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
