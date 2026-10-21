# 04 — Pipeline, roles and workflows

## Pipeline stages (`src/lib/pipeline.ts`)

| # | Stage | Enters when | Who works it | Agent involvement |
|---|---|---|---|---|
| 1 | **New enquiry** | A comment PLAN / DM / planner submission / WhatsApp / call / form arrives | Unassigned or auto-assigned consultant | Wish replies within seconds with the 3 qualifying questions; Aanya calls new leads within `callNewLeadsWithinMin` |
| 2 | **Contacted** | First reply sent (agent or human) | Consultant | Follow-up agent nudges at +1d / +3d / +7d if no reply |
| 3 | **Qualified** | Dates (or month), pax and budget captured | Consultant | Scoring agent rates 0–100; itinerary agent can draft from a reel package |
| 4 | **Itinerary sent** | Day-by-day plan + price shared as a link | Consultant | Drip: 24h / 72h-availability / 7d; "viewed but silent" flagged for a call |
| 5 | **Revision / Negotiation** | Traveller asks for changes or a better price | Consultant (+Manager for discounts) | Wish drafts (never sends) on discount asks → approval task |
| 6 | **Advance paid** | 25% token received → Trip + payment schedule created | Consultant → Ops hand-off | Booking confirmation + passport request templates |
| 7 | **Docs & visa** | Passports, visa file, stays, flights, insurance | Operations | Passport 6-month rule, visa lead-time tasks per destination |
| 8 | **Ready to travel** | Balance paid, vouchers issued | Operations / trip captain | T-24h pre-departure message |
| 9 | **Travelling** | Departure date reached | Trip captain | Day-2 mid-trip check-in |
| 10 | **Completed** | Return + 48h | Consultant | Review request → 4–5★ public review + referral code, 1–3★ resolution task; anniversary drip |
| — | **Lost** | Reason recorded (price, postponed, competitor, no response ×3…) | Approval by Manager/Admin when AI proposes it | Re-engagement later |
| — | **Non-lead** | Spam, vendors, wrong number | — | — |

Won = Advance paid onwards. Open = New → Negotiation.

## Roles (`src/lib/rbac.ts`)

| Role | Sees | Can |
|---|---|---|
| Administrator | Everything | Team, settings, agent configuration, approvals, all reports |
| Manager | Everything except team/settings | Approvals, campaigns, reassignments, all reports |
| Trip Consultant | Own + unassigned enquiries | Work enquiries, itineraries, inbox, calls, templates, own reports |
| Operations | Trips, travellers, documents, suppliers | Manage trips & checklists, docs, suppliers, tasks |
| Finance | Payments, trips, suppliers, reports | Mark paid, reminders, refunds, payables |
| Viewer | Read-only | Nothing |

## Automated timelines

**Follow-up cadence** (`settings.sla.followUpCadenceDays` = 1, 3, 7): after an
itinerary is sent with no reply, the follow-up agent sends three WhatsApp
nudges, then proposes Lost via an approval task.

**Pre-departure checklist** (relative to departure): advance (−60) ·
passports (−50) · visa (−40, only where needed) · stays confirmed (−35) ·
flights ticketed (−30) · insurance (−21) · balance (−21) · vouchers sent (−7) ·
pre-departure message (−1) · mid-trip check-in (+2) · review request (return
+2).

**Payment schedule** (`settings.payment.schedule`): 25% advance on booking ·
50% at T-45 · 25% at T-21. Overdue → reminder with Pay Now link, Finance task.

**Cancellation slabs**: token non-refundable; 61+ days 10% · 31–60 days 25% ·
15–30 days 50% · <15 days 100%; GST non-refundable.

**Visa rules per destination** (`DESTINATIONS[].visa`): none (domestic) ·
visa-free (Thailand 60d, Malaysia through 2026) · VoA (Bali) · e-visa
(Vietnam 3–5 wd, Dubai 3–4 wd) · embassy (Japan via VFS, 4–6 weeks).
