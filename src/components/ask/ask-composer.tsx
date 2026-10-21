"use client";

import * as React from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { EXAMPLE_QUESTIONS } from "@/lib/ai/ask";

export function ExampleChips({ onPick, compact = false }: { onPick: (q: string) => void; compact?: boolean }) {
  const list = compact ? EXAMPLE_QUESTIONS.slice(0, 6) : EXAMPLE_QUESTIONS;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((q) => (
        <button key={q} type="button" onClick={() => onPick(q)} className="inline-flex min-h-9 items-center rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-foreground shadow-sm hover:border-brand-400 hover:bg-brand-50">
          {q}
        </button>
      ))}
    </div>
  );
}

export function AskComposer({ value, onChange, onSubmit, busy, showExamples }: { value: string; onChange: (v: string) => void; onSubmit: (q: string) => void; busy: boolean; showExamples: boolean }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const submit = () => {
    const q = value.trim();
    if (!q || busy) return;
    onSubmit(q);
  };
  return (
    <div className="border-t border-border bg-card p-3 md:p-4">
      {showExamples && (
        <div className="mb-3">
          <p className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Try asking
          </p>
          <ExampleChips onPick={(q) => onSubmit(q)} compact />
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Ask about enquiries, bookings, payments, travellers… or type a name / ref"
          className="min-h-[44px] max-h-40 resize-none py-2.5"
          aria-label="Your question"
          disabled={busy}
        />
        <Button onClick={submit} disabled={busy || !value.trim()} className="h-11 shrink-0 px-4" aria-label="Ask">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline">{busy ? "Thinking…" : "Ask"}</span>
        </Button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">Enter to ask · Shift+Enter for a new line · answered from the CRM data in your browser, nothing leaves it</p>
    </div>
  );
}
