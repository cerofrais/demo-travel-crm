# 03 — Feature mapping: wellness CRM → wishtrip travel CRM

The starting point (github.com/cerofrais/demo-crm, "Meridian / Trē Wellness
CRM") is a Next.js 14 demo for a wellness retreat: leads → doctor
consultation → booking, with WhatsApp/email messaging, calls, AI assist,
broadcasts, auto-replies, health records, packages, referrals, tasks, reports,
users/permissions. This table says what each of its features became.

| Wellness CRM | Travel CRM (this repo) | Notes |
|---|---|---|
| Leads (Kanban + list, drawer with 8 tabs) | **Enquiries** — Kanban + list, drawer with Details / Itinerary / Conversation / AI Assist / Calls / Trip & payments / Documents / Tasks / Activity | Stages re-cut for travel (see 04-pipeline) |
| Stages: New → Contacted → Call back → Pipeline → RNR → Doctor consultation → Payment pending → Booking confirmed → Converted / Staff / Non-leads / Lost | New enquiry → Contacted → Qualified → Itinerary sent → Revision/Negotiation → Advance paid → Docs & visa → Ready → Travelling → Completed / Lost / Non-lead | "Doctor consultation" has no travel analogue; "RNR" became the follow-up agent + drip campaign |
| Lead card: phone, returning badge, tags, RNR progress, doctor decision, WhatsApp window, tasks, AI score | Enquiry card: destination, dates, pax, budget, source, AI score, bot-handled chip, WhatsApp window, tasks, repeat badge | |
| Guests (+ encrypted health records) | **Travellers** — passport (masked), expiry rule, food/pace/comfort preferences, trips, LTV, referral code | Health records dropped; passport/visa data takes their place |
| Packages & memberships | **Itineraries & Packages** — package templates built from reels, versioned itineraries per enquiry, "Build from a reel" generator | |
| — | **Trips** (bookings) with departure calendar, pre-departure checklist, vouchers, cancel/refund slabs | New |
| — | **Payments & collections** — advance/instalments, payment links, invoices/receipts, overdue chasing, supplier payables | New (wellness had a single "payment pending" stage) |
| — | **Suppliers** — hotels, DMCs, transport, visa, insurance with rates and payables | New |
| Documents (medical/consent/operational/marketing/private) | Documents (passport/photo/visa/ticket/voucher/insurance/invoice/receipt/itinerary) | |
| Email + WhatsApp conversation panels | **Inbox** — unified WhatsApp / Instagram / Email threads with AI drafts and review | Instagram DMs added |
| Calls (Plivo click-to-call, recordings, AI scoring) | **Calls** — voice-agent calls (transcript, extracted fields, outcome) + consultant calls | Voice agent is new |
| AI assist tab (score, summary, next actions, draft) | AI assist tab — same shape, travel-specific reasoning | |
| Auto-replies (keyword/welcome/out-of-hours, email rules, auto-tag) | **Auto-reply agent (Wish)** — intent-based rules, confidence threshold, hand-off topics, draft review, playground | Upgraded from keyword replies to an agent with guardrails |
| Lead assignment (round robin / least busy, campaign/tag/number rules) | Team → Lead assignment (round robin / destination specialist / least busy / manual) | |
| Broadcasts + follow-up jobs | **Campaigns** — Instagram comment/story automations, WhatsApp broadcasts, drips | |
| Message templates (folders, variables) | Templates — folders, channel, Meta-approved flag, variables | |
| Referrals (codes, QR) | Reviews & Referrals — post-trip loop + codes | |
| Tasks (follow-up, doctor review, lost approval, payment chase) | Tasks (follow-up, callback, payment reminder, document, visa, pre-departure, mid-trip, post-trip, review, approval) | |
| Reports (performance, source × stage, marketing CSV, weekly) | Reports (funnel, sources, destinations, consultants + AI impact, revenue) | |
| AI audit log | AI Agents → Activity feed + Review queue | |
| Ask the Database | Not ported (out of scope for the demo) | Candidate for phase 2 |
| Users, permissions, activity log, settings | Team, Activity, Settings | Roles: Admin, Manager, Trip Consultant, Operations, Finance, Viewer |
| Keycloak OIDC, Postgres/Prisma, Redis, MinIO, Docker | Demo mode only: cookie session + localStorage store | Production path in 05-architecture |
