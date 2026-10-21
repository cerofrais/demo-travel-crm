# 01 — wishtrip: what we learned (research notes)

Compiled 2026-10-21 from wishtrip.co and Instagram @wishtrip.ai. Everything the
demo's seed data, vocabulary and feature set is tuned to.

## The company

- **Brand:** wishtrip — "Travel your way". Operated by **GOTROVE PRIVATE
  LIMITED**. Support: support@wishtrip.co. Website: https://wishtrip.co.
- **Positioning:** "Personalised trip planner & complete itineraries" for
  travellers from India. The product turns interests, preferences and budget
  into a **complete day-by-day plan — flights, stays, experiences, food and
  transparent pricing in one place**.
- **Three promises on the homepage:** *Personalised, not templated* (built from
  your people, pace, budget and interests) · *Real value, fully transparent*
  (see exactly where every rupee goes) · *Complete, day by day*.
- **How it works (site):** 1) Tell us about your trip — who's travelling,
  destination and dates, experiences, pace, comfort level, food preferences,
  budget. 2) Your itinerary takes shape — route, stays, flights/ground
  transport, experiences, meals, estimated pricing. 3) Review and make it yours
  — compare alternatives, adjust pace/preferences; "the plan updates around the
  choices that matter to you."
- **Stage of the business (Terms / Cancellation pages):** planning is live;
  **bookings, payment collection and human concierge are "in development"**.
  The site explicitly says it does not yet take bookings or payments. That is
  exactly the operational layer this CRM provides: once a traveller has a plan,
  someone has to qualify, quote, collect an advance, handle documents/visas,
  vouchers, pre-departure, mid-trip and the post-trip loop.
- **Sign-in:** Google or email magic link ("We'll save your answers and your
  itinerary to your account").

## Destinations and price points (from the site)

| Destination | Tagline on site | From |
|---|---|---|
| Goa (sample 5-day trip) | 5 days · 12 stops · 140 km — Candolim, Fort Aguada/Panaji, Dudhsagar 4×4, Latin Quarter thali, dolphins | — |
| Kerala | Backwaters · tea hills · slow food | ₹44,500 |
| Dharamshala | Mountains · monasteries · momos | ₹36,200 |
| Thailand | Islands · night markets · street food | ₹79,900 |
| Japan | Temples · bullet trains · ramen bars | ₹1,49,000 |

## Instagram (@wishtrip.ai) — the lead engine

- Bio: "wishtrip | inspiration to perfect trips. **Saw a trip on a reel? We
  rebuild it for your dates, budget and pace. Then book it all in one place.**
  Goa · Kerala · …" Link in bio → wishtrip.co. Highlights: Thailand,
  Dharamshala, Kerala, Tips. 12 posts between 30 Sep and 15 Oct 2026 (6 reels,
  5 carousels, 1 photo).
- **Every post ends with the same CTA: "Comment PLAN and we'll rebuild it for
  your dates."** That comment-to-DM flow is the #1 lead source modelled in the
  CRM (`instagram_comment` source, `ig-plan` tag, the "Comment PLAN → DM"
  automation campaign and the `rule_plan` auto-reply rule).
- Posts we mined for packages and seed data:
  - **Goa in 4 days, three versions** (8 Oct): *Couple* — one stay in Agonda,
    Cabo de Rama at sunset, nothing before 10am. *Friends* — Assagao villa,
    scooters, Chapora Fort, Divar Island ferry. *Parents* — Panjim base, Old Goa
    churches early, spice-farm lunch in Ponda. → packages GOA-4D-COUPLE /
    FRIENDS / PARENTS; the `tripType` field (couple / friends / parents / …).
  - **Kerala slow, 5 days** (10 Oct): Fort Kochi → 2 nights Munnar → Kumarakom;
    "Fewer hotel changes, more time where you are." → KER-5D-SLOW and the
    `pace: slow` preference.
  - **Phuket without the crowds** (9 Oct): Kamala Bay instead of Patong, first
    boat to the Hong Islands, Old Town Sunday market, sea canoe in Phang Nga,
    two slow nights on Koh Yao Noi. → THA-6D-PHUKET.
  - **Japan autumn colours** (15 Oct): Kawaguchiko late Oct–mid Nov, Nara
    mid–late Nov, Kyoto late Nov, Tokyo ginkgo late Nov–early Dec; "start at
    the Fuji lakes if travelling during Diwali". → JPN-8D-AUTUMN, the
    `japan-autumn` campaign.
  - **"Your leave is approved. Your budget is ₹1 lakh. Pick your destination"**
    (6 Oct): 7 days, one country — Thailand / Vietnam / Malaysia / Bali. →
    VNM-7D, BALI-7D, MYS-7D at ~₹85–92k.
  - **Diwali (Sun 8 Nov 2026) — how many days can you take off?** (12 Oct):
    3 → Goa, 4 → Dharamshala, 5 → Kerala, 6 → Thailand, 8 → Japan. "Diwali
    dates fill up fast." → the `diwali-2026` WhatsApp broadcast + template.
  - Hidden Japan (3 Oct) and "coffee with a view" (30 Sep) — inspiration posts.
- Audience is small today (41 followers), so the demo assumes a growth phase:
  every comment and DM is precious and must get a reply in minutes — hence
  the voice agent and the auto-reply agent.

## Brand system (lifted from wishtrip.co's CSS tokens)

- Fonts: **Spectral** (display) + **Plus Jakarta Sans** (UI).
- Colours: teal-700 `#0e5e52` (primary), teal-900 `#08423a`, teal-300
  `#57b8a3`; clay-500 `#e8663d` (accent / CTA), saffron-400 `#efa23f` (value);
  sand-50 `#fbf8f2` (background), sand-100 `#f4eee4`, line `#e9e1d4`;
  ink-900 `#16211e` (text), ink-600 `#57635e`; pine-900 `#131d1a` (dark rail).
- Radii 10 / 16 / 22 / 28 px; soft shadows; eyebrow labels with wide tracking.

## What this means for the CRM

1. **Vocabulary** — enquiries are "trips to rebuild", not "leads to close":
   dates · people · pace · budget · comfort · food are first-class fields.
2. **Instagram-first intake** — comment keyword automations, DM threads and
   reel references live on the enquiry card.
3. **Itineraries are the quote** — day-by-day, with stays and a transparent
   price breakdown; versioned; sent as a link.
4. **Operations the site doesn't have yet** — advance, instalments, passports,
   visas, vouchers, pre-departure, trip captain, post-trip review/referral.
5. **AI agents** — Aanya (voice) calls every new enquiry within minutes and
   answers inbound calls; Wish (chat) handles first-touch and FAQs on WhatsApp
   and Instagram and hands off on discounts/cancellations; scoring, itinerary
   drafting and follow-up agents work the queue with human review.
