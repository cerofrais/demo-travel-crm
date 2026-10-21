"use client";

import * as React from "react";
import { Database, EyeOff, FileClock, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { SectionTitle } from "@/components/shared";
import { AGENT_META, AgentIcon } from "@/components/agents/agent-meta";
import { useDb } from "@/lib/demo/use-db";
import { AGENT_MODEL, AGENT_RUNTIME } from "@/lib/ai/audit";
import type { AgentKind } from "@/lib/demo/types";

const AGENTS = Object.keys(AGENT_META) as AgentKind[];

export function PolicyModels() {
  const db = useDb();
  const a = db.settings.agents;
  const enabled: Record<AgentKind, boolean> = {
    voice: a.voice.enabled,
    autoreply: a.autoReply.enabled,
    scoring: a.scoring.enabled,
    itinerary: a.itinerary.enabled,
    followup: a.followUp.enabled,
    assignment: db.settings.assignment.autoAssign,
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <SectionTitle>Agents & models</SectionTitle>
          <p className="-mt-2 text-xs text-muted-foreground">Which model each agent runs on, where it runs, and what it writes back. Change behaviour on the Agents page; this view is read-only.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Agent", "Model", "Runs on", "Triggered by", "Writes", "State"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {AGENTS.map((k) => (
                <tr key={k}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AgentIcon agent={k} />
                      <div>
                        <div className="font-medium">{AGENT_META[k].label}</div>
                        <div className="text-[11px] text-muted-foreground">{k === "voice" ? a.voice.name : k === "autoreply" ? a.autoReply.persona : "system"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{AGENT_MODEL[k]}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{AGENT_RUNTIME[k].runsOn}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{AGENT_RUNTIME[k].trigger}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{AGENT_RUNTIME[k].writes}</td>
                  <td className="px-4 py-3">
                    <span className={enabled[k] ? "inline-flex items-center gap-1 text-xs font-medium text-emerald-700" : "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"}>
                      <span className={enabled[k] ? "h-2 w-2 rounded-full bg-emerald-500" : "h-2 w-2 rounded-full bg-muted-foreground/40"} />
                      {enabled[k] ? "On" : "Off"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <FileClock className="h-5 w-5 text-brand-600" />
            <h3 className="text-sm font-semibold">Prompt retention</h3>
          </div>
          <p className="mt-2 text-sm text-foreground/80">Full system + user prompts and raw model output are kept for <strong>90 days</strong>, then reduced to the decision summary (action, confidence, outcome, reviewer). Exports from this page include only the summary columns.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-brand-600" />
            <h3 className="text-sm font-semibold">PII handling</h3>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-foreground/80">
            <li>• Passport numbers are masked (<span className="font-mono text-xs">••••0325</span>) before any prompt leaves the CRM.</li>
            <li>• Payment references, card and UPI details are never sent to a model.</li>
            <li>• Voice transcripts are stored in-region; recordings are not sent to the LLM.</li>
            <li>• Phone numbers and emails are passed only to the agent that needs them to reply.</li>
          </ul>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-brand-600" />
            <h3 className="text-sm font-semibold">Every inference is logged</h3>
          </div>
          <p className="mt-2 text-sm text-foreground/80">Each model call — successful, failed or skipped — writes one <span className="font-mono text-xs">AgentEvent</span> with the exact prompt, output, model, latency and tokens. There is no path that lets an agent act without a record, and human approvals are stored on the same event.</p>
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> {db.agentEvents.length.toLocaleString()} events on record</p>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold">Hard policy lines (all agents)</h3>
        <ul className="mt-2 grid gap-1 text-sm text-foreground/80 sm:grid-cols-2">
          <li>• Never quote a refund amount or cancellation fee.</li>
          <li>• Never promise a discount — drafts only, consultant decides.</li>
          <li>• Hand off on: {a.autoReply.handoffTopics.join(", ")}.</li>
          <li>• Voice escalates on: {a.voice.escalateOn.join(", ")}.</li>
          <li>• Auto-send only at ≥ {Math.round(a.autoReply.confidenceThreshold * 100)}% confidence; max {a.autoReply.maxAutoRepliesPerThread} auto-replies per thread.</li>
          <li>• Itinerary drafts {a.itinerary.requireReview ? "require a consultant's approval" : "may be sent directly"}; follow-ups stop after {a.followUp.maxAttempts} nudges.</li>
        </ul>
      </Card>
    </div>
  );
}
