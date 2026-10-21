"use client";

import * as React from "react";
import { Archive, ArchiveRestore, Copy, Trash2 } from "lucide-react";
import { Button, Input, Select, Sheet, Textarea } from "@/components/ui";
import { Field, Toggle, ChannelBadge } from "@/components/shared";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity, travellerById, destinationById } from "@/lib/demo/queries";
import { formatDate, formatINR, paxCount } from "@/lib/utils";
import type { Channel, DemoData, Language, MessageTemplate } from "@/lib/demo/types";

export const VARIABLE_CHIPS = ["first_name", "destination", "agent_name", "itinerary_link", "total", "pax", "ref", "pay_link", "due_date", "amount", "dates", "captain", "code"];

export const LANGUAGE_LABEL: Record<Language, string> = { en: "English", hi: "Hindi", hinglish: "Hinglish", te: "Telugu", ta: "Tamil", mr: "Marathi", gu: "Gujarati" };

export function detectVariables(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) out.add(m[1]);
  return [...out];
}

/** Build a sample variable map from a real traveller + enquiry in the db. */
export function sampleVars(db: DemoData, agentName: string): Record<string, string> {
  const enquiry = db.enquiries.find((e) => e.tripId) ?? db.enquiries[0];
  const traveller = travellerById(db, enquiry?.travellerId) ?? db.travellers[0];
  const trip = db.trips.find((t) => t.id === enquiry?.tripId);
  const dest = destinationById(db, enquiry?.destinationId);
  const total = trip?.totalINR ?? Math.round((enquiry?.budgetINR ?? 120000) / 1000) * 1000;
  const captain = db.users.find((u) => u.sub === trip?.tripCaptain)?.name ?? "Meera";
  return {
    first_name: traveller?.fullName.split(" ")[0] ?? "Ananya",
    destination: dest?.name ?? enquiry?.destination ?? "Bali",
    agent_name: agentName.split(" ")[0] || "Rohan",
    itinerary_link: `wishtrip.co/i/${enquiry?.ref.toLowerCase() ?? "wt-1042"}`,
    total: total.toLocaleString("en-IN"),
    pax: String(enquiry ? paxCount(enquiry.pax) : 2),
    ref: trip?.ref ?? enquiry?.ref ?? "WT-1042",
    pay_link: `rzp.io/l/${(trip?.ref ?? "wt").toLowerCase()}`,
    due_date: formatDate(new Date(Date.now() + 7 * 86400000)),
    amount: Math.round(total * (db.settings.payment.tokenPct / 100)).toLocaleString("en-IN"),
    dates: trip ? `${formatDate(trip.startDate, "short")} – ${formatDate(trip.endDate, "short")}` : "12 – 18 Dec",
    captain,
    code: traveller?.referralCode ?? "WISH-ANAN5",
    nights: String(enquiry?.nights ?? 5),
    month: enquiry?.travelMonth ? new Date(`${enquiry.travelMonth}-01`).toLocaleString("en-IN", { month: "long" }) : "December",
    stay: "Taj Bekal",
    version: "2",
    pct: String(db.settings.payment.tokenPct),
    local_contact: "+62 812 3456 7890 (Putu)",
    weather: "29°C, light showers",
    tip: "pack reef-safe sunscreen",
    total_inr: formatINR(total),
  };
}

export function fillTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

type Draft = Omit<MessageTemplate, "id" | "variables" | "usageCount" | "updatedAt">;

const EMPTY: Draft = { name: "", channel: "whatsapp", folder: "General", category: "utility", language: "en", body: "", approved: false, archived: false };

export function TemplateEditor({ open, onClose, template, db, me, canManage, onToast }: { open: boolean; onClose: () => void; template: MessageTemplate | null; db: DemoData; me: { sub: string; name: string }; canManage: boolean; onToast: (m: string) => void }) {
  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setDraft(template ? { name: template.name, channel: template.channel, folder: template.folder, category: template.category, language: template.language, body: template.body, approved: template.approved, archived: template.archived } : EMPTY);
  }, [open, template]);

  const vars = React.useMemo(() => sampleVars(db, me.name), [db, me.name]);
  const detected = detectVariables(draft.body);
  const folders = Array.from(new Set(db.templates.map((t) => t.folder))).sort();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function insertVar(v: string) {
    const el = bodyRef.current;
    const token = `{{${v}}}`;
    if (!el) return set("body", draft.body + token);
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? start;
    const next = draft.body.slice(0, start) + token + draft.body.slice(end);
    set("body", next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function save() {
    if (!draft.name.trim() || !draft.body.trim()) return;
    mutateDb((d) => {
      const variables = detectVariables(draft.body);
      if (template) {
        const x = d.templates.find((t) => t.id === template.id);
        if (!x) return;
        Object.assign(x, draft, { variables, updatedAt: nowIso() });
        logActivity(d, { actor: me.name, actorKind: "user", type: "template", text: `Updated template "${draft.name}"` });
      } else {
        d.templates.unshift({ id: newId("tpl"), ...draft, variables, usageCount: 0, updatedAt: nowIso() });
        logActivity(d, { actor: me.name, actorKind: "user", type: "template", text: `Created template "${draft.name}"` });
      }
    });
    onToast(template ? "Template saved" : "Template created");
    onClose();
  }
  function toggleArchive() {
    if (!template) return;
    mutateDb((d) => {
      const x = d.templates.find((t) => t.id === template.id);
      if (x) {
        x.archived = !x.archived;
        x.updatedAt = nowIso();
      }
    });
    onToast(template.archived ? "Template restored" : "Template archived");
    onClose();
  }
  function duplicate() {
    if (!template) return;
    mutateDb((d) => {
      d.templates.unshift({ ...template, id: newId("tpl"), name: `${template.name} (copy)`, approved: false, usageCount: 0, updatedAt: nowIso() });
    });
    onToast("Duplicated");
    onClose();
  }
  function remove() {
    if (!template) return;
    mutateDb((d) => {
      d.templates = d.templates.filter((t) => t.id !== template.id);
      logActivity(d, { actor: me.name, actorKind: "user", type: "template", text: `Deleted template "${template.name}"` });
    });
    onToast("Template deleted");
    onClose();
  }

  const ro = !canManage;

  return (
    <Sheet open={open} onClose={onClose} title={template ? "Edit template" : "New template"} widthClassName="w-full max-w-2xl">
      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">
            <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Follow-up · 24h" disabled={ro} />
          </Field>
          <Field label="Channel">
            <Select value={draft.channel} onChange={(e) => set("channel", e.target.value as Channel)} disabled={ro}>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </Select>
          </Field>
          <Field label="Folder">
            <Input list="tpl-folders" value={draft.folder} onChange={(e) => set("folder", e.target.value)} disabled={ro} />
            <datalist id="tpl-folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </Field>
          <Field label="Category">
            <Select value={draft.category} onChange={(e) => set("category", e.target.value as Draft["category"])} disabled={ro}>
              <option value="marketing">Marketing</option>
              <option value="utility">Utility</option>
              <option value="service">Service</option>
            </Select>
          </Field>
          <Field label="Language">
            <Select value={draft.language} onChange={(e) => set("language", e.target.value as Language)} disabled={ro}>
              {(Object.keys(LANGUAGE_LABEL) as Language[]).map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABEL[l]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Body" hint="Click a variable to insert it at the cursor">
          <Textarea ref={bodyRef} rows={7} value={draft.body} onChange={(e) => set("body", e.target.value)} className="font-mono text-xs" disabled={ro} />
        </Field>
        {!ro && (
          <div className="flex flex-wrap gap-1.5">
            {VARIABLE_CHIPS.map((v) => (
              <button key={v} type="button" onClick={() => insertVar(v)} className="min-h-[32px] rounded-full border border-border bg-background px-2.5 font-mono text-[11px] text-muted-foreground hover:border-primary hover:text-primary">
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        )}
        {detected.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Variables detected: {detected.map((v) => <code key={v} className="mr-1 rounded bg-secondary px-1">{v}</code>)}
          </p>
        )}

        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Live preview <ChannelBadge channel={draft.channel} />
          </div>
          <div className="rounded-2xl rounded-tl-sm bg-brand-50 px-3 py-2 text-sm text-brand-900 whitespace-pre-wrap">{draft.body ? fillTemplate(draft.body, vars) : <span className="text-muted-foreground">Start typing to see the preview…</span>}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Sample data from {vars.first_name}&apos;s {vars.destination} enquiry.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <Toggle checked={draft.approved} onChange={(v) => set("approved", v)} label={draft.channel === "whatsapp" ? "Meta approved" : "Approved for use"} disabled={ro} />
          {template && (
            <span className="text-xs text-muted-foreground">
              Used {template.usageCount} times · updated {formatDate(template.updatedAt)}
            </span>
          )}
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {template && (
                <>
                  <Button variant="outline" size="sm" onClick={toggleArchive}>
                    {template.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />} {template.archived ? "Unarchive" : "Archive"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={duplicate}>
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </Button>
                  <Button variant="ghost" size="sm" className="text-rose-600" onClick={remove}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} disabled={!draft.name.trim() || !draft.body.trim()}>
                {template ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
