"use client";

import * as React from "react";
import { Archive, BadgeCheck, Folder, LayoutTemplate, Link as LinkIcon, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge, Button, Card, Input, ScrollableTabs } from "@/components/ui";
import { ChannelBadge, EmptyState, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { useCurrentUser } from "@/lib/demo/session-client";
import { can } from "@/lib/rbac";
import { cn, formatDate } from "@/lib/utils";
import type { Channel, MessageTemplate } from "@/lib/demo/types";
import { TemplateEditor, LANGUAGE_LABEL } from "./template-editor";
import { LinksLibrary } from "./links-library";

type Mode = "templates" | "links";

const CATEGORY_CLASS: Record<MessageTemplate["category"], string> = {
  marketing: "bg-pink-100 text-pink-700",
  utility: "bg-sky-100 text-sky-800",
  service: "bg-emerald-100 text-emerald-800",
};

export function TemplatesWorkspace() {
  const db = useDb();
  const me = useCurrentUser();
  const { toast, node } = useToast();
  const canManage = can(me.role, "templates.manage");
  const [mode, setMode] = React.useState<Mode>("templates");
  const [folder, setFolder] = React.useState<string>("all");
  const [channel, setChannel] = React.useState<Channel | "all">("all");
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<MessageTemplate | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);

  const folders = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of db.templates) if (!t.archived) counts.set(t.folder, (counts.get(t.folder) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [db.templates]);
  const archivedCount = db.templates.filter((t) => t.archived).length;

  const rows = db.templates
    .filter((t) => (folder === "archived" ? t.archived : !t.archived && (folder === "all" || t.folder === folder)))
    .filter((t) => channel === "all" || t.channel === channel)
    .filter((t) => {
      const s = q.trim().toLowerCase();
      return !s || t.name.toLowerCase().includes(s) || t.body.toLowerCase().includes(s) || t.folder.toLowerCase().includes(s);
    })
    .sort((a, b) => b.usageCount - a.usageCount);

  const openEditor = (t: MessageTemplate | null) => {
    setEditing(t);
    setEditorOpen(true);
  };

  const FolderButton = ({ k, label, count, icon }: { k: string; label: string; count: number; icon?: React.ReactNode }) => (
    <button type="button" onClick={() => setFolder(k)} className={cn("flex min-h-[40px] shrink-0 items-center justify-between gap-2 rounded-md px-3 text-sm md:w-full", folder === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className={cn("rounded-full px-1.5 text-[10px]", folder === k ? "bg-white/20" : "bg-muted")}>{count}</span>
    </button>
  );

  const ModeButton = ({ k, label, icon }: { k: Mode; label: string; icon: React.ReactNode }) => (
    <button type="button" onClick={() => setMode(k)} aria-pressed={mode === k} className={cn("flex min-h-[40px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors", mode === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title={mode === "links" ? "Link library" : "Message templates"}
        subtitle={mode === "links" ? "Pages consultants share mid-conversation — review page, visa checklists, policies. Insert them from the composer." : "Approved WhatsApp, Instagram and email templates used by consultants and the auto-reply agent."}
      >
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          <ModeButton k="templates" label="Templates" icon={<LayoutTemplate className="h-4 w-4" />} />
          <ModeButton k="links" label="Links" icon={<LinkIcon className="h-4 w-4" />} />
        </div>
        {canManage && mode === "templates" && (
          <Button onClick={() => openEditor(null)}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        )}
      </PageHeader>
      {mode === "links" && (
        <div className="p-4 md:p-6">
          <LinksLibrary db={db} me={me} canManage={canManage} onToast={toast} />
        </div>
      )}
      <div className={cn("flex flex-col gap-4 p-4 md:flex-row md:gap-6 md:p-6", mode !== "templates" && "hidden")}>
        <aside className="md:w-56 md:shrink-0">
          <div className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
            <FolderButton k="all" label="All" count={db.templates.filter((t) => !t.archived).length} icon={<LayoutTemplate className="h-4 w-4" />} />
            {folders.map(([f, n]) => (
              <FolderButton key={f} k={f} label={f} count={n} icon={<Folder className="h-4 w-4" />} />
            ))}
            <FolderButton k="archived" label="Archived" count={archivedCount} icon={<Archive className="h-4 w-4" />} />
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <ScrollableTabs
            tabs={[
              { key: "all", label: "All channels" },
              { key: "whatsapp", label: "WhatsApp" },
              { key: "instagram", label: "Instagram" },
              { key: "email", label: "Email" },
            ]}
            active={channel}
            onChange={(k) => setChannel(k as Channel | "all")}
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {rows.length === 0 ? (
            <EmptyState icon={LayoutTemplate} title="No templates match" hint="Change folder or channel, or create a new one." action={canManage ? <Button onClick={() => openEditor(null)}>New template</Button> : undefined} />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-secondary/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Template</th>
                      <th className="px-3 py-2 text-left font-semibold">Channel</th>
                      <th className="px-3 py-2 text-left font-semibold">Category</th>
                      <th className="px-3 py-2 text-left font-semibold">Lang</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-right font-semibold">Used</th>
                      <th className="px-3 py-2 text-right font-semibold">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((t) => (
                      <tr key={t.id} className="cursor-pointer hover:bg-secondary/50" onClick={() => openEditor(t)}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{t.name}</div>
                          <div className="line-clamp-1 max-w-md text-xs text-muted-foreground">{t.body}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{t.folder}</div>
                        </td>
                        <td className="px-3 py-3">
                          <ChannelBadge channel={t.channel} />
                        </td>
                        <td className="px-3 py-3">
                          <Badge className={cn("capitalize", CATEGORY_CLASS[t.category])}>{t.category}</Badge>
                        </td>
                        <td className="px-3 py-3 text-xs">{LANGUAGE_LABEL[t.language]}</td>
                        <td className="px-3 py-3">
                          {t.approved ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              <BadgeCheck className="h-3 w-3" /> {t.channel === "whatsapp" ? "Meta approved" : "Approved"}
                            </span>
                          ) : (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Pending</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{t.usageCount}</td>
                        <td className="px-3 py-3 text-right text-xs text-muted-foreground">{formatDate(t.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
      <TemplateEditor open={editorOpen} onClose={() => setEditorOpen(false)} template={editing} db={db} me={me} canManage={canManage} onToast={toast} />
      {node}
    </>
  );
}
