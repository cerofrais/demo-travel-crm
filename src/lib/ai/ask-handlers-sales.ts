/**
 * Ask the data — handlers for pipeline / revenue questions.
 */
import { enquiryById, isWon, threads, userName } from "@/lib/demo/queries";
import { formatDate, formatINR, pluralize } from "@/lib/utils";
import {
  type AskHandler,
  type Row,
  GROUP_COLUMN,
  GROUP_LABEL,
  cap,
  daysBetween,
  describeFilters,
  enquiryRow,
  enquiryWhere,
  filterEnquiries,
  groupKey,
  inRange,
  pct,
  rangeWhere,
  sql,
  tally,
  tripGroupKey,
  tripRow,
  visibleTrips,
} from "./ask-util";

const WON_STAGES_SQL = "('advance_paid','docs_visa','ready','travelling','completed')";

/** Count / list enquiries, optionally grouped. */
export const enquiriesHandler: AskHandler = {
  id: "enquiries",
  examples: ["How many enquiries came from Instagram this week?", "Enquiries by source last 30 days", "Show me open Japan honeymoon leads"],
  match: (q) => q.entity === "enquiries" || (!q.entity && Boolean(q.filters.source || q.filters.stage || q.filters.destination || q.groupBy)),
  run: (q, ctx) => {
    const list = filterEnquiries(ctx.enquiries, q.filters).filter((e) => inRange(e.createdAt, q.range));
    const where = [...enquiryWhere(q.filters, ctx), ...rangeWhere("created_at", q.range)];
    const scope = `${describeFilters(q.filters, ctx)} (${q.range.label})`;
    if (q.groupBy) {
      const col = GROUP_COLUMN[q.groupBy];
      const chart = tally(list, (e) => groupKey(e, q.groupBy!, ctx));
      const rows = chart.map((c) => ({ [GROUP_LABEL[q.groupBy!]]: c.label, Enquiries: c.value, Share: `${pct(c.value, list.length)}%` }));
      return {
        mode: "table",
        text: `${pluralize(list.length, "enquiry", "enquiries")}${scope}, split by ${GROUP_LABEL[q.groupBy].toLowerCase()}.${chart[0] ? ` ${chart[0].label} leads with ${chart[0].value}.` : ""}${ctx.scopeNote}`,
        columns: [GROUP_LABEL[q.groupBy], "Enquiries", "Share"],
        rows,
        chart,
        query: sql(`${col}, COUNT(*)`, "enquiries", where, `GROUP BY ${col} ORDER BY 2 DESC`),
      };
    }
    const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const rows = cap(sorted).map((e) => enquiryRow(e, ctx));
    return {
      mode: "table",
      text: `${pluralize(list.length, "enquiry", "enquiries")}${scope}.${list.length > rows.length ? ` Showing the latest ${rows.length}.` : ""}${ctx.scopeNote}`,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
      query: sql(q.metric === "count" ? "COUNT(*)" : "ref, traveller, destination, stage, source, assigned_to, created_at", "enquiries", where, q.metric === "count" ? "" : "ORDER BY created_at DESC LIMIT 50"),
    };
  },
};

/** Bookings: count, booked value, departures. */
export const tripsHandler: AskHandler = {
  id: "trips",
  examples: ["Booked value by destination this month", "Departures in the next 14 days", "How many bookings last month?"],
  match: (q) => q.entity === "trips",
  run: (q, ctx) => {
    const byDeparture = q.range.future || /\bdepart|leaving|travelling|start/.test(q.lower);
    const dateCol = byDeparture ? "start_date" : "created_at";
    const enquiryOf = (id: string) => enquiryById(ctx.db, id);
    let list = visibleTrips(ctx).filter((t) => inRange(byDeparture ? t.startDate : t.createdAt, q.range));
    if (q.filters.status) list = list.filter((t) => t.status === q.filters.status);
    else list = list.filter((t) => t.status !== "cancelled");
    if (q.filters.destination) list = list.filter((t) => t.destinationId === q.filters.destination);
    if (q.filters.source || q.filters.tripType || q.filters.consultantSub) {
      list = list.filter((t) => {
        const e = enquiryOf(t.enquiryId);
        return e ? filterEnquiries([e], { source: q.filters.source, tripType: q.filters.tripType, consultantSub: q.filters.consultantSub }).length === 1 : false;
      });
    }
    const where = [...rangeWhere(dateCol, q.range), q.filters.status ? `status = '${q.filters.status}'` : "status <> 'cancelled'"];
    if (q.filters.destination) where.push(`destination_id = '${q.filters.destination}'`);
    const total = list.reduce((s, t) => s + t.totalINR, 0);
    const isValue = q.metric === "sum";
    const scope = `${describeFilters({ destination: q.filters.destination, source: q.filters.source, tripType: q.filters.tripType, consultantSub: q.filters.consultantSub }, ctx)} (${byDeparture ? "departing " : ""}${q.range.label})`;
    if (q.groupBy) {
      const col = GROUP_COLUMN[q.groupBy].replace("created_at", dateCol);
      const chart = tally(list, (t) => tripGroupKey(t, q.groupBy!, ctx, enquiryOf(t.enquiryId)), isValue ? (t) => t.totalINR : () => 1);
      const counts = tally(list, (t) => tripGroupKey(t, q.groupBy!, ctx, enquiryOf(t.enquiryId)));
      const values = tally(list, (t) => tripGroupKey(t, q.groupBy!, ctx, enquiryOf(t.enquiryId)), (t) => t.totalINR);
      const rows = chart.map((c) => ({ [GROUP_LABEL[q.groupBy!]]: c.label, Bookings: counts.find((x) => x.label === c.label)?.value ?? 0, "Booked value": formatINR(values.find((x) => x.label === c.label)?.value ?? 0) }));
      return {
        mode: "table",
        text: `${pluralize(list.length, "booking")} worth ${formatINR(total)}${scope}, by ${GROUP_LABEL[q.groupBy].toLowerCase()}.${chart[0] ? ` ${chart[0].label} is top with ${isValue ? formatINR(chart[0].value) : chart[0].value}.` : ""}${ctx.scopeNote}`,
        columns: [GROUP_LABEL[q.groupBy], "Bookings", "Booked value"],
        rows,
        chart,
        query: sql(`${col}, COUNT(*), SUM(total_inr)`, "trips", where, `GROUP BY ${col} ORDER BY ${isValue ? 3 : 2} DESC`),
      };
    }
    const sorted = [...list].sort((a, b) => (byDeparture ? a.startDate.localeCompare(b.startDate) : b.createdAt.localeCompare(a.createdAt)));
    const rows = cap(sorted).map((t) => tripRow(t, ctx));
    return {
      mode: "table",
      text: `${pluralize(list.length, "booking")}${scope}, booked value ${formatINR(total)}${isValue ? "" : `, ${formatINR(list.reduce((s, t) => s + t.paidINR, 0))} collected so far`}.${ctx.scopeNote}`,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
      query: sql(isValue ? "COUNT(*), SUM(total_inr)" : "ref, traveller, destination, start_date, pax, status, total_inr, paid_inr", "trips", where, isValue ? "" : `ORDER BY ${dateCol} ${byDeparture ? "ASC" : "DESC"} LIMIT 50`),
    };
  },
};

/** Revenue / booked value without naming trips explicitly ("revenue by month"). */
export const revenueHandler: AskHandler = {
  id: "revenue",
  examples: ["Revenue by month", "Booked value by destination this month", "How much did we collect last month?"],
  match: (q) => /\b(revenue|booked value|booking value|sales|collected|collections|turnover|how much)\b/.test(q.lower) && (!q.entity || q.entity === "trips" || q.entity === "payments" || q.entity === "enquiries"),
  run: (q, ctx) => {
    const collected = /\b(collect(ed|ions?)?|received|paid in)\b/.test(q.lower);
    if (collected) {
      const trips = new Map(visibleTrips(ctx).map((t) => [t.id, t]));
      const paid = ctx.db.payments.filter((p) => p.status === "paid" && trips.has(p.tripId) && inRange(p.paidAt ?? p.dueAt, q.range));
      const total = paid.reduce((s, p) => s + p.amountINR, 0);
      const by = q.groupBy ?? "month";
      const chart = tally(paid, (p) => tripGroupKey(trips.get(p.tripId)!, by, ctx, enquiryById(ctx.db, trips.get(p.tripId)!.enquiryId)), (p) => p.amountINR);
      return {
        mode: "table",
        text: `${formatINR(total)} collected across ${pluralize(paid.length, "payment")} (${q.range.label}), by ${GROUP_LABEL[by].toLowerCase()}.${ctx.scopeNote}`,
        columns: [GROUP_LABEL[by], "Collected"],
        rows: chart.map((c) => ({ [GROUP_LABEL[by]]: c.label, Collected: formatINR(c.value) })),
        chart,
        query: sql(`${GROUP_COLUMN[by].replace("created_at", "paid_at")}, SUM(amount_inr)`, "payments p JOIN trips t ON t.id = p.trip_id", ["p.status = 'paid'", ...rangeWhere("paid_at", q.range)], `GROUP BY 1 ORDER BY 2 DESC`),
      };
    }
    return tripsHandler.run({ ...q, entity: "trips", metric: "sum", groupBy: q.groupBy ?? "destination" }, ctx);
  },
};

/** Enquiry → booking conversion, overall or grouped. */
export const conversionHandler: AskHandler = {
  id: "conversion",
  examples: ["Conversion rate by source last 30 days", "What's our conversion rate this month?", "Win rate by destination"],
  match: (q) => /\b(conversion|convert|win rate|close rate|closing rate|booking rate|hit rate)\b/.test(q.lower),
  run: (q, ctx) => {
    const list = filterEnquiries(ctx.enquiries, { ...q.filters, stage: undefined }).filter((e) => inRange(e.createdAt, q.range) && e.stage !== "non_lead");
    const won = list.filter(isWon);
    const where = [...enquiryWhere({ ...q.filters, stage: undefined }, ctx), ...rangeWhere("created_at", q.range), "stage <> 'non_lead'"];
    const by = q.groupBy ?? (/\bby\b/.test(q.lower) ? "source" : undefined);
    if (by) {
      const all = tally(list, (e) => groupKey(e, by, ctx));
      const wonBy = tally(won, (e) => groupKey(e, by, ctx));
      const rows = all.map((g) => {
        const w = wonBy.find((x) => x.label === g.label)?.value ?? 0;
        return { [GROUP_LABEL[by]]: g.label, Enquiries: g.value, Booked: w, "Conversion %": pct(w, g.value) };
      });
      rows.sort((a, b) => Number(b["Conversion %"]) - Number(a["Conversion %"]));
      return {
        mode: "table",
        text: `Overall ${pct(won.length, list.length)}% (${won.length} of ${list.length}) converted${describeFilters({ ...q.filters, stage: undefined }, ctx)} (${q.range.label}).${rows[0] ? ` Best ${GROUP_LABEL[by].toLowerCase()}: ${rows[0][GROUP_LABEL[by]]} at ${rows[0]["Conversion %"]}%.` : ""}${ctx.scopeNote}`,
        columns: [GROUP_LABEL[by], "Enquiries", "Booked", "Conversion %"],
        rows,
        chart: rows.map((r) => ({ label: String(r[GROUP_LABEL[by]]), value: Number(r["Conversion %"]) })),
        query: sql(`${GROUP_COLUMN[by]}, COUNT(*) AS enquiries, COUNT(*) FILTER (WHERE stage IN ${WON_STAGES_SQL}) AS booked, ROUND(100.0 * booked / enquiries, 1) AS conversion_pct`, "enquiries", where, `GROUP BY 1 ORDER BY 4 DESC`),
      };
    }
    const lost = list.filter((e) => e.stage === "lost").length;
    const open = list.length - won.length - lost;
    return {
      mode: "table",
      text: `${pct(won.length, list.length)}% of enquiries${describeFilters({ ...q.filters, stage: undefined }, ctx)} converted to bookings (${q.range.label}): ${won.length} booked, ${lost} lost, ${open} still open out of ${list.length}.${ctx.scopeNote}`,
      columns: ["Metric", "Value"],
      rows: [
        { Metric: "Enquiries", Value: list.length },
        { Metric: "Booked", Value: won.length },
        { Metric: "Lost", Value: lost },
        { Metric: "Still open", Value: open },
        { Metric: "Conversion %", Value: pct(won.length, list.length) },
      ],
      chart: [
        { label: "Booked", value: won.length },
        { label: "Lost", value: lost },
        { label: "Open", value: open },
      ],
      query: sql(`COUNT(*) AS enquiries, COUNT(*) FILTER (WHERE stage IN ${WON_STAGES_SQL}) AS booked, ROUND(100.0 * booked / COUNT(*), 1) AS conversion_pct`, "enquiries", where),
    };
  },
};

/** Open enquiries with AI score ≥ 75. */
export const hotLeadsHandler: AskHandler = {
  id: "hot_leads",
  examples: ["Hot leads", "Show me warm leads for Bali", "Best leads this week"],
  match: (q) => Boolean(q.filters.hot) && (!q.entity || q.entity === "enquiries"),
  run: (q, ctx) => {
    const list = filterEnquiries(ctx.enquiries, { ...q.filters, hot: true, stage: q.filters.stage ?? "open" })
      .filter((e) => inRange(e.createdAt, q.range) && !isWon(e))
      .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0));
    const rows: Row[] = cap(list).map((e) => ({ ...enquiryRow(e, ctx), "Next action": e.aiNextAction ?? "—" }));
    return {
      mode: "table",
      text: `${pluralize(list.length, "hot lead")} (AI score ≥ 75, not yet booked)${describeFilters({ ...q.filters, hot: undefined, stage: undefined }, ctx)} (${q.range.label}).${rows[0] ? ` Top: ${rows[0].Traveller} — ${rows[0].Destination} at ${rows[0].Score}.` : ""}${ctx.scopeNote}`,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
      query: sql("ref, traveller, destination, stage, ai_score, ai_next_action, assigned_to", "enquiries", [...enquiryWhere({ ...q.filters, hot: true, stage: q.filters.stage ?? "open" }, ctx), "stage NOT IN ('advance_paid','docs_visa','ready','travelling')", ...rangeWhere("created_at", q.range)], "ORDER BY ai_score DESC LIMIT 50"),
    };
  },
};

/** Enquiries where the traveller wrote last and nobody has replied. */
export const unansweredHandler: AskHandler = {
  id: "unanswered",
  examples: ["Enquiries with no reply for 3 days", "Unanswered enquiries", "Who is waiting for a reply?"],
  match: (q) => q.filters.noReplyDays !== undefined && q.entity !== "calls",
  run: (q, ctx) => {
    const minDays = q.filters.noReplyDays ?? 0;
    const waiting = threads(ctx.db).filter((t) => t.unanswered);
    const byEnquiry = new Map<string, { at: string; channel: string }>();
    for (const t of waiting) {
      const e = t.enquiryId ? enquiryById(ctx.db, t.enquiryId) : ctx.enquiries.find((x) => x.travellerId === t.travellerId && !["completed", "lost", "non_lead"].includes(x.stage));
      if (e && ctx.visibleEnquiryIds.has(e.id) && !byEnquiry.has(e.id)) byEnquiry.set(e.id, { at: t.last.at, channel: t.channel });
    }
    const list = filterEnquiries(ctx.enquiries, { ...q.filters, noReplyDays: undefined })
      .filter((e) => byEnquiry.has(e.id) && !["completed", "lost", "non_lead"].includes(e.stage))
      .map((e) => ({ e, waitDays: daysBetween(byEnquiry.get(e.id)!.at, ctx.now), channel: byEnquiry.get(e.id)!.channel, at: byEnquiry.get(e.id)!.at }))
      .filter((x) => x.waitDays >= minDays)
      .sort((a, b) => b.waitDays - a.waitDays);
    const rows = cap(list).map(({ e, waitDays, channel, at }) => ({ Ref: e.ref, Traveller: ctx.db.travellers.find((t) => t.id === e.travellerId)?.fullName ?? "—", Destination: e.destination, Stage: enquiryRow(e, ctx).Stage, Channel: channel, "Last message": formatDate(at), "Waiting (days)": waitDays, Owner: userName(ctx.db, e.assignedTo) }));
    return {
      mode: "table",
      text: `${pluralize(list.length, "enquiry", "enquiries")} waiting on us${minDays ? ` for ${minDays}+ days` : ""}${describeFilters({ ...q.filters, noReplyDays: undefined }, ctx)}.${rows[0] ? ` Longest: ${rows[0].Traveller} (${rows[0]["Waiting (days)"]} days).` : ""}${ctx.scopeNote}`,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
      query: sql("e.ref, e.traveller, e.destination, e.stage, m.channel, MAX(m.at) AS last_inbound, NOW() - MAX(m.at) AS waiting", "enquiries e JOIN messages m ON m.enquiry_id = e.id", [...enquiryWhere({ ...q.filters, noReplyDays: undefined, stage: "open" }, ctx), "m.direction = 'inbound'", "NOT EXISTS (SELECT 1 FROM messages o WHERE o.enquiry_id = e.id AND o.direction = 'outbound' AND o.at > m.at)", ...(minDays ? [`m.at <= NOW() - INTERVAL '${minDays} days'`] : [])], "GROUP BY 1,2,3,4,5 ORDER BY last_inbound ASC"),
    };
  },
};

/** Destinations ranked by enquiry demand. */
export const topDestinationsHandler: AskHandler = {
  id: "top_destinations",
  examples: ["Top destinations by demand", "Which destinations are most popular this month?", "Top 5 destinations by bookings"],
  match: (q) => /\bdestinations?\b/.test(q.lower) && (q.metric === "top" || /\bdemand|popular|trending|most enquired|ranked?\b/.test(q.lower)) && q.entity !== "trips",
  run: (q, ctx) => {
    const list = filterEnquiries(ctx.enquiries, { ...q.filters, destination: undefined }).filter((e) => inRange(e.createdAt, q.range) && e.stage !== "non_lead");
    const demand = tally(list, (e) => e.destination).slice(0, q.limit ?? 12);
    const won = tally(list.filter(isWon), (e) => e.destination);
    const rows = demand.map((d) => ({ Destination: d.label, Enquiries: d.value, Booked: won.find((w) => w.label === d.label)?.value ?? 0, "Conversion %": pct(won.find((w) => w.label === d.label)?.value ?? 0, d.value) }));
    return {
      mode: "table",
      text: `${demand[0] ? `${demand[0].label} leads demand with ${pluralize(demand[0].value, "enquiry", "enquiries")}` : "No enquiries"} (${q.range.label}). ${pluralize(list.length, "enquiry", "enquiries")} across ${demand.length} destinations.${ctx.scopeNote}`,
      columns: ["Destination", "Enquiries", "Booked", "Conversion %"],
      rows,
      chart: demand,
      query: sql("destination, COUNT(*) AS enquiries, COUNT(*) FILTER (WHERE stage IN " + WON_STAGES_SQL + ") AS booked", "enquiries", [...enquiryWhere({ ...q.filters, destination: undefined }, ctx), ...rangeWhere("created_at", q.range), "stage <> 'non_lead'"], `GROUP BY destination ORDER BY 2 DESC LIMIT ${q.limit ?? 12}`),
    };
  },
};

/** Average first response time, AI vs human and by source. */
export const responseTimeHandler: AskHandler = {
  id: "response_time",
  examples: ["Average first response time", "How fast do we reply to Instagram leads?", "Response time by consultant"],
  match: (q) => /\b(response time|first response|reply time|respond(ed)? (in|within)|how fast|how quickly|time to (first )?reply|sla)\b/.test(q.lower),
  run: (q, ctx) => {
    const list = filterEnquiries(ctx.enquiries, q.filters).filter((e) => inRange(e.createdAt, q.range) && e.firstResponseMinutes !== undefined);
    const avg = (xs: typeof list) => (xs.length ? Math.round((xs.reduce((s, e) => s + (e.firstResponseMinutes ?? 0), 0) / xs.length) * 10) / 10 : 0);
    const by = q.groupBy ?? "source";
    const groups = new Map<string, typeof list>();
    for (const e of list) {
      const k = by === "consultant" ? (e.handledByAgent ? "Aanya / Wish (AI)" : userName(ctx.db, e.assignedTo)) : groupKey(e, by, ctx);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    const rows = Array.from(groups, ([label, xs]) => ({ [GROUP_LABEL[by]]: label, Enquiries: xs.length, "Avg first response (min)": avg(xs), "Within SLA %": pct(xs.filter((e) => (e.firstResponseMinutes ?? 0) <= ctx.db.settings.sla.firstResponseMin).length, xs.length) })).sort((a, b) => Number(a["Avg first response (min)"]) - Number(b["Avg first response (min)"]));
    const ai = list.filter((e) => e.handledByAgent);
    const human = list.filter((e) => !e.handledByAgent);
    return {
      mode: "table",
      text: `Average first response is ${avg(list)} min across ${pluralize(list.length, "enquiry", "enquiries")}${describeFilters(q.filters, ctx)} (${q.range.label}) — AI-handled ${avg(ai)} min vs consultant ${avg(human)} min. SLA target ${ctx.db.settings.sla.firstResponseMin} min.${ctx.scopeNote}`,
      columns: [GROUP_LABEL[by], "Enquiries", "Avg first response (min)", "Within SLA %"],
      rows,
      chart: rows.map((r) => ({ label: String(r[GROUP_LABEL[by]]), value: Number(r["Avg first response (min)"]) })),
      query: sql(`${GROUP_COLUMN[by]}, COUNT(*), ROUND(AVG(first_response_minutes), 1) AS avg_min`, "enquiries", [...enquiryWhere(q.filters, ctx), ...rangeWhere("created_at", q.range), "first_response_minutes IS NOT NULL"], "GROUP BY 1 ORDER BY 3 ASC"),
    };
  },
};

export const SALES_HANDLERS: AskHandler[] = [conversionHandler, responseTimeHandler, unansweredHandler, hotLeadsHandler, topDestinationsHandler, revenueHandler, tripsHandler, enquiriesHandler];
