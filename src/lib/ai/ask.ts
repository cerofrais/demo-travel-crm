/**
 * Ask the data — a small rule-based question framework over the demo store.
 *
 * `askData(question, db, user)` parses the question (ask-parse.ts), tries an
 * exact entity lookup (ask-entity.ts), then walks the handler registry in
 * order of specificity. Every answer carries the equivalent pseudo-SQL so a
 * reader can check what was counted. Pure and synchronous: no store access,
 * `now` is injectable for tests.
 */
import type { DemoData } from "@/lib/demo/types";
import { exactLookup, fuzzyLookup } from "./ask-entity";
import { OPS_HANDLERS } from "./ask-handlers-ops";
import { SALES_HANDLERS } from "./ask-handlers-sales";
import { parseQuestion } from "./ask-parse";
import { type Answer, type AskHandler, type HandlerResult, makeContext } from "./ask-util";

export type { Answer, AskHandler } from "./ask-util";
export type { ParsedQuestion } from "./ask-parse";
export { parseQuestion } from "./ask-parse";

/** Ordered by specificity: keyword handlers first, generic entity handlers last. */
export const HANDLERS: AskHandler[] = [...SALES_HANDLERS.slice(0, 6), ...OPS_HANDLERS, ...SALES_HANDLERS.slice(6)];

export const EXAMPLE_QUESTIONS: string[] = [
  "How many enquiries came from Instagram this week?",
  "Booked value by destination this month",
  "Which travellers have passports expiring in the next 6 months?",
  "Show me Priya Pillai",
  "Overdue payments",
  "Who has the most overdue tasks?",
  "Conversion rate by source last 30 days",
  "Departures in the next 14 days",
  "Calls handled by Aanya this week",
  "Itineraries sent but not viewed",
  "Enquiries with no reply for 3 days",
  "Top destinations by demand",
];

function unknownAnswer(question: string): HandlerResult {
  const picks = [...EXAMPLE_QUESTIONS].sort((a, b) => a.length - b.length).slice(0, 6);
  return {
    mode: "unknown",
    text: `I couldn't map “${question.trim()}” to the data. I understand questions about enquiries, bookings, payments, travellers, tasks, calls, itineraries and campaigns, with filters like a source, destination, consultant, stage or time window — or a traveller name / ref for a summary. Try one of these:\n${picks.map((p) => `• ${p}`).join("\n")}`,
    query: "-- no matching handler",
  };
}

/**
 * Answer a question against the data visible to `user`.
 * Never throws: a handler error degrades to an `unknown` answer.
 */
export function askData(question: string, db: DemoData, user: { sub: string; role: string }, now: Date = new Date()): Answer {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const finish = (r: HandlerResult): Answer => {
    const ended = typeof performance !== "undefined" ? performance.now() : Date.now();
    // Real queries take a few ms; keep the number honest but never 0 so the UI has something to show.
    return { ...r, durationMs: Math.max(1, Math.round(ended - started)) };
  };
  const trimmed = question.trim();
  if (!trimmed) return finish({ mode: "unknown", text: "Ask something first — e.g. “Overdue payments” or “Show me WT-1045”.", query: "-- empty question" });
  const ctx = makeContext(db, user, now);
  const q = parseQuestion(trimmed, db, now);
  try {
    const exact = exactLookup(q, ctx);
    if (exact) return finish(exact);
    for (const h of HANDLERS) {
      if (h.match(q)) return finish(h.run(q, ctx));
    }
    const fuzzy = fuzzyLookup(q, ctx);
    if (fuzzy) return finish(fuzzy);
  } catch (err) {
    return finish({ mode: "unknown", text: `Something went wrong answering that: ${err instanceof Error ? err.message : String(err)}. Try rephrasing.`, query: "-- handler error" });
  }
  return finish(unknownAnswer(trimmed));
}

/** Which handler would answer a question (for tests and the "Query" block header). */
export function handlerIdFor(question: string, db: DemoData, now: Date = new Date()): string | undefined {
  const q = parseQuestion(question, db, now);
  return HANDLERS.find((h) => h.match(q))?.id;
}
