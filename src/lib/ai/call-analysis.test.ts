import { describe, expect, it } from "vitest";
import { analyseCall, transcribeCall, translateTranscript } from "./call-analysis";
import { generateSeed } from "@/lib/demo/seed";

const db = generateSeed();

describe("call transcription & analysis", () => {
  it("seeds transcripts for most consultant calls and translations for Hinglish agent calls", () => {
    const human = db.calls.filter((c) => c.kind === "human" && c.status === "completed");
    expect(human.some((c) => c.transcript.length > 0)).toBe(true);
    const hinglish = db.calls.filter((c) => c.kind === "voice_agent" && c.language === "hinglish");
    expect(hinglish.every((c) => c.translation && c.translation.length === c.transcript.length)).toBe(true);
  });

  it("transcribes a manually logged call into alternating lines within the duration", () => {
    const call = { ...db.calls.find((c) => c.kind === "human")!, transcript: [], language: "hinglish" as const, summary: "Price discussion: asked for 5% off" };
    const t = transcribeCall(call, { consultantName: "Rohan Kulkarni" });
    expect(t.transcript.length).toBeGreaterThan(5);
    expect(t.translation).toHaveLength(t.transcript.length);
    expect(t.transcript[0].speaker).toBe("agent");
    expect(t.transcript[t.transcript.length - 1].t).toBeLessThanOrEqual(call.durationSec);
  });

  it("scores calls deterministically with tags and coaching", () => {
    const call = db.calls.find((c) => c.transcript.length > 0)!;
    const a = analyseCall(call, { consultantName: "Aanya" });
    const b = analyseCall(call, { consultantName: "Aanya" });
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(15);
    expect(a.score).toBeLessThanOrEqual(98);
    expect(a.coaching.nextSteps.length).toBeGreaterThan(10);
  });

  it("translates known Hinglish phrases", () => {
    const out = translateTranscript([{ speaker: "caller", text: "Haan bolo, quick please.", t: 0 }]);
    expect(out[0].text).toBe("Yes go ahead, quickly please.");
  });
});
