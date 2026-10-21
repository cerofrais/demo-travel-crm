# 05 — AI agents

The demo ships five agents. In this build they are **deterministic
simulations** (`src/lib/ai/*.ts`) so the demo is stable and offline; the
production design swaps each simulation for a model call behind the same
function signature and keeps the same policy, audit trail and review UI.

## Aanya — voice agent (`voice-agent.ts`)

- **Outbound:** calls every new enquiry within N minutes (default 5) and asks
  two questions — month and pax, then budget — confirms pace, explains visa
  basics for the destination, and promises a plan on WhatsApp. On a completed
  call the enquiry moves to **Qualified**, the extracted fields are written to
  the enquiry, and a consultant is assigned. No answer → voicemail + WhatsApp
  fallback.
- **Inbound:** answers the business line 24×7 — new enquiries (creates the
  lead), booking status / voucher timing, FAQ (visa, price-from). Hard
  hand-off topics (cancellation, refund, complaint, medical, payment dispute)
  are escalated with an urgent callback task; she never quotes refund figures.
- **Config:** name, voice, languages (en/hi/hinglish), greeting, hours,
  after-hours mode, max call length, escalation list, outbound on/off, phone
  number, tone. Every call stores transcript, summary, extracted fields,
  outcome, sentiment, quality score.
- **Production:** Plivo/Twilio/Exotel SIP → realtime speech model (Claude +
  TTS/STT or a voice-native model) → same `Call` record; a telephony webhook
  replaces `simulateOutboundQualification`.

## Wish — autonomous reply agent (`autoreply.ts`)

- Classifies every inbound WhatsApp / Instagram message into an intent
  (greeting, pricing, visa, dates, trip_brief, itinerary_change, payment,
  documents, booking_status, thanks, discount, cancellation, complaint, other),
  extracts month / pax / budget / nights, and composes a reply with the
  enquiry's own context (destination from-price, visa note, consultant name).
- **Decision policy:** auto-send when confidence ≥ threshold (default 0.8),
  the intent is not a hand-off topic, the thread is under the max auto-reply
  count and the agent is in `auto`/`hybrid` mode; otherwise **draft** for
  review (discount, low confidence, draft mode) or **escalate** (cancellation,
  complaint). Drafts appear in the Inbox and the Agents → Review queue with
  Approve & send / Edit / Discard.
- Side effects: moves New/Contacted → Qualified when a brief is captured,
  tags (`price-asked`, `discount-asked`, `needs-human`), rule hit counters,
  `AgentEvent` audit rows.
- **Rules table:** keyword / intent / out-of-hours / new-enquiry / no-reply
  triggers with per-rule mode (auto / draft / off).
- **Production:** WhatsApp Business API + Instagram Messaging webhooks →
  Claude with tool access to the CRM (read enquiry, draft itinerary, create
  task) → same guardrails.

## Call transcription & analysis (`call-analysis.ts`)

Every call carries a transcript (voice-agent calls natively; consultant calls
via "Transcribe recording"), an English rendering for Hindi/Hinglish, and an
on-demand analysis: a 0–100 quality score, tags (price-discussion,
visa-question, pax-change, high-intent…), and coaching on opening,
explanation, professionalism and next steps. The recording player and the
transcript are synced — click a line to seek. Production: Indic ASR
(Whisper / IndicConformer) → translation → Claude scoring, as in the wellness
CRM's call pipeline.

## Ask the data (`ask.ts`)

A question framework over the data model: questions are parsed into entity /
metric / group-by / filters / date range, matched against a registry of
handlers, and answered with text, a table, a chart and the equivalent
pseudo-SQL for transparency. Names and refs resolve to an entity narrative.
Production: the same parser as a tool-use front door for Claude, or a
guarded text-to-SQL path over read-only replicas.

## AI Audit

Every inference writes an `AgentEvent`; the AI Audit page shows the decision
log with model, latency, tokens, system prompt, user prompt and output, plus
the review actions, and groups inbound traveller messages into question
topics so the team can see which questions lack a rule or a template.

## Scoring agent (`scoring.ts`)

0–100 conversion likelihood with explainable deltas (concrete dates +15,
budget stated +8, replied <24h +12, no reply 7d −18, itinerary sent +8,
referral/repeat +12, comment-to-DM −5, website planner +6, first response
<10 min +5, repeat traveller +10, honeymoon +4, fully flexible −4). ≥75 → `hot`.

## Itinerary agent (`itinerary.ts`)

Rebuilds a package template (each built from a wishtrip reel) for the
traveller's nights, pax, pace, comfort, dates, flights and budget; trims or
pads days, adjusts activity density for pace, prices with season and comfort
multipliers, produces a transparent breakdown (stays / transport / experiences
/ meals / flights / planning fee / GST) and a budget-fit note. Human review
before send when `requireReview` is on.

## Follow-up & assignment agents (inside the seed + UI actions)

No-reply nudges on the SLA cadence, payment reminders with Pay Now links,
post-trip review + referral loop, anniversary drips; auto-assignment by
destination specialist / round robin / least busy; passport-validity flags.

## Guardrails (Agents → Guardrails)

Never quotes refunds or promises availability · escalates cancellation,
complaint, medical, visa rejection · max auto-replies per thread · quiet hours
· itineraries need human approval · payment links only when enabled ·
passport numbers masked in summaries · every action logged with confidence
and reviewer.
