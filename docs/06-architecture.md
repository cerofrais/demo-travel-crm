# 06 — Architecture

## This demo

```
Browser
 ├─ Next.js 14 App Router (client components)
 ├─ Demo session cookie (role picker on /login) → middleware route gating by RBAC
 └─ Demo store: one DemoData JSON in localStorage (src/lib/demo/store.ts)
      ├─ seed-static.ts  team, destinations, packages, suppliers, templates, rules, settings
      ├─ seed.ts         deterministic generator for travellers, enquiries, itineraries,
      │                  trips, payments, docs, messages, calls, tasks, campaigns, events…
      ├─ queries.ts      pure selectors
      └─ use-db.ts       React subscription hook
 AI simulations (src/lib/ai): itinerary · scoring · autoreply · assist · voice-agent
```

No server, no database: `npm run dev` or a static Vercel deploy is enough.
"Reset demo data" (footer / Settings) reseeds.

## Production path (same stack as the wellness CRM)

- **Next.js 14 + TypeScript** stays. Client components keep their shape; the
  store calls become `/api/*` route handlers (or server actions) — the
  selectors in `queries.ts` map 1:1 to Prisma queries.
- **Postgres + Prisma** — `types.ts` is the schema: Traveller, Enquiry,
  Itinerary(+Day/Stay/Flight JSON), PackageTemplate, Trip(+Checklist),
  Payment, Supplier, Document, Message, Call, Task, Campaign, MessageTemplate,
  AutoReplyRule, AgentEvent, Review, Referral, Activity, Settings.
- **Keycloak OIDC** with realm roles `crm-admin`, `crm-manager`, `crm-sales`,
  `crm-ops`, `crm-finance`, `crm-viewer` mapping to `AppRole`.
- **Redis** for queues (follow-up cadence, reminders, agent jobs), **MinIO/S3**
  for documents (presigned uploads), **Mailhog/Resend** for email.
- **Channels:** WhatsApp Business API (BSP: WATI / Interakt / AiSensy, or
  Meta Cloud API directly), Instagram Messaging API (comment → DM
  automations, story replies), Plivo/Exotel telephony for the voice agent,
  Razorpay payment links with partial payments (advance + balance).
- **AI:** Claude (Anthropic) via the same function signatures in
  `src/lib/ai/*` — classify + reply (tools: read enquiry, draft itinerary,
  create task), itinerary generation grounded in the package library and
  supplier rate cards, scoring, call summarisation; a realtime voice stack for
  Aanya. Every inference writes an `AgentEvent` with prompt, output, confidence
  and reviewer for audit.
- **Deployment:** Docker Compose (postgres, redis, keycloak, minio, app) as in
  the wellness CRM; Vercel for the demo branch.

## Repository layout

```
src/app/(app)/<route>/page.tsx   thin client pages inside the shell
src/components/<area>/           enquiries, trips, travellers, itineraries, payments,
                                 suppliers, documents, conversation, inbox, agents,
                                 calls, tasks, campaigns, templates, reviews, reports,
                                 users, activity, settings, dashboard
src/components/ui, shared.tsx    primitives + shared widgets (ported design system)
src/lib/demo                     types, store, seed, queries, session
src/lib/ai                       agent simulations
src/lib/pipeline.ts, rbac.ts     stage/role definitions
docs/                            research, mapping, pipeline, agents, architecture
```
