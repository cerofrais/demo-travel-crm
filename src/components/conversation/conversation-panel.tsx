"use client";

import * as React from "react";
import { Bot, Check, CheckCheck, ChevronDown, FileText, Paperclip, Send, Sparkles, AlertTriangle, Pencil, Trash2, MessageCircle } from "lucide-react";
import { Button, Select, Textarea, Input } from "@/components/ui";
import { ChannelBadge, EmptyState, useToast } from "@/components/shared";
import { useDb } from "@/lib/demo/use-db";
import { mutateDb, newId, nowIso } from "@/lib/demo/store";
import { useCurrentUser } from "@/lib/demo/session-client";
import { enquiriesForTraveller, enquiryById, logActivity, messagesForTraveller, travellerById } from "@/lib/demo/queries";
import { can } from "@/lib/rbac";
import { CHANNEL_LABEL } from "@/lib/pipeline";
import type { Channel, Message } from "@/lib/demo/types";
import { cn, formatDateTime, formatTime } from "@/lib/utils";
import { CANNED_REPLIES, THREAD_CHANNELS, appendInbound, approveDraft, discardDraft, fillTemplate, runAutoReply, senderLabel } from "./conversation-utils";
import { LinkPicker } from "./link-picker";

export interface ConversationPanelProps {
  travellerId: string;
  enquiryId?: string;
  channel?: Channel;
  className?: string;
}

/**
 * The message thread for a traveller (optionally one channel) with the
 * composer, template picker and the "Simulate traveller reply" dev menu that
 * runs the auto-reply agent end to end.
 */
export function ConversationPanel({ travellerId, enquiryId, channel, className }: ConversationPanelProps) {
  const db = useDb();
  const user = useCurrentUser();
  const { toast, node } = useToast();
  const traveller = travellerById(db, travellerId);
  const enquiry = enquiryById(db, enquiryId) ?? enquiriesForTraveller(db, travellerId).find((e) => !["lost", "non_lead"].includes(e.stage)) ?? enquiriesForTraveller(db, travellerId)[0];
  const all = React.useMemo(() => messagesForTraveller(db, travellerId), [db, travellerId]);

  const [activeChannel, setActiveChannel] = React.useState<Channel>(() => channel ?? all[all.length - 1]?.channel ?? traveller?.preferredChannel ?? "whatsapp");
  React.useEffect(() => {
    if (channel) setActiveChannel(channel);
  }, [channel]);
  const chan = channel ?? activeChannel;
  const messages = React.useMemo(() => all.filter((m) => m.channel === chan), [all, chan]);

  const canSend = can(user.role, "messaging.send");
  const canReview = can(user.role, "agents.review");
  const persona = db.settings.agents.autoReply.persona;

  const [typing, setTyping] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, typing, chan]);

  if (!traveller) return <EmptyState title="Traveller not found" />;

  const counts = Object.fromEntries(THREAD_CHANNELS.map((c) => [c, all.filter((m) => m.channel === c).length])) as Record<Channel, number>;

  function simulate(text: string) {
    if (!traveller) return;
    mutateDb((d) => appendInbound(d, { traveller, enquiry, channel: chan, text }));
    if (!enquiry) {
      toast("Inbound message added (no enquiry to reply against)");
      return;
    }
    setTyping(true);
    window.setTimeout(() => {
      let outcome = "";
      mutateDb((d) => {
        const r = runAutoReply(d, { traveller, enquiry, channel: chan, text });
        outcome = r.decision.action;
      });
      setTyping(false);
      toast(outcome === "auto_sent" ? `${persona} replied automatically` : outcome === "drafted" ? `${persona} drafted a reply for review` : `${persona} escalated this to a consultant`);
    }, 700);
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col rounded-xl border border-border bg-card", className)}>
      {!channel && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2">
          {THREAD_CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveChannel(c)}
              className={cn("flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors", chan === c ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {CHANNEL_LABEL[c]}
              <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", chan === c ? "bg-brand-100 text-brand-800" : "bg-muted text-muted-foreground")}>{counts[c]}</span>
            </button>
          ))}
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-sand-50/60 p-3 md:p-4">
        {messages.length === 0 && !typing && (
          <EmptyState icon={MessageCircle} title={`No ${CHANNEL_LABEL[chan]} messages yet`} hint={canSend ? "Send a template or simulate a traveller reply to see the agent in action." : undefined} />
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
          return (
            <React.Fragment key={m.id}>
              {showDay && <div className="flex justify-center"><span className="rounded-full bg-card px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground shadow-sm">{formatDateTime(m.at).split(",")[0]}</span></div>}
              {m.status === "draft" ? (
                <DraftCard m={m} canReview={canReview} reviewer={user} persona={persona} onDone={(msg) => toast(msg)} />
              ) : (
                <Bubble m={m} label={senderLabel(db, m, traveller.fullName, persona)} />
              )}
            </React.Fragment>
          );
        })}
        {typing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Bot className="h-3.5 w-3.5 text-brand-600" />
            <span>{persona} is typing</span>
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-400" />
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-400 [animation-delay:200ms]" />
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-400 [animation-delay:400ms]" />
            </span>
          </div>
        )}
      </div>

      {canSend ? (
        <Composer
          travellerId={travellerId}
          enquiryId={enquiry?.id}
          channel={chan}
          showChannelSelect={!channel}
          onChannelChange={setActiveChannel}
          onSimulate={simulate}
          onSent={() => toast("Message sent")}
          busy={typing}
        />
      ) : (
        <div className="shrink-0 border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">Read-only — your role can view this conversation but not send messages.</div>
      )}
      {node}
    </div>
  );
}

// ---------- bubbles ----------

function StatusTicks({ status }: { status: Message["status"] }) {
  if (status === "failed") return <span className="text-[10px] font-medium text-rose-600">failed</span>;
  if (status === "sent") return <Check className="h-3 w-3 text-muted-foreground" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  if (status === "read") return <CheckCheck className="h-3 w-3 text-brand-500" />;
  return null;
}

function AiChip({ m }: { m: Message }) {
  if (!m.ai) return null;
  return (
    <span title={m.ai.reason} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-800">
      <Sparkles className="h-2.5 w-2.5" /> AI · {m.ai.intent.replace(/_/g, " ")} · {Math.round(m.ai.confidence * 100)}%
    </span>
  );
}

function Bubble({ m, label }: { m: Message; label: string }) {
  const db = useDb();
  const inbound = m.direction === "inbound";
  const tpl = m.templateId ? db.templates.find((t) => t.id === m.templateId) : undefined;
  return (
    <div className={cn("flex", inbound ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[85%] md:max-w-[75%]", inbound ? "items-start" : "items-end")}>
        <div className={cn("mb-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground", !inbound && "justify-end")}>
          {m.sentBy === "ai" && !inbound && <Bot className="h-3 w-3 text-brand-600" />}
          <span className="font-medium text-foreground/80">{label}</span>
          <span>·</span>
          <span>{formatTime(m.at)}</span>
        </div>
        <div className={cn("rounded-2xl px-3.5 py-2 text-sm shadow-sm", inbound ? "rounded-tl-sm bg-sand-100 text-foreground" : "rounded-tr-sm bg-brand-100 text-brand-900")}>
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
          {m.attachmentName && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-card/80 px-2 py-1 text-[11px] font-medium text-foreground">
              <Paperclip className="h-3 w-3" /> {m.attachmentName}
            </span>
          )}
        </div>
        <div className={cn("mt-1 flex flex-wrap items-center gap-1.5", !inbound && "justify-end")}>
          {tpl && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title={tpl.name}>
              <FileText className="h-2.5 w-2.5" /> Template · {tpl.name}
            </span>
          )}
          <AiChip m={m} />
          {!inbound && <StatusTicks status={m.status} />}
        </div>
      </div>
    </div>
  );
}

function DraftCard({ m, canReview, reviewer, persona, onDone }: { m: Message; canReview: boolean; reviewer: { sub: string; name: string }; persona: string; onDone: (msg: string) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [body, setBody] = React.useState(m.body);
  return (
    <div className="flex justify-end">
      <div className="w-full max-w-[92%] rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm md:max-w-[80%]">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" /> Needs review · {persona} drafted this
          </span>
          <span className="text-[11px] text-amber-700/80">{formatTime(m.at)}</span>
        </div>
        {editing ? (
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="bg-card" />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">{m.body}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <AiChip m={m} />
          {m.ai && <span className="text-[11px] text-amber-800/80">{m.ai.reason}</span>}
        </div>
        {canReview && (
          <div className="mt-3 flex flex-wrap gap-2">
            {editing ? (
              <>
                <Button size="sm" onClick={() => { mutateDb((d) => approveDraft(d, m.id, reviewer, body)); onDone("Edited draft sent"); }} disabled={!body.trim()}>
                  <Send className="h-3.5 w-3.5" /> Send
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setBody(m.body); }}>Cancel</Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => { mutateDb((d) => approveDraft(d, m.id, reviewer)); onDone("Draft approved and sent"); }}>
                  <Check className="h-3.5 w-3.5" /> Approve & send
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={() => { mutateDb((d) => discardDraft(d, m.id, reviewer)); onDone("Draft discarded"); }}>
                  <Trash2 className="h-3.5 w-3.5" /> Discard
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- composer ----------

function Composer({ travellerId, enquiryId, channel, showChannelSelect, onChannelChange, onSimulate, onSent, busy }: { travellerId: string; enquiryId?: string; channel: Channel; showChannelSelect: boolean; onChannelChange: (c: Channel) => void; onSimulate: (text: string) => void; onSent: () => void; busy: boolean }) {
  const db = useDb();
  const user = useCurrentUser();
  const [text, setText] = React.useState("");
  const [templateId, setTemplateId] = React.useState("");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [custom, setCustom] = React.useState("");
  const menuRef = React.useRef<HTMLDivElement>(null);
  const traveller = travellerById(db, travellerId)!;
  const enquiry = enquiryById(db, enquiryId);
  const templates = db.templates.filter((t) => t.channel === channel && !t.archived && t.approved);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = db.templates.find((x) => x.id === id);
    if (t) setText(fillTemplate(t.body, db, { traveller, enquiry, userName: user.name }));
  }

  function send() {
    const body = text.trim();
    if (!body) return;
    const at = nowIso();
    mutateDb((d) => {
      d.messages.push({ id: newId("msg"), travellerId, enquiryId, channel, direction: "outbound", body, at, sentBy: user.sub, status: "sent", templateId: templateId || undefined });
      const e = d.enquiries.find((x) => x.id === enquiryId);
      if (e) {
        e.lastActivityAt = at;
        e.updatedAt = at;
        if (e.stage === "new") {
          e.stage = "contacted";
          e.lastStageChangeAt = at;
        }
        if (e.firstResponseMinutes == null) e.firstResponseMinutes = Math.max(1, Math.round((Date.now() - new Date(e.createdAt).getTime()) / 60000));
      }
      if (templateId) {
        const t = d.templates.find((x) => x.id === templateId);
        if (t) t.usageCount += 1;
      }
      logActivity(d, { actor: user.name, actorKind: "user", type: "message_sent", text: `Sent ${CHANNEL_LABEL[channel]} message${templateId ? " (template)" : ""}: "${body.slice(0, 70)}${body.length > 70 ? "…" : ""}"`, enquiryId, travellerId });
    });
    setText("");
    setTemplateId("");
    onSent();
  }

  return (
    <div className="shrink-0 border-t border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {showChannelSelect && (
          <Select value={channel} onChange={(e) => onChannelChange(e.target.value as Channel)} className="h-9 w-auto text-sm" aria-label="Channel">
            {THREAD_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
          </Select>
        )}
        {!showChannelSelect && <ChannelBadge channel={channel} />}
        <Select value={templateId} onChange={(e) => pickTemplate(e.target.value)} className="h-9 min-w-0 flex-1 text-sm" aria-label="Template">
          <option value="">Insert template…</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.folder} · {t.name}</option>)}
        </Select>
        <LinkPicker
          disabled={busy}
          onSelect={(snippet, link) => {
            setText((t) => (t.trim() ? `${t.replace(/\s+$/, "")}\n${snippet}` : snippet));
            mutateDb((d) => {
              const l = d.resourceLinks.find((x) => x.id === link.id);
              if (l) l.usageCount += 1;
            });
          }}
        />
        <div ref={menuRef} className="relative">
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setMenuOpen((o) => !o)} disabled={busy}>
            <Bot className="h-3.5 w-3.5 text-brand-600" /> Simulate traveller reply <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {menuOpen && (
            <div className="absolute bottom-full right-0 z-30 mb-1 w-80 max-w-[90vw] rounded-lg border border-border bg-popover p-1.5 shadow-lg">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inbound as {traveller.fullName.split(" ")[0]}</div>
              {CANNED_REPLIES.map((c) => (
                <button key={c} type="button" onClick={() => { setMenuOpen(false); onSimulate(c); }} className="block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-secondary">
                  “{c}”
                </button>
              ))}
              <div className="mt-1 border-t border-border p-1.5">
                <form
                  className="flex gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!custom.trim()) return;
                    setMenuOpen(false);
                    onSimulate(custom.trim());
                    setCustom("");
                  }}
                >
                  <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Type anything…" className="h-9 text-sm" />
                  <Button type="submit" size="sm" className="h-9" disabled={!custom.trim()}>Send</Button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${traveller.fullName.split(" ")[0]} on ${CHANNEL_LABEL[channel]}…`}
          rows={2}
          className="min-h-[44px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
        />
        <Button onClick={send} disabled={!text.trim()} className="h-11 shrink-0" aria-label="Send message">
          <Send className="h-4 w-4" /> <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">Sending as {user.name || "you"} · ⌘/Ctrl + Enter to send</div>
    </div>
  );
}
