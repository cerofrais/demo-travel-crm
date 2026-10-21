"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, HelpCircle, LayoutTemplate, MessageSquareQuote, Sparkles, X } from "lucide-react";
import { Badge, Button, Card, Dialog, Select, Textarea } from "@/components/ui";
import { StatCard } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { logActivity } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { inboundTopics, suggestTemplateFor, type TemplateSuggestion, type Topic } from "@/lib/ai/audit";
import { cn } from "@/lib/utils";

type Range = "7d" | "30d" | "90d" | "all";
const RANGE_DAYS: Record<Range, number | null> = { "7d": 7, "30d": 30, "90d": 90, all: null };

export function InboundQuestions({ onToast }: { onToast: (m: string) => void }) {
  const db = useDb();
  const user = useCurrentUser();
  const canSave = can(user.role, "templates.manage");
  const [range, setRange] = React.useState<Range>("90d");
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [suggesting, setSuggesting] = React.useState<Topic | null>(null);

  const analysis = React.useMemo(() => {
    const days = RANGE_DAYS[range];
    return inboundTopics(db, { sinceIso: days ? new Date(Date.now() - days * 86400000).toISOString() : undefined });
  }, [db, range]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs text-muted-foreground">
          Every inbound traveller message grouped into the questions they keep asking. Grouping uses the same intent classifier as the auto-reply agent, so the numbers are stable — the model is only used when you ask it to draft a template.
        </p>
        <Select value={range} onChange={(e) => setRange(e.target.value as Range)} className="w-auto" aria-label="Range">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">Everything</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Traveller messages" value={analysis.total} icon={MessageSquareQuote} />
        <StatCard label="Question topics" value={analysis.topics.length} icon={HelpCircle} tint="text-indigo-600" />
        <StatCard label="Topics with no template" value={analysis.gaps.length} icon={LayoutTemplate} tint={analysis.gaps.length ? "text-amber-600" : "text-emerald-600"} />
        <StatCard label="Unrecognised" value={analysis.unrecognised} icon={AlertTriangle} tint="text-zinc-500" hint={analysis.total ? `${Math.round((analysis.unrecognised / analysis.total) * 100)}% of inbound` : undefined} />
      </div>

      {analysis.gaps.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-medium text-amber-900">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            {analysis.gaps.length} topic{analysis.gaps.length === 1 ? "" : "s"} travellers ask about with no template in the library — consultants are writing these from scratch every time.
          </p>
          <p className="mt-1 text-xs text-amber-800">{analysis.gaps.map((g) => `${g.label} (${g.count})`).join(" · ")}</p>
        </Card>
      )}

      <div className="space-y-2">
        {analysis.topics.map((t) => {
          const open = expanded === t.intent;
          const gap = t.templateExpected && t.templates.length === 0;
          return (
            <Card key={t.intent} className="overflow-hidden">
              <button type="button" onClick={() => setExpanded(open ? null : t.intent)} className="flex w-full items-start gap-3 p-4 text-left hover:bg-secondary/40" aria-expanded={open}>
                <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{t.label}</span>
                    <Badge className="bg-secondary text-[10px]">{t.count} asked</Badge>
                    <Badge className="bg-brand-100 text-[10px] text-brand-700">{t.share}%</Badge>
                    <YesNo yes={Boolean(t.rule)} label="rule" />
                    {t.templateExpected ? <YesNo yes={t.templates.length > 0} label="template" /> : <Badge className="bg-zinc-100 text-[10px] text-zinc-600">no template needed</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                  <div className="mt-1.5 h-1 w-full max-w-md overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, t.share)}%` }} />
                  </div>
                </div>
              </button>
              {open && (
                <div className="space-y-3 border-t border-border px-4 py-3 md:pl-11">
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sample messages</div>
                    <ul className="space-y-1.5">
                      {t.samples.map((s, i) => (
                        <li key={i} className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">“{s}”</li>
                      ))}
                    </ul>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Auto-reply rule</div>
                      {t.rule ? (
                        <Link href="/agents" className="text-sm text-brand-700 hover:underline">{t.rule.name} <span className="text-xs text-muted-foreground">· {t.rule.mode} · {t.rule.hits} hits</span></Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">None — the agent answers from context only.</span>
                      )}
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Templates</div>
                      {t.templates.length ? (
                        <ul className="space-y-0.5 text-sm">
                          {t.templates.map((tp) => (
                            <li key={tp.id}><Link href="/templates" className="text-brand-700 hover:underline">{tp.name}</Link> <span className="text-xs text-muted-foreground">· {tp.folder} · {tp.channel}</span></li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm text-muted-foreground">{t.templateExpected ? "None in the library." : "Not needed for this topic."}</span>
                      )}
                    </div>
                  </div>
                  {gap && (
                    <Button size="sm" variant="secondary" onClick={() => setSuggesting(t)}>
                      <Sparkles className="h-3.5 w-3.5" /> Suggest template
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {analysis.unrecognised > 0 && (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Unrecognised</span>
              <Badge className="bg-zinc-100 text-[10px] text-zinc-700">{analysis.unrecognised} messages</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">No intent matched — these fall through to the consultant. Examples:</p>
            <ul className="mt-2 space-y-1.5">
              {analysis.unrecognisedSamples.map((s, i) => <li key={i} className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">“{s}”</li>)}
            </ul>
          </Card>
        )}
      </div>

      <SuggestDialog topic={suggesting} onClose={() => setSuggesting(null)} canSave={canSave} onSaved={(name) => { setSuggesting(null); onToast(`Saved “${name}” to Templates › Suggested (unapproved)`); }} />
    </div>
  );
}

function YesNo({ yes, label }: { yes: boolean; label: string }) {
  return (
    <Badge className={cn("gap-0.5 text-[10px]", yes ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")}>
      {yes ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {label}
    </Badge>
  );
}

function SuggestDialog({ topic, onClose, canSave, onSaved }: { topic: Topic | null; onClose: () => void; canSave: boolean; onSaved: (name: string) => void }) {
  const user = useCurrentUser();
  const [draft, setDraft] = React.useState<TemplateSuggestion | null>(null);
  const [body, setBody] = React.useState("");

  React.useEffect(() => {
    if (!topic) return;
    const s = suggestTemplateFor(topic);
    setDraft(s);
    setBody(s.body);
  }, [topic]);

  function save() {
    if (!topic || !draft) return;
    const name = draft.name;
    const variables = Array.from(new Set(Array.from(body.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1])));
    mutateDb((db) => {
      db.templates.unshift({ id: newId("tpl"), name, channel: "whatsapp", folder: "Suggested", category: "service", language: "en", body, variables, approved: false, usageCount: 0, archived: false, updatedAt: nowIso() });
      logActivity(db, { actor: user.name, actorSub: user.sub, actorKind: "user", type: "template_created", text: `Saved AI-suggested template “${name}” for inbound topic “${topic.label}” (${topic.count} messages)` });
    });
    onSaved(name);
  }

  return (
    <Dialog open={Boolean(topic)} onClose={onClose} title={topic ? `Suggested template · ${topic.label}` : "Suggested template"} className="md:max-w-lg">
      {topic && draft && (
        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2 text-xs text-brand-900">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            {draft.rationale}
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Name</div>
            <div className="text-sm font-medium">{draft.name}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Body (WhatsApp · English)</div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="font-mono text-xs" />
            <p className="mt-1 text-[11px] text-muted-foreground">Variables: {Array.from(new Set(Array.from(body.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]))).map((v) => `{{${v}}}`).join(" ") || "none"}</p>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Covers questions like</div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {topic.samples.map((s, i) => <li key={i}>“{s}”</li>)}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={save} disabled={!canSave || body.trim().length < 20} title={canSave ? undefined : "Your role cannot manage templates"}>
              <LayoutTemplate className="h-4 w-4" /> Save as template
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
