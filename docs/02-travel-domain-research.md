# 02 — Travel agency CRM: domain brief

Scope: small-to-mid Indian travel company (Instagram-led, curated itineraries,
honeymoon/family/friends holiday packages, domestic + international). Compiled
2026-10-21 from public vendor material; figures are indicative.

## 1. Sales pipeline stages

| Stage | Entry trigger | Exit / SLA |
|---|---|---|
| New Enquiry | DM / WhatsApp / lead form / call arrives; auto-ack sent | First human (or agent) response. <10 min for ad leads, <1 h for referrals |
| Qualified | Destination, dates, pax, budget captured; junk filtered | Assigned to consultant |
| Itinerary Sent | Branded itinerary/quote link sent; version stamped | Quote turnaround <4 h standard, <24 h custom |
| Negotiation / Revision | No reply, or price/hotel revision requested | Follow-up cadence +24 h, +72 h, +7 d |
| Advance Paid (Booking Confirmed) | Token/advance received (typically 25%, non-refundable) | Booking record created |
| Documents & Visa | Passport scans, photos, visa forms, vouchers | All pax docs complete; balance due |
| Balance Paid / Ready | Final instalment cleared (T-14 and T-7 reminders) | T-24h pre-departure message |
| Travelling | Departure date reached | Day-3 mid-trip check-in |
| Completed | Return + 48 h feedback request | NPS, review, referral, repeat tag |
| Lost / Cancelled | Lost reason or cancellation with refund slab | Refund workflow |

## 2. Core entities and fields

**Enquiry**: name, phone (WhatsApp), email, departure city, destination(s), travel
dates or month + duration, date flexibility, pax adults/children(ages)/infants,
rooms + sharing, budget (pp or total), trip type (couple / honeymoon / family /
friends / solo / parents / corporate), hotel category, inclusions wanted
(flights, visa, meals), pace (slow / balanced / packed), food preference,
source + campaign, consultant, stage, lead score, next follow-up, lost reason,
language.

**Traveller profile**: name as on passport, DOB, gender, nationality, passport
no + issue/expiry (6-month validity rule), visa status per trip, dietary
(veg / Jain / halal), medical notes, frequent-flyer numbers, preferences (seat,
room, pace), anniversary + birthday (upsell triggers), emergency contact.

**Trip / Booking**: booking ref, customer, travellers[], itinerary (day no,
city, title, description, stay, meals B/L/D, transfers, activities),
inclusions/exclusions, hotels (confirmation no), flights (PNR, sector,
times, baggage), visas, insurance, price, taxes, margin, quote version
history, cancellation policy snapshot, special requests.

**Supplier**: type (hotel / DMC / airline consolidator / transport / activity /
visa agent / insurance), contact, contracted rates, payment terms, commission,
payables ledger, performance notes.

**Payments**: schedule (token %, 2nd instalment, balance due ~30–45 d before an
international departure), mode (UPI / Razorpay link / bank transfer / card),
UTR, receipt no, GST invoice (5% without ITC on packages or 18% with ITC on
service fee), refunds by slab, supplier payouts.

**Documents**: passport scan per traveller, photo, visa, tickets, hotel
vouchers, trip voucher, insurance, invoice, receipt, T&C acceptance.

## 3. What leading travel CRMs offer (feature checklist)

Sembark, Moonstride, LeadSquared Travel, Tutterfly, TeleCRM, Travefy, Tern,
Toogo, Travelopro: itinerary builder with templates + versioning; branded quote
PDF/link; WhatsApp inbox + approved templates; auto follow-up sequences; lead
distribution + scoring; supplier rate cards and payables; group departure seat
inventory; payment links + instalment reminders; GST invoice + receipt;
voucher/ticket generation; document vault; dashboards; AI itinerary
import/draft, AI email reader, WhatsApp "notify" automations.

## 4. Travel-specific operational workflows

- **Pre-departure timeline**: T-90 visa start, T-60 visa submitted, T-45 docs
  checklist, T-30 visa confirmed + insurance, T-14 / T-7 balance due, T-3
  packing tips, T-24h vouchers + local contacts, day 3 mid-trip check-in,
  return +48 h feedback.
- **Visa rules per destination**: visa-free (Thailand, Malaysia through 2026),
  VoA / e-visa (Indonesia, Vietnam, UAE; 3–7 working days), appointment-based
  (Schengen, UK, US, Japan via VFS; apply 4–8 weeks out).
- **Instalments**: e.g. 25% token, 50% at T-45, 25% at T-21; WhatsApp utility
  template with Pay Now link; overdue escalation; receipts auto-issued.
- **Cancellation slabs** (common Indian pattern): token non-refundable; 61+ d
  10%, 31–60 d 25–50%, 15–30 d 75%, <15 d 100%; GST non-refundable.
- **Post-trip loop**: 4–5★ → Google/Instagram review + referral code; 1–3★ →
  private resolution ticket.
- **Repeat / upsell**: anniversary & birthday triggers, 6–12 months since last
  trip re-engagement, school-holiday calendars (May–June, Diwali, Dec–Jan).

## 5. KPIs

Lead volume by source · speed to first response · qualified rate · quote rate ·
time to first quote · quote-to-booking (25–35% typical) · enquiry-to-booking ·
sales cycle · pipeline ageing · gross booking value · avg booking value by
destination · revenue by destination/month · cost per booking · cancellation
rate · repeat + referral mix · NPS · bookings per consultant · collections
outstanding · supplier payables · AI agent containment / handoff rate.

## 6. Indian-market specifics

WhatsApp is the primary channel (Business API via BSPs; marketing templates
~₹0.9/msg, utility ~₹0.12/msg, free inside the 24-h service window). Instagram
DMs and comment-to-DM automations ("comment PLAN") are the top source for
Instagram-led brands, then click-to-WhatsApp ads, Google, referrals,
marketplaces. UPI dominates; Razorpay links support partial payments
(advance + balance). Pricing conventions: per person on twin sharing,
ex-city with/without flights, child with/without bed.

## 7. Where AI is applied

Enquiry triage and field extraction from chats · 24/7 auto-reply agents on
WhatsApp/Instagram that collect the trip brief · voice agents that call every
inbound lead within minutes and qualify (Hindi/English/Hinglish) · itinerary
and quote drafting from templates (human review before send) · lead scoring ·
post-booking service routing.

Sources: peakflo.co, telecrm.in, resources.rework.com, sembark.com,
moonstride.com, leadsquared.com, razorpay.com docs, baat.ai, omnidim.io.
