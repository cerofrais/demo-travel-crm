"use client";

import * as React from "react";
import { Button, Dialog, Input, Select, Textarea } from "@/components/ui";
import { Field } from "@/components/shared";
import { STAGES } from "@/lib/pipeline";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { logActivity } from "@/lib/demo/queries";
import { cn } from "@/lib/utils";
import type { Campaign, Channel, DemoData, EnquiryStage } from "@/lib/demo/types";
import { CAMPAIGN_TYPE_LABEL, audienceCount, describeAudience, fillSample } from "./campaign-helpers";

function ChipPicker<T extends string>({ options, value, onChange, render }: { options: T[]; value: T[]; onChange: (v: T[]) => void; render?: (o: T) => React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
            className={cn("min-h-[32px] rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground")}
          >
            {render ? render(o) : o}
          </button>
        );
      })}
    </div>
  );
}

export function NewCampaignDialog({ open, onClose, db, me, onCreated }: { open: boolean; onClose: () => void; db: DemoData; me: { sub: string; name: string }; onCreated: () => void }) {
  const [name, setName] = React.useState("");
  const [channel, setChannel] = React.useState<Channel>("whatsapp");
  const [type, setType] = React.useState<Campaign["type"]>("broadcast");
  const [keyword, setKeyword] = React.useState("PLAN");
  const [postRef, setPostRef] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [stages, setStages] = React.useState<EnquiryStage[]>([]);
  const [dests, setDests] = React.useState<string[]>([]);
  const [templateId, setTemplateId] = React.useState("");
  const [body, setBody] = React.useState("");
  const [scheduledAt, setScheduledAt] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setChannel("whatsapp");
    setType("broadcast");
    setKeyword("PLAN");
    setPostRef("");
    setTags([]);
    setStages([]);
    setDests([]);
    setTemplateId("");
    setBody("");
    setScheduledAt("");
  }, [open]);

  const isAutomation = type === "comment_automation" || type === "story_reply";
  React.useEffect(() => {
    if (isAutomation) setChannel("instagram");
  }, [isAutomation]);

  const spec = { tags, stages, destinationIds: dests };
  const count = isAutomation ? 0 : audienceCount(db, spec);
  const templates = db.templates.filter((t) => !t.archived && t.channel === channel);

  function submit() {
    if (!name.trim() || !body.trim()) return;
    const status: Campaign["status"] = isAutomation ? "running" : scheduledAt ? "scheduled" : "draft";
    mutateDb((d) => {
      d.campaigns.unshift({
        id: newId("cmp"),
        name: name.trim(),
        channel,
        type,
        status,
        keyword: isAutomation ? keyword.trim().toUpperCase() || undefined : undefined,
        postRef: isAutomation ? postRef.trim() || "All posts & reels" : undefined,
        audience: { description: isAutomation ? `Anyone replying ${keyword.trim().toUpperCase() || "PLAN"} on ${postRef.trim() || "any post"}` : describeAudience(d, spec), count, tags, stages, destinationIds: dests },
        templateId: templateId || undefined,
        body: body.trim(),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        startedAt: isAutomation ? nowIso() : undefined,
        stats: { sent: 0, delivered: 0, read: 0, replied: 0, leadsCreated: 0, bookings: 0 },
        createdBy: me.sub,
        createdAt: nowIso(),
      });
      logActivity(d, { actor: me.name, actorKind: "user", type: "campaign_created", text: `Created ${CAMPAIGN_TYPE_LABEL[type].toLowerCase()} "${name.trim()}"${status === "scheduled" ? " (scheduled)" : ""}` });
    });
    onCreated();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="New campaign" className="md:max-w-2xl">
      <div className="space-y-4 p-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dec school holidays — Kerala for families" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as Campaign["type"])}>
              {(Object.keys(CAMPAIGN_TYPE_LABEL) as Campaign["type"][]).map((t) => (
                <option key={t} value={t}>
                  {CAMPAIGN_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} disabled={isAutomation}>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </Select>
          </Field>
        </div>

        {isAutomation ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Trigger keyword" hint="Comment or story reply that fires the DM">
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="PLAN" />
            </Field>
            <Field label="Post / reel" hint="Leave blank for all posts">
              <Input value={postRef} onChange={(e) => setPostRef(e.target.value)} placeholder="instagram.com/p/…" />
            </Field>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Audience</span>
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{count.toLocaleString("en-IN")} people</span>
            </div>
            <Field label="Tags">
              <ChipPicker options={db.tags.map((t) => t.name)} value={tags} onChange={setTags} />
            </Field>
            <Field label="Stages">
              <ChipPicker options={STAGES.map((s) => s.id)} value={stages} onChange={setStages} render={(s) => STAGES.find((x) => x.id === s)?.label} />
            </Field>
            <Field label="Destinations">
              <ChipPicker options={db.destinations.map((d) => d.id)} value={dests} onChange={setDests} render={(id) => { const d = db.destinations.find((x) => x.id === id); return `${d?.emoji ?? ""} ${d?.name ?? id}`; }} />
            </Field>
            <p className="text-xs text-muted-foreground">{describeAudience(db, spec)}</p>
          </div>
        )}

        <Field label="Template" hint="Fills the message body; edit freely after">
          <Select
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              const t = db.templates.find((x) => x.id === e.target.value);
              if (t) setBody(t.body);
            }}
          >
            <option value="">— Write from scratch —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.folder} · {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Message" hint="Variables: {{first_name}} {{destination}} {{agent_name}}">
          <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi {{first_name}}, …" />
        </Field>
        {body && (
          <div className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">
            <span className="font-semibold">Preview: </span>
            {fillSample(body)}
          </div>
        )}
        {!isAutomation && (
          <Field label="Schedule" hint="Leave blank to save as draft">
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || !body.trim()}>
            {isAutomation ? "Turn on automation" : scheduledAt ? "Schedule" : "Save draft"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
