# wishtrip Travel CRM (demo)

A travel-domain CRM built for [wishtrip](https://wishtrip.co) ("Saw a trip on a
reel? We rebuild it for your dates, budget and pace"), starting from the
[demo-crm](https://github.com/cerofrais/demo-crm) wellness CRM and re-cut for a
trip-planning company: Instagram-to-booking pipeline, itineraries rebuilt from
reels, travellers & travel documents, trips with pre-departure checklists,
payments & collections, suppliers, campaigns — plus two autonomous agents
(**Aanya**, a voice agent, and **Wish**, an auto-reply agent) with human
review built in.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · lucide · dnd-kit.
**No backend needed for the demo** — every record lives in a localStorage
store seeded with realistic data (deterministic generator, dates relative to
today). See [docs/06-architecture.md](docs/06-architecture.md) for the
production path (Postgres/Prisma, Keycloak, Redis, MinIO, WhatsApp/Instagram
APIs, telephony, Claude).

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Pick a role on the login screen — nothing is real; "Reset demo data" in the
footer reseeds.

| Role | Lands on | Try |
|---|---|---|
| Administrator (Aarav) | Dashboard | AI Agents → configure Aanya / Wish, review queue; Team; Settings |
| Manager (Priya) | Dashboard | Approvals in Tasks, Campaigns, Reports |
| Trip Consultant (Rohan) | Dashboard | Enquiries kanban → open a card → Itinerary tab → *Build with AI* → *Send*; Inbox → *Simulate traveller reply* |
| Operations (Meera) | Trips | A trip → checklist, documents, vouchers, pre-departure message |
| Finance (Vikram) | Payments | Overdue instalments → *Send reminder* / *Mark paid* |
| Viewer | Dashboard | Read-only walkthrough |

## What's in the box

- **Dashboard** — new enquiries, median first response, pipeline value,
  booked revenue, conversion, overdue collections; needs-attention list, AI
  agent activity, pipeline/source/destination charts, due tasks, departures.
- **Enquiries** — Kanban (drag between stages, lost-reason dialog, booking
  auto-created on *Advance paid*) and list; drawer with Details (dates ·
  people · pace · budget · comfort · food), Itinerary versions (build with AI,
  send, accept), Conversation, AI Assist (score + reasons, summary, next
  actions, draft), Calls (voice agent), Trip & payments, Documents, Tasks,
  Activity; new-enquiry dialog with returning-traveller detection and
  "have Aanya call them now".
- **Inbox** — unified WhatsApp / Instagram / Email threads; AI replies marked
  with intent & confidence; drafts needing review; templates; traveller-reply
  simulator to show the agent decide (auto-send / draft / escalate).
- **AI Agents** — control centre: Aanya (voice) and Wish (auto-reply) config,
  live metrics, review queue, activity feed, rules, playground, guardrails.
- **Calls** — voice-agent and consultant calls with transcripts, extracted
  trip brief, outcome, quality; create an enquiry from a call.
- **Trips** — bookings with departure calendar, countdown, checklist (visa,
  passports, stays, flights, insurance, balance, vouchers, pre-departure,
  mid-trip, review), travellers, payments, documents, cancellation with
  refund slabs.
- **Travellers** — profiles with passport (masked) and 6-month validity
  warnings, preferences, trips, LTV, referral codes.
- **Itineraries & Packages** — package library built from wishtrip's reels
  (Goa ×3, Kerala, Dharamshala, Phuket, Japan ×2, Vietnam, Bali, Malaysia),
  "build from a reel" generator with transparent pricing, all sent itineraries.
- **Payments** — advance / instalments / balance, payment links, invoices &
  receipts, reminders, refunds, supplier payables, collections forecast.
- **Suppliers** — hotels, DMCs, transport, activities, visa, insurance.
- **Tasks** — follow-ups (1/3/7-day cadence), callbacks, payment reminders,
  documents, visa, pre-departure, mid-trip, post-trip, approvals.
- **Campaigns** — Instagram "comment PLAN" automation, story replies, WhatsApp
  broadcasts (Diwali long weekend, December school holidays), drips.
- **Templates**, **Reviews & Referrals**, **Reports** (funnel, sources,
  destinations, consultants + AI impact, revenue), **Team** (members, role
  matrix, lead assignment), **Activity log**, **Settings**.

## Docs

1. [wishtrip research](docs/01-wishtrip-research.md) — what the site and the
   Instagram posts told us, and how it shaped the product.
2. [Travel-agency CRM domain brief](docs/02-travel-domain-research.md).
3. [Feature mapping from the wellness CRM](docs/03-feature-mapping.md).
4. [Pipeline, roles and workflows](docs/04-pipeline-and-workflows.md).
5. [AI agents](docs/05-ai-agents.md).
6. [Architecture & production path](docs/06-architecture.md).

## Scripts

`npm run dev` · `npm run build` · `npm start` · `npm run typecheck` ·
`npm run lint` · `npm test`
