import type { Enquiry, Itinerary, Message, Task, Traveller, Destination } from "@/lib/demo/types";
import { stageLabel } from "@/lib/pipeline";
import { explainScore } from "./scoring";

export interface AssistOutput {
  score: number;
  reasons: { label: string; delta: number }[];
  summary: string;
  nextActions: { title: string; priority: "high" | "medium" | "low"; reason: string }[];
  draft: { channel: "whatsapp" | "instagram" | "email"; body: string };
  generatedAt: string;
}

/** Conversation assist — summarises the thread and proposes next actions + a draft. */
export function assistForEnquiry(opts: {
  enquiry: Enquiry;
  traveller: Traveller;
  destination?: Destination;
  messages: Message[];
  itineraries: Itinerary[];
  tasks: Task[];
  consultantName: string;
  now?: Date;
}): AssistOutput {
  const { enquiry: e, traveller, destination, messages, itineraries, tasks, consultantName } = opts;
  const now = opts.now ?? new Date();
  const first = traveller.fullName.split(" ")[0];
  const { score, reasons } = explainScore(e, { messagesCount: messages.length, hasItinerary: itineraries.length > 0, traveller, now });
  const lastIn = [...messages].reverse().find((m) => m.direction === "inbound");
  const lastOut = [...messages].reverse().find((m) => m.direction === "outbound" && m.status !== "draft");
  const latest = itineraries.sort((a, b) => b.version - a.version)[0];
  const hoursSinceIn = lastIn ? (now.getTime() - new Date(lastIn.at).getTime()) / 3600000 : null;
  const waitingOnUs = lastIn && (!lastOut || new Date(lastIn.at) > new Date(lastOut.at));

  const parts: string[] = [];
  parts.push(`${traveller.fullName} (${traveller.city}) wants ${e.destination} for ${e.pax.adults + e.pax.children + e.pax.infants} travellers, ${e.nights} nights${e.travelStart ? ` from ${new Date(e.travelStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : e.travelMonth ? ` in ${new Date(e.travelMonth + "-01").toLocaleDateString("en-IN", { month: "long" })}` : ", dates flexible"}; budget ₹${e.budgetINR.toLocaleString("en-IN")} total, ${e.pace} pace, ${e.comfort} stays.`);
  parts.push(`Currently in ${stageLabel(e.stage)} via ${e.source.replace(/_/g, " ")}${e.reelRef ? " (reacted to a reel)" : ""}.`);
  if (latest) parts.push(`Itinerary v${latest.version} (${latest.status}) at ₹${latest.pricing.totalINR.toLocaleString("en-IN")}${latest.pricing.totalINR > e.budgetINR * 1.1 ? " — over their budget" : " — within budget"}.`);
  if (waitingOnUs) parts.push(`Their last message ${hoursSinceIn! < 1 ? "just now" : `${Math.round(hoursSinceIn!)}h ago`} is unanswered: "${lastIn!.body.slice(0, 80)}${lastIn!.body.length > 80 ? "…" : ""}".`);
  else if (lastOut && hoursSinceIn != null && hoursSinceIn > 48) parts.push(`No reply from them in ${Math.round(hoursSinceIn / 24)} days.`);
  if (traveller.tripsCount) parts.push(`Repeat traveller (${traveller.tripsCount} trip${traveller.tripsCount > 1 ? "s" : ""}, ₹${traveller.lifetimeValueINR.toLocaleString("en-IN")} lifetime).`);
  if (e.notes) parts.push(`Note: ${e.notes}.`);

  const actions: AssistOutput["nextActions"] = [];
  const openTasks = tasks.filter((t) => t.status === "open");
  if (waitingOnUs) actions.push({ title: "Reply now — traveller is waiting", priority: "high", reason: `Inbound ${Math.round(hoursSinceIn!)}h ago with no response; WhatsApp window ${e.whatsappWindowExpiresAt ? "still open" : "may have closed"}` });
  if (["qualified", "contacted"].includes(e.stage) && !latest) actions.push({ title: `Send ${e.destination} itinerary`, priority: "high", reason: "Brief is complete; SLA is 4h from qualification" });
  if (latest && latest.pricing.totalINR > e.budgetINR * 1.1) actions.push({ title: "Offer a budget-fit version", priority: "medium", reason: `v${latest.version} is ₹${(latest.pricing.totalINR - e.budgetINR).toLocaleString("en-IN")} over budget — drop one night or step down stays` });
  if (e.stage === "itinerary_sent" && latest?.status === "viewed") actions.push({ title: "Call to close — they viewed the plan", priority: "high", reason: "Viewed but no reply; a 5-minute call converts best at this point" });
  if (e.stage === "negotiation") actions.push({ title: "Send revised v" + ((latest?.version ?? 1) + 1), priority: "high", reason: "Changes requested; keep momentum under 24h" });
  if (e.stage === "advance_paid") actions.push({ title: "Collect passports & start visa file", priority: "high", reason: destination?.visa.type === "embassy" ? "Embassy visa needs 4–6 weeks" : "Needed for tickets and vouchers" });
  if (!e.travelStart) actions.push({ title: "Pin down dates", priority: "medium", reason: "Flexible dates lower urgency; propose two concrete windows" });
  if (openTasks.length === 0 && !["completed", "lost", "non_lead"].includes(e.stage)) actions.push({ title: "Schedule a follow-up task", priority: "low", reason: "No open task on this enquiry" });
  if (traveller.anniversary) actions.push({ title: "Mention anniversary surprise", priority: "low", reason: "Anniversary on file — small touch, high delight" });
  if (actions.length === 0) actions.push({ title: "Nothing urgent — keep the drip running", priority: "low", reason: "Follow-up agent is handling nudges" });

  let body: string;
  if (e.stage === "new" || e.stage === "contacted") body = `Hi ${first}, ${consultantName} here from wishtrip 🙂 To build your ${e.destination} plan I need your dates (or month), number of travellers and a rough budget per person — reply here any time.`;
  else if (e.stage === "qualified") body = `Hi ${first}! Working on your ${e.nights}-night ${e.destination} plan now — ${e.pace} pace, ${e.comfort} stays, around ₹${Math.round(e.budgetINR / Math.max(1, e.pax.adults + e.pax.children)).toLocaleString("en-IN")} per person. You'll have it on this chat by this evening. Anything to avoid — long drives, early mornings?`;
  else if (e.stage === "itinerary_sent") body = `Hi ${first}, did you get a chance to look at the ${e.destination} plan? Happy to swap any stay, shift dates or trim the budget — just tell me what to change.`;
  else if (e.stage === "negotiation") body = `Hi ${first}, I've reworked the ${e.destination} plan with your changes — v${(latest?.version ?? 1) + 1} is on its way. If we lock dates this week I can hold the ${latest?.stays[0]?.name ?? "stay"} at the current rate.`;
  else if (e.stage === "advance_paid" || e.stage === "docs_visa") body = `Hi ${first}, quick checklist for ${e.destination}: passport copies (front + back) for all travellers and one photo each. Send them here and we'll handle the rest 🙌`;
  else if (e.stage === "ready") body = `${first}, ${e.destination} is ${e.travelStart ? Math.max(0, Math.round((new Date(e.travelStart).getTime() - now.getTime()) / 86400000)) : "a few"} days away ✈️ Vouchers and tickets are in this chat. Your trip captain Meera is on here 24×7.`;
  else if (e.stage === "lost") body = `Hi ${first}, no pressure at all — whenever ${e.destination} is back on the cards, your plan is saved and I'll refresh prices for your new dates.`;
  else body = `Hi ${first}, hope you're well! Anything I can help with on ${e.destination}?`;

  return {
    score,
    reasons,
    summary: parts.join(" "),
    nextActions: actions.slice(0, 4),
    draft: { channel: traveller.preferredChannel === "email" ? "email" : traveller.preferredChannel === "instagram" ? "instagram" : "whatsapp", body },
    generatedAt: now.toISOString(),
  };
}
