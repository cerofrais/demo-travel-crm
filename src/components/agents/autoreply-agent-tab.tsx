"use client";

import * as React from "react";
import { FlaskConical, Pencil, Plus, Save } from "lucide-react";
import { Badge, Button, Card, Dialog, Input, Select, Textarea } from "@/components/ui";
import { Field, SectionTitle, TagChip, Toggle, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { destinationById, logActivity, travellerById, userName } from "@/lib/demo/queries";
import { classifyMessage, decideReply } from "@/lib/ai/autoreply";
import { can } from "@/lib/rbac";
import { CHANNEL_LABEL } from "@/lib/pipeline";
import type { AutoReplyAgentConfig, AutoReplyRule, Channel } from "@/lib/demo/types";
import { cn } from "@/lib/utils";
import { ChipEditor, ChipSelect, ConfidenceBar } from "./agent-meta";

const CHANNELS: { value: Channel; label: string }[] = (["whatsapp", "instagram", "email", "sms"] as Channel[]).map((c) => ({ value: c, label: CHANNEL_LABEL[c] }));
const MODE_HELP: Record<AutoReplyAgentConfig["mode"], string> = {
  auto: "Sends every reply above the confidence threshold without review. Hand-off topics still escalate.",
  draft: "Never sends on its own — every reply waits in the review queue.",
  hybrid: "Sends confident, in-policy replies; drafts anything uncertain, sensitive or past the per-thread cap.",
};

export function AutoReplyAgentTab() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <ConfigForm />
        <Playground />
      </div>
      <RulesTable />
    </div>
  );
}

function ConfigForm() {
  const db = useDb();
  const user = useCurrentUser();
  const { toast, node } = useToast();
  const canConfigure = can(user.role, "agents.configure");
  const [form, setForm] = React.useState<AutoReplyAgentConfig>(db.settings.agents.autoReply);
  const [dirty, setDirty] = React.useState(false);
  React.useEffect(() => {
    if (!dirty) setForm(db.settings.agents.autoReply);
  }, [db.settings.agents.autoReply, dirty]);
  function patch(p: Partial<AutoReplyAgentConfig>) {
    setForm((f) => ({ ...f, ...p }));
    setDirty(true);
  }
  function save() {
    mutateDb((d) => {
      d.settings.agents.autoReply = { ...form, maxAutoRepliesPerThread: Math.max(0, Number(form.maxAutoRepliesPerThread) || 0) };
      logActivity(d, { actor: user.name, actorKind: "user", type: "settings_changed", text: `Updated auto-reply agent (${form.persona}) configuration` });
    });
    setDirty(false);
    toast("Auto-reply settings saved");
  }
  return (
    <Card className="p-4 lg:col-span-3">
      <SectionTitle action={canConfigure && <Button size="sm" onClick={save} disabled={!dirty}><Save className="h-3.5 w-3.5" /> Save</Button>}>Configuration</SectionTitle>
      <fieldset disabled={!canConfigure} className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 sm:col-span-2">
          <div>
            <div className="text-sm font-medium">Agent enabled</div>
            <div className="text-xs text-muted-foreground">When off, every reply is drafted only</div>
          </div>
          <Toggle checked={form.enabled} onChange={(v) => patch({ enabled: v })} disabled={!canConfigure} />
        </div>
        <Field label="Persona name"><Input value={form.persona} onChange={(e) => patch({ persona: e.target.value })} /></Field>
        <Field label="Mode">
          <Select value={form.mode} onChange={(e) => patch({ mode: e.target.value as AutoReplyAgentConfig["mode"] })}>
            <option value="auto">Auto</option>
            <option value="draft">Draft only</option>
            <option value="hybrid">Hybrid</option>
          </Select>
        </Field>
        <p className="-mt-1 text-xs text-muted-foreground sm:col-span-2">{MODE_HELP[form.mode]}</p>
        <div className="sm:col-span-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Channels</div>
          <ChipSelect options={CHANNELS} values={form.channels} onChange={(v) => patch({ channels: v })} disabled={!canConfigure} />
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Confidence threshold</span>
            <span className="tabular-nums text-foreground">{Math.round(form.confidenceThreshold * 100)}%</span>
          </div>
          <input type="range" min={0.5} max={0.95} step={0.01} value={form.confidenceThreshold} onChange={(e) => patch({ confidenceThreshold: Number(e.target.value) })} className="w-full accent-brand-600" aria-label="Confidence threshold" />
          <div className="flex justify-between text-[10px] text-muted-foreground"><span>50% · chattier</span><span>95% · cautious</span></div>
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hand-off topics</div>
          <ChipEditor values={form.handoffTopics} onChange={(v) => patch({ handoffTopics: v })} placeholder="Add hand-off topic" disabled={!canConfigure} suggestions={["cancellation", "refund", "discount", "complaint", "visa rejection", "medical", "legal", "group above 10"]} />
        </div>
        <Field label="Tone"><Input value={form.tone} onChange={(e) => patch({ tone: e.target.value })} /></Field>
        <Field label="Max auto replies / thread"><Input type="number" min={0} value={form.maxAutoRepliesPerThread} onChange={(e) => patch({ maxAutoRepliesPerThread: Number(e.target.value) })} /></Field>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 sm:col-span-2">
          <div>
            <div className="text-sm font-medium">Quiet hours</div>
            <div className="text-xs text-muted-foreground">{form.quietHours ? `${form.quietHours.start} – ${form.quietHours.end} IST: acknowledge only` : "Off — replies around the clock"}</div>
          </div>
          <Toggle checked={form.quietHours != null} onChange={(v) => patch({ quietHours: v ? { start: "22:00", end: "08:00" } : null })} disabled={!canConfigure} />
        </div>
        {form.quietHours && (
          <>
            <Field label="Quiet from"><Input type="time" value={form.quietHours.start} onChange={(e) => patch({ quietHours: { ...form.quietHours!, start: e.target.value } })} /></Field>
            <Field label="Quiet until"><Input type="time" value={form.quietHours.end} onChange={(e) => patch({ quietHours: { ...form.quietHours!, end: e.target.value } })} /></Field>
          </>
        )}
        <Field label="Signature" className="sm:col-span-2"><Input value={form.signature} onChange={(e) => patch({ signature: e.target.value })} /></Field>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div className="text-sm font-medium">Itinerary drafts</div>
          <Toggle checked={form.allowItineraryDraft} onChange={(v) => patch({ allowItineraryDraft: v })} disabled={!canConfigure} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div className="text-sm font-medium">Payment links</div>
          <Toggle checked={form.allowPaymentLinks} onChange={(v) => patch({ allowPaymentLinks: v })} disabled={!canConfigure} />
        </div>
      </fieldset>
      {node}
    </Card>
  );
}

function Playground() {
  const db = useDb();
  const [text, setText] = React.useState("How much for 2 people in December?");
  const candidates = React.useMemo(() => db.enquiries.filter((e) => !["lost", "non_lead", "completed"].includes(e.stage)).slice(0, 60), [db]);
  const [enquiryId, setEnquiryId] = React.useState("");
  const e = db.enquiries.find((x) => x.id === (enquiryId || candidates[0]?.id));
  const t = travellerById(db, e?.travellerId);
  const cls = text.trim() ? classifyMessage(text) : null;
  const decision = e && t && text.trim() ? decideReply({ text, enquiry: e, traveller: t, destination: destinationById(db, e.destinationId), config: db.settings.agents.autoReply, rules: db.autoReplyRules, consultantName: e.assignedTo ? userName(db, e.assignedTo).split(" ")[0] : "your consultant", autoRepliesSoFar: db.messages.filter((m) => m.enquiryId === e.id && m.sentBy === "ai" && m.status !== "draft").length }) : null;
  const actionClass = decision?.action === "auto_sent" ? "bg-emerald-100 text-emerald-800" : decision?.action === "drafted" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700";
  return (
    <Card className="p-4 lg:col-span-2">
      <SectionTitle><span className="inline-flex items-center gap-1.5"><FlaskConical className="h-4 w-4 text-brand-600" /> Playground</span></SectionTitle>
      <p className="mb-2 text-xs text-muted-foreground">Try an inbound message against the live config. Nothing is saved.</p>
      <Select value={e?.id ?? ""} onChange={(ev) => setEnquiryId(ev.target.value)} className="mb-2" aria-label="Enquiry context">
        {candidates.map((c) => <option key={c.id} value={c.id}>{c.ref} · {travellerById(db, c.travellerId)?.fullName} · {c.destination}</option>)}
      </Select>
      <Textarea value={text} onChange={(ev) => setText(ev.target.value)} rows={3} placeholder="Type what the traveller would say…" />
      {decision && cls && (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-brand-100 text-brand-800">{decision.intent.replace(/_/g, " ")}</Badge>
            <Badge className={actionClass}>{decision.action.replace("_", " ")}</Badge>
            <ConfidenceBar value={decision.confidence} />
          </div>
          <p className="text-xs text-muted-foreground">{decision.reason}</p>
          {Object.keys(cls.extracted).length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {Object.entries(cls.extracted).map(([k, v]) => (
                <span key={k} className="rounded bg-secondary px-1.5 py-0.5"><span className="text-muted-foreground">{k}:</span> {String(v)}</span>
              ))}
            </div>
          )}
          {(decision.suggestedStage || decision.tag) && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              {decision.suggestedStage && <span className="rounded bg-secondary px-1.5 py-0.5">stage → {decision.suggestedStage.replace("_", " ")}</span>}
              {decision.tag && <TagChip name={decision.tag} tags={db.tags} />}
            </div>
          )}
          <div className="rounded-xl rounded-tr-sm bg-brand-100 px-3 py-2 text-brand-900">
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">{db.settings.agents.autoReply.persona} would reply</div>
            <p className="whitespace-pre-wrap">{decision.reply}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------- rules ----------

const TRIGGER_LABEL: Record<AutoReplyRule["trigger"], string> = { keyword: "Keyword", intent: "Intent", out_of_hours: "Out of hours", new_enquiry: "New enquiry", no_reply: "No reply" };

function RulesTable() {
  const db = useDb();
  const user = useCurrentUser();
  const { toast, node } = useToast();
  const canConfigure = can(user.role, "agents.configure");
  const [editing, setEditing] = React.useState<AutoReplyRule | "new" | null>(null);
  const rules = db.autoReplyRules;

  function setMode(id: string, mode: AutoReplyRule["mode"]) {
    mutateDb((d) => {
      const r = d.autoReplyRules.find((x) => x.id === id);
      if (r) {
        r.mode = mode;
        r.updatedAt = nowIso();
      }
    });
  }
  function setActive(id: string, active: boolean) {
    mutateDb((d) => {
      const r = d.autoReplyRules.find((x) => x.id === id);
      if (r) {
        r.active = active;
        r.updatedAt = nowIso();
        logActivity(d, { actor: user.name, actorKind: "user", type: "settings_changed", text: `${active ? "Enabled" : "Disabled"} auto-reply rule "${r.name}"` });
      }
    });
  }

  return (
    <Card className="p-4">
      <SectionTitle action={canConfigure && <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" /> New rule</Button>}>Rules ({rules.length})</SectionTitle>
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Rule</th>
              <th className="py-2 pr-3 font-semibold">Trigger</th>
              <th className="py-2 pr-3 font-semibold">Keywords</th>
              <th className="py-2 pr-3 font-semibold">Channels</th>
              <th className="py-2 pr-3 font-semibold">Mode</th>
              <th className="py-2 pr-3 font-semibold">Tag</th>
              <th className="py-2 pr-3 text-right font-semibold">Hits</th>
              <th className="py-2 pr-3 font-semibold">Active</th>
              <th className="py-2 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((r) => (
              <tr key={r.id} className={cn(!r.active && "opacity-60")}>
                <td className="py-2 pr-3 font-medium">{r.name}</td>
                <td className="py-2 pr-3 text-xs">{TRIGGER_LABEL[r.trigger]}{r.intent ? ` · ${r.intent}` : ""}</td>
                <td className="py-2 pr-3">
                  <div className="flex max-w-[220px] flex-wrap gap-1">
                    {r.keywords.slice(0, 4).map((k) => <span key={k} className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{k}</span>)}
                    {r.keywords.length > 4 && <span className="text-[10px] text-muted-foreground">+{r.keywords.length - 4}</span>}
                    {r.keywords.length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
                  </div>
                </td>
                <td className="py-2 pr-3 text-xs">{r.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}</td>
                <td className="py-2 pr-3">
                  <Select value={r.mode} onChange={(e) => setMode(r.id, e.target.value as AutoReplyRule["mode"])} disabled={!canConfigure} className="h-8 w-auto px-2 text-xs lg:h-8">
                    <option value="auto">Auto</option>
                    <option value="draft">Draft</option>
                    <option value="off">Off</option>
                  </Select>
                </td>
                <td className="py-2 pr-3">{r.tagOnMatch ? <TagChip name={r.tagOnMatch} tags={db.tags} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.hits}</td>
                <td className="py-2 pr-3"><Toggle checked={r.active} onChange={(v) => setActive(r.id, v)} disabled={!canConfigure} /></td>
                <td className="py-2 text-right">
                  {canConfigure && (
                    <button type="button" onClick={() => setEditing(r)} className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary" aria-label={`Edit ${r.name}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <RuleDialog rule={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(msg) => toast(msg)} />}
      {node}
    </Card>
  );
}

function RuleDialog({ rule, onClose, onSaved }: { rule: AutoReplyRule | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const user = useCurrentUser();
  const [form, setForm] = React.useState<Omit<AutoReplyRule, "id" | "hits" | "updatedAt">>(
    rule ? { name: rule.name, channels: rule.channels, trigger: rule.trigger, keywords: rule.keywords, intent: rule.intent, response: rule.response, mode: rule.mode, tagOnMatch: rule.tagOnMatch, active: rule.active } : { name: "", channels: ["whatsapp", "instagram"], trigger: "keyword", keywords: [], response: "", mode: "draft", tagOnMatch: undefined, active: true },
  );
  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  function save() {
    mutateDb((d) => {
      if (rule) {
        const r = d.autoReplyRules.find((x) => x.id === rule.id);
        if (r) Object.assign(r, form, { updatedAt: nowIso() });
      } else {
        d.autoReplyRules.push({ id: newId("rule"), ...form, hits: 0, updatedAt: nowIso() });
      }
      logActivity(d, { actor: user.name, actorKind: "user", type: "settings_changed", text: `${rule ? "Updated" : "Created"} auto-reply rule "${form.name}"` });
    });
    onSaved(rule ? "Rule updated" : "Rule created");
    onClose();
  }
  return (
    <Dialog open onClose={onClose} title={rule ? "Edit rule" : "New rule"} className="md:max-w-lg">
      <div className="space-y-3 p-4">
        <Field label="Name"><Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Payment link request" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Trigger">
            <Select value={form.trigger} onChange={(e) => patch({ trigger: e.target.value as AutoReplyRule["trigger"] })}>
              {(Object.keys(TRIGGER_LABEL) as AutoReplyRule["trigger"][]).map((k) => <option key={k} value={k}>{TRIGGER_LABEL[k]}</option>)}
            </Select>
          </Field>
          <Field label="Mode">
            <Select value={form.mode} onChange={(e) => patch({ mode: e.target.value as AutoReplyRule["mode"] })}>
              <option value="auto">Auto</option>
              <option value="draft">Draft</option>
              <option value="off">Off</option>
            </Select>
          </Field>
        </div>
        {form.trigger === "intent" && <Field label="Intent"><Input value={form.intent ?? ""} onChange={(e) => patch({ intent: e.target.value || undefined })} placeholder="pricing, visa, payment…" /></Field>}
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Channels</div>
          <ChipSelect options={CHANNELS} values={form.channels} onChange={(v) => patch({ channels: v })} />
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Keywords</div>
          <ChipEditor values={form.keywords} onChange={(v) => patch({ keywords: v })} placeholder="Add keyword" />
        </div>
        <Field label="Response" hint="Supports {{first_name}}, {{destination}}, {{from_price}}, {{visa_note}}"><Textarea rows={3} value={form.response} onChange={(e) => patch({ response: e.target.value })} /></Field>
        <Field label="Tag on match"><Input value={form.tagOnMatch ?? ""} onChange={(e) => patch({ tagOnMatch: e.target.value || undefined })} placeholder="optional" /></Field>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-sm font-medium">Active</span>
          <Toggle checked={form.active} onChange={(v) => patch({ active: v })} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!form.name.trim() || !form.response.trim()}>{rule ? "Save changes" : "Create rule"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
