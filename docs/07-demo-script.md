# 07 — Demo script for the wishtrip walkthrough (≈15 minutes)

Open http://localhost:3000 (or the deployed URL). Every step below uses seeded
data that is regenerated relative to "today", so the numbers always look live.

## 1. The story (1 min) — login screen
"Your site turns a reel into a plan. The moment you start taking bookings, you
need the layer behind it: who asked, what we quoted, who paid, whose passport
expires, who's landing tomorrow. That's this." Sign in as **Rohan (Trip
Consultant)**.

## 2. Dashboard (1 min)
Point at: new enquiries this week · **median first response 2–3 min** (that's
the agents) · pipeline value · booked this month · overdue collections. The
"Needs your attention" list is what a consultant works first; the AI agents
card shows Aanya's calls and Wish's replies.

## 3. Enquiries — the hero screen (4 min)
- Kanban columns are the travel funnel: New → Contacted → Qualified →
  Itinerary sent → Negotiation → Advance paid → Docs & visa → Ready →
  Travelling → Completed.
- Cards carry what matters for a trip: destination, dates, people, budget,
  the source (**IG PLAN** = someone commented PLAN on a reel), the AI score,
  and a **Bot** chip when Wish or Aanya handled first touch.
- Open a *Qualified* card. Details tab = the trip brief (dates · people · pace
  · budget · comfort · food) — the same vocabulary as wishtrip.co.
- **Itinerary tab → Build with AI**: pick the reel package (e.g. "Kerala slow"),
  change nights/pace/comfort, watch the day plan and the transparent price
  rebuild, read the AI notes ("over budget by ₹… — drop one night"). Save as
  draft → **Send to traveller** (message lands in the conversation, stage
  moves to Itinerary sent).
- **AI Assist tab**: score with reasons, summary, next actions, one-click draft.
- Drag a card to **Advance paid**: a Trip and the 25/50/25 payment schedule
  are created automatically.

## 4. Inbox + Wish, the auto-reply agent (3 min)
- Unified WhatsApp / Instagram / Email. AI replies are marked with intent and
  confidence.
- Use **Simulate traveller reply**: "How much for 2 people in December?" →
  auto-sent with the from-price. "Any discount if we pay full now?" →
  **drafted, not sent**, flagged for the consultant. "I want to cancel" →
  escalated with an urgent task. That's the guardrail story.
- Approve a draft from the amber card.

## 5. AI Agents control centre + Aanya (3 min)
- Four agents with on/off and live metrics (containment %, calls handled).
- **Voice agent tab → Test call**: pick a new enquiry, watch the transcript
  play and the trip brief fill in (month, pax, budget, pace). Save → the
  enquiry is Qualified and assigned.
- Review queue: approve/reject what the agents weren't confident about.
- Guardrails: never quotes refunds, escalates cancellations, human review on
  itineraries, max auto-replies, quiet hours.

## 6. Operations in one breath (2 min) — switch to Meera (Operations)
- Trips: departures calendar, a trip's checklist (passports, visa, stays,
  flights, insurance, balance, vouchers, pre-departure, mid-trip, review),
  documents with passport-expiry warnings, "Send vouchers", "Pre-departure
  message".
- Travellers: passport masked, preferences, trips, LTV, referral code.
- Suppliers: hotels/DMCs with rates and payables.

## 7. Money + growth (1 min) — switch to Vikram (Finance) / Priya (Manager)
- Payments: overdue instalments → Send reminder (WhatsApp with Pay Now link),
  Mark paid (invoice + receipt numbers), refunds; supplier payables.
- Campaigns: the live "Comment PLAN → DM" automation, the Diwali broadcast
  funnel (sent → read → replied → leads → bookings), scheduled December
  school-holidays broadcast.
- Reports: funnel, sources, destinations, consultants + **AI impact**, revenue.

## Close
"Everything here runs on the same data model your planner already produces.
Phase 2 is wiring the real channels — WhatsApp Business API, Instagram
messaging, telephony, Razorpay — and swapping the simulated agents for Claude
with the same guardrails." See docs/06-architecture.md.
