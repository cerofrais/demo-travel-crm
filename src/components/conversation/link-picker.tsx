"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Link as LinkIcon, Search } from "lucide-react";
import type { ResourceLink } from "@/lib/demo/types";
import { useDb } from "@/lib/demo/use-db";
import { Button, Input } from "@/components/ui";
import { formatLinkForText, groupLinksByFolder, matchesLinkQuery, shortUrl } from "@/components/templates/link-utils";

/**
 * "Insert link" button + popover for the composer. Picking a link APPENDS to
 * whatever is typed (a template is the whole message; a link is something you
 * add to one). Opens upward because the composer sits at the bottom.
 */
export function LinkPicker({ onSelect, disabled }: { onSelect: (snippet: string, link: ResourceLink) => void; disabled?: boolean }) {
  const db = useDb();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [openFolders, setOpenFolders] = React.useState<Set<string>>(new Set());
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const groups = groupLinksByFolder(db.resourceLinks.filter((l) => !l.archived && matchesLinkQuery(l, query)));
  // Searching opens everything — a hit inside a closed folder would read as "no results".
  const searching = query.trim().length > 0;
  const isOpen = (f: string) => searching || groups.length === 1 || openFolders.has(f);
  const toggleFolder = (f: string) =>
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  function pick(l: ResourceLink) {
    onSelect(formatLinkForText(l), l);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setOpen((o) => !o)} disabled={disabled} title="Insert a link from the library" aria-expanded={open}>
        <LinkIcon className="h-3.5 w-3.5 text-brand-600" /> <span className="hidden sm:inline">Insert link</span>
      </Button>
      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-1 w-80 max-w-[90vw] rounded-lg border border-border bg-popover shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search links…" className="h-9 pl-8 text-sm" autoFocus />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {groups.length === 0 && <p className="px-3 py-5 text-center text-sm text-muted-foreground">{searching ? "No links match." : "No links in the library yet."}</p>}
            {groups.map((g) => {
              const expanded = isOpen(g.folder);
              return (
                <div key={g.folder}>
                  <button type="button" onClick={() => toggleFolder(g.folder)} aria-expanded={expanded} className="flex min-h-[36px] w-full items-center gap-1.5 px-2 text-left hover:bg-secondary">
                    {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    {expanded ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{g.folder}</span>
                    <span className="text-[11px] text-muted-foreground">{g.links.length}</span>
                  </button>
                  {expanded &&
                    g.links.map((l) => (
                      <button key={l.id} type="button" onClick={() => pick(l)} className="block w-full py-2 pl-8 pr-3 text-left hover:bg-secondary">
                        <span className="block truncate text-sm font-medium text-foreground">{l.name}</span>
                        {l.description && <span className="block truncate text-xs text-muted-foreground">{l.description}</span>}
                        <span className="block truncate text-[11px] text-muted-foreground/80">{shortUrl(l.url)}</span>
                      </button>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
