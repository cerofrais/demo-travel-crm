# 08 — Deploying the demo, and changelog

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000 → /login role picker
npm run typecheck    # tsc --noEmit
npm test             # vitest: seed integrity, auto-reply agent, itinerary pricing
npm run build && npm start
```

No environment variables are required. All data is generated in the browser
(`src/lib/demo/seed.ts`) and persisted to localStorage under
`wishtrip_crm_demo_v1`; bump `SEED_VERSION` in `src/lib/demo/store.ts` to
force every visitor to reseed after a data-shape change.

## Deploy (Vercel or any Node host)

- Vercel: import the GitHub repo, framework = Next.js, no env vars. Every
  route is server-rendered on demand (the role cookie is read in layouts), so
  the default Node runtime is fine.
- Docker: `node:20-alpine`, `npm ci && npm run build`, `npm start` on port
  3000.
- The demo is safe to share publicly: nothing it shows is real, and nothing
  it does leaves the browser.

## Demo logins

Any role on the login screen; no password. Roles: Administrator (Aarav),
Manager (Priya), Trip Consultant (Rohan), Operations (Meera), Finance
(Vikram), Viewer.

## Changelog

**2026-10-22 — v0.1 (first push)**
- Research: wishtrip.co + @wishtrip.ai (docs/01), travel-agency CRM domain
  (docs/02), feature mapping from the wellness CRM (docs/03).
- Foundation: wishtrip design tokens, UI kit ported from demo-crm, cookie
  session + RBAC (6 roles), localStorage store with a deterministic seed
  (62 enquiries, 23 trips, 69 payments, 190+ messages, 13 calls, 40+ tasks,
  6 campaigns, 15 templates, 7 auto-reply rules, 90+ agent events).
- Pages: Dashboard, Enquiries (kanban + drawer), Inbox, Tasks, Trips (+
  detail), Travellers, Itineraries & Packages, Payments, Suppliers, AI
  Agents, Calls, Campaigns, Templates, Reviews & Referrals, Reports, Team,
  Activity, Settings.
- Agents (simulated, same signatures as the production design): Aanya
  voice agent, Wish auto-reply agent, scoring, itinerary generator,
  follow-up / assignment.
- Quality: `tsc` clean, ESLint clean, 16 unit tests, `next build` passes.

**Known gaps / phase 2 candidates**
- Channels, telephony, payments and the AI models are simulated — see
  docs/06 for the production wiring.
- "Ask the database" from the wellness CRM was not ported.
- Group departures with seat inventory (fixed-date group trips) are not
  modelled; wishtrip sells personalised trips, so this was left out.
- Dark mode tokens exist but there is no toggle.
