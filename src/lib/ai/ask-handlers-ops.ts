/**
 * Ask the data — handlers for operations questions (payments, tasks, calls,
 * passports, itineraries, campaigns, messages, travellers).
 */
import { enquiryById, travellerById, tripById, userName } from "@/lib/demo/queries";
import { CHANNEL_LABEL, TASK_KIND_LABEL } from "@/lib/pipeline";
import { formatDate, formatINR, pluralize } from "@/lib/utils";
import { type AskHandler, cap, daysBetween, inRange, pct, rangeWhere, sql, tally, visiblePayments, visibleTasks, visibleTrips } from "./ask-util";

/** Overdue / due / paid instalments. */
export const paymentsHandler: AskHandler = {
  id: "payments",
  examples: ["Overdue payments", "Payments due in the next 7 days", "How much was collected this month?"],
  match: (q) => q.entity === "payments" || (Boolean(q.filters.overdue) && !q.entity),
  run: (q, ctx) => {
    const status = q.filters.overdue ? "overdue" : q.filters.status ?? (q.range.future ? "pending" : undefined);
    let list = visiblePayments(ctx);
    if (status === "overdue") list = list.filter((p) => p.status === "overdue" || (p.status === "pending" && new Date(p.dueAt) < ctx.now));
    else if (status) list = list.filter((p) => p.status === status);
    const dateCol = status === "paid" ? "paid_at" : "due_at";
    list = list.filter((p) => inRange(status === "paid" ? p.paidAt ?? p.dueAt : p.dueAt, q.range));
    if (q.filters.destination) list = list.filter((p) => tripById(ctx.db, p.tripId)?.destinationId === q.filters.destination);
    list.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const total = list.reduce((s, p) => s + p.amountINR, 0);
    const rows = cap(list).map((p) => {
      const trip = tripById(ctx.db, p.tripId);
      return {
        Traveller: travellerById(ctx.db, p.travellerId)?.fullName ?? "—",
        "Trip ref": trip?.ref ?? "—",
        Destination: trip?.destination ?? "—",
        Instalment: p.label,
        Amount: formatINR(p.amountINR),
        Due: formatDate(p.dueAt),
        "Days overdue": p.status === "paid" ? null : Math.max(0, daysBetween(p.dueAt, ctx.now)),
        Status: p.status,
        Reminders: p.reminderCount,
      };
    });
    const where = [...(status === "overdue" ? ["(status = 'overdue' OR (status = 'pending' AND due_at < NOW()))"] : status ? [`status = '${status}'`] : []), ...rangeWhere(dateCol, q.range)];
    const label = status === "overdue" ? "overdue" : status === "paid" ? "paid" : status === "pending" ? "due" : "";
    return {
      mode: "table",
      text: `${pluralize(list.length, `${label} payment`.trim())} totalling ${formatINR(total)} (${q.range.label}).${rows[0] && status === "overdue" ? ` Oldest: ${rows[0].Traveller}, ${rows[0]["Days overdue"]} days.` : ""}${ctx.scopeNote}`,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
      query: sql("p.traveller, t.ref, t.destination, p.label, p.amount_inr, p.due_at, p.status, p.reminder_count", "payments p JOIN trips t ON t.id = p.trip_id", where.map((w) => (w.startsWith("(") ? w.replace(/status/g, "p.status") : `p.${w}`)), "ORDER BY p.due_at ASC LIMIT 50"),
    };
  },
};

/** Tasks: overdue, due today, by assignee. */
export const tasksHandler: AskHandler = {
  id: "tasks",
  examples: ["Who has the most overdue tasks?", "Tasks due today", "Open tasks for Meera"],
  match: (q) => q.entity === "tasks",
  run: (q, ctx) => {
    const status = q.filters.status ?? "open";
    let list = visibleTasks(ctx).filter((t) => (status === "open" ? t.status === "open" || t.status === "snoozed" : t.status === status));
    const overdue = Boolean(q.filters.overdue);
    if (overdue) list = list.filter((t) => new Date(t.dueAt) < ctx.now);
    else if (q.range.from) list = list.filter((t) => inRange(t.dueAt, q.range));
    if (q.filters.consultantSub && q.filters.consultantSub !== "ai") list = list.filter((t) => (q.filters.consultantSub === "unassigned" ? !t.assignedTo : t.assignedTo === q.filters.consultantSub));
    const where = [status === "open" ? "status IN ('open','snoozed')" : `status = '${status}'`, ...(overdue ? ["due_at < NOW()"] : rangeWhere("due_at", q.range))];
    if (q.filters.consultantSub && q.filters.consultantSub !== "ai") where.push(q.filters.consultantSub === "unassigned" ? "assigned_to IS NULL" : `assigned_to = '${q.filters.consultantSub}'`);
    const byAssignee = q.groupBy === "consultant" || /\bwho\b|\bmost\b|\bby assignee\b|\bper person\b/.test(q.lower);
    const noun = `${overdue ? "overdue " : ""}${status === "open" ? "open" : status} task`;
    const suffix = q.range.from && !overdue ? ` due ${q.range.label}` : "";
    if (byAssignee) {
      const chart = tally(list, (t) => userName(ctx.db, t.assignedTo));
      return {
        mode: "table",
        text: `${pluralize(list.length, noun)}${suffix} across ${chart.length} people.${chart[0] ? ` ${chart[0].label} has the most (${chart[0].value}).` : ""}${ctx.scopeNote}`,
        columns: ["Assignee", "Tasks", "High priority"],
        rows: chart.map((c) => ({ Assignee: c.label, Tasks: c.value, "High priority": list.filter((t) => userName(ctx.db, t.assignedTo) === c.label && t.priority === "high").length })),
        chart,
        query: sql("assigned_to, COUNT(*)", "tasks", where, "GROUP BY assigned_to ORDER BY 2 DESC"),
      };
    }
    list.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const rows = cap(list).map((t) => ({
      Task: t.title,
      Kind: TASK_KIND_LABEL[t.kind],
      Enquiry: enquiryById(ctx.db, t.enquiryId)?.ref ?? "—",
      Traveller: travellerById(ctx.db, t.travellerId)?.fullName ?? "—",
      Assignee: userName(ctx.db, t.assignedTo),
      Due: formatDate(t.dueAt),
      "Days overdue": Math.max(0, daysBetween(t.dueAt, ctx.now)),
      Priority: t.priority,
    }));
    return {
      mode: "table",
      text: `${pluralize(list.length, noun)}${suffix}.${ctx.scopeNote}`,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
      query: sql("title, kind, enquiry_id, assigned_to, due_at, priority", "tasks", where, "ORDER BY due_at ASC LIMIT 50"),
    };
  },
};

/** Calls: volume and who handled them (Aanya vs consultants). */
export const callsHandler: AskHandler = {
  id: "calls",
  examples: ["Calls handled by Aanya this week", "Missed calls today", "Calls by consultant last month"],
  match: (q) => q.entity === "calls",
  run: (q, ctx) => {
    let list = ctx.db.calls.filter((c) => (!c.enquiryId || ctx.visibleEnquiryIds.has(c.enquiryId)) && inRange(c.startedAt, q.range));
    const who = q.filters.consultantSub;
    if (who === "ai") list = list.filter((c) => c.handledBy === "ai");
    else if (who && who !== "unassigned") list = list.filter((c) => c.handledBy === who);
    if (q.filters.status === "missed") list = list.filter((c) => c.status === "missed" || c.status === "no_answer");
    else if (q.filters.status) list = list.filter((c) => c.status === q.filters.status);
    const where = [...rangeWhere("started_at", q.range), ...(who === "ai" ? ["handled_by = 'ai'"] : who ? [`handled_by = '${who}'`] : []), ...(q.filters.status ? [`status = '${q.filters.status}'`] : [])];
    const handler = (c: (typeof list)[number]) => (c.handledBy === "ai" ? "Aanya (voice agent)" : userName(ctx.db, c.handledBy));
    const compare = /\bvs\.?|versus|compared?|split|by (consultant|handler|who)\b/.test(q.lower) || (!who && q.metric !== "list");
    if (compare || q.groupBy === "consultant") {
      const chart = tally(list, handler);
      const ai = list.filter((c) => c.handledBy === "ai").length;
      return {
        mode: "table",
        text: `${pluralize(list.length, "call")} (${q.range.label}) — Aanya handled ${ai} (${pct(ai, list.length)}%), consultants ${list.length - ai}.${ctx.scopeNote}`,
        columns: ["Handled by", "Calls", "Answered", "Avg duration (s)"],
        rows: chart.map((c) => {
          const xs = list.filter((x) => handler(x) === c.label);
          return { "Handled by": c.label, Calls: c.value, Answered: xs.filter((x) => x.status === "completed").length, "Avg duration (s)": Math.round(xs.reduce((s, x) => s + x.durationSec, 0) / Math.max(1, xs.length)) };
        }),
        chart,
        query: sql("handled_by, COUNT(*), COUNT(*) FILTER (WHERE status = 'completed'), AVG(duration_sec)", "calls", where, "GROUP BY handled_by ORDER BY 2 DESC"),
      };
    }
    list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const rows = cap(list).map((c) => ({
      When: formatDate(c.startedAt),
      Traveller: travellerById(ctx.db, c.travellerId)?.fullName ?? c.phone,
      Enquiry: enquiryById(ctx.db, c.enquiryId)?.ref ?? "—",
      Direction: c.direction,
      "Handled by": handler(c),
      Status: c.status.replace(/_/g, " "),
      "Duration (s)": c.durationSec,
      Outcome: c.outcome ?? "—",
      Summary: c.summary ?? "—",
    }));
    return {
      mode: "table",
      text: `${pluralize(list.length, "call")}${who === "ai" ? " handled by Aanya" : who ? ` handled by ${userName(ctx.db, who)}` : ""} (${q.range.label}), ${list.filter((c) => c.status === "completed").length} answered.${ctx.scopeNote}`,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
      query: sql("started_at, traveller, enquiry_id, direction, handled_by, status, duration_sec, outcome", "calls", where, "ORDER BY started_at DESC LIMIT 50"),
    };
  },
};

/** Travellers whose passport expires within N months (default 6). */
export const passportsHandler: AskHandler = {
  id: "passports",
  examples: ["Which travellers have passports expiring in the next 6 months?", "Passports expiring before December"],
  match: (q) => /\bpassports?\b/.test(q.lower),
  run: (q, ctx) => {
    const m = q.lower.match(/(\d+)\s*months?/);
    const months = m ? parseInt(m[1], 10) : 6;
    const horizon = q.range.to && q.range.future ? q.range.to : new Date(ctx.now.getFullYear(), ctx.now.getMonth() + months, ctx.now.getDate());
    const visibleTravellerIds = new Set(ctx.enquiries.map((e) => e.travellerId));
    const list = ctx.db.travellers
      .filter((t) => t.passportExpiry && visibleTravellerIds.has(t.id) && new Date(t.passportExpiry) <= horizon)
      .sort((a, b) => a.passportExpiry!.localeCompare(b.passportExpiry!));
    const rows = cap(list).map((t) => {
      const trip = visibleTrips(ctx).filter((x) => x.travellerIds.includes(t.id) && new Date(x.startDate) >= ctx.now).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
      return { Traveller: t.fullName, Phone: t.phone, City: t.city, "Passport expires": formatDate(t.passportExpiry), "Days left": daysBetween(ctx.now, t.passportExpiry!), "Upcoming trip": trip ? `${trip.destination} · ${formatDate(trip.startDate)}` : "—" };
    });
    return {
      mode: "table",
      text: `${pluralize(list.length, "traveller")} with a passport expiring by ${formatDate(horizon)} — ${pluralize(rows.filter((r) => r["Upcoming trip"] !== "—").length, "of them has a trip coming up", "of them have a trip coming up")} (6-month validity rule applies).${ctx.scopeNote}`,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
      query: sql("full_name, phone, city, passport_expiry, passport_expiry - CURRENT_DATE AS days_left", "travellers", [`passport_expiry <= '${horizon.toISOString().slice(0, 10)}'`], "ORDER BY passport_expiry ASC LIMIT 50"),
    };
  },
};

/** Itineraries by status — notably sent but never opened. */
export const itinerariesHandler: AskHandler = {
  id: "itineraries",
  examples: ["Itineraries sent but not viewed", "Accepted itineraries this month", "How many itineraries were sent last week?"],
  match: (q) => q.entity === "itineraries",
  run: (q, ctx) => {
    const status = q.filters.status;
    let list = ctx.db.itineraries.filter((i) => ctx.visibleEnquiryIds.has(i.enquiryId));
    const where: string[] = [];
    if (status === "sent_not_viewed") {
      list = list.filter((i) => i.status === "sent" && !i.viewedAt);
      where.push("status = 'sent'", "viewed_at IS NULL");
    } else if (status) {
      list = list.filter((i) => i.status === status);
      where.push(`status = '${status}'`);
    }
    if (q.filters.destination) {
      list = list.filter((i) => i.destinationId === q.filters.destination);
      where.push(`destination_id = '${q.filters.destination}'`);
    }
    const dateOf = (i: (typeof list)[number]) => i.sentAt ?? i.createdAt;
    list = list.filter((i) => inRange(dateOf(i), q.range)).sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
    where.push(...rangeWhere("COALESCE(sent_at, created_at)", q.range));
    const rows = cap(list).map((i) => {
      const e = enquiryById(ctx.db, i.enquiryId);
      return { Enquiry: e?.ref ?? "—", Traveller: travellerById(ctx.db, e?.travellerId)?.fullName ?? "—", Itinerary: `${i.title} (v${i.version})`, Nights: i.nights, Price: formatINR(i.pricing.totalINR), Status: i.status, Sent: formatDate(i.sentAt), Viewed: i.viewedAt ? formatDate(i.viewedAt) : "—", "Days since sent": i.sentAt ? daysBetween(i.sentAt, ctx.now) : null, Owner: userName(ctx.db, e?.assignedTo) };
    });
    const label = status === "sent_not_viewed" ? "sent but not yet viewed" : status ? status : "";
    return {
      mode: "table",
      text: `${pluralize(list.length, "itinerary", "itineraries")} ${label} (${q.range.label}), worth ${formatINR(list.reduce((s, i) => s + i.pricing.totalINR, 0))} in quotes.${status === "sent_not_viewed" && rows[0] ? ` Oldest: ${rows[0].Traveller}, ${rows[0]["Days since sent"] ?? 0} days — worth a nudge.` : ""}${ctx.scopeNote}`,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
      query: sql("i.enquiry_id, e.ref, i.title, i.version, i.nights, i.pricing_total_inr, i.status, i.sent_at, i.viewed_at", "itineraries i JOIN enquiries e ON e.id = i.enquiry_id", where, "ORDER BY sent_at DESC LIMIT 50"),
    };
  },
};

/** Campaign performance. */
export const campaignsHandler: AskHandler = {
  id: "campaigns",
  examples: ["Campaign performance", "Which campaign generated the most leads?", "Instagram campaigns this month"],
  match: (q) => q.entity === "campaigns",
  run: (q, ctx) => {
    let list = ctx.db.campaigns.filter((c) => inRange(c.startedAt ?? c.scheduledAt ?? c.createdAt, q.range));
    if (q.filters.source === "instagram" || q.filters.source === "whatsapp" || q.filters.source === "email") list = list.filter((c) => c.channel === q.filters.source);
    list.sort((a, b) => b.stats.leadsCreated - a.stats.leadsCreated);
    const rows = list.map((c) => ({ Campaign: c.name, Channel: CHANNEL_LABEL[c.channel], Type: c.type.replace(/_/g, " "), Status: c.status, Sent: c.stats.sent, Read: c.stats.read, Replied: c.stats.replied, "Reply %": pct(c.stats.replied, c.stats.sent), Leads: c.stats.leadsCreated, Bookings: c.stats.bookings }));
    const totals = list.reduce((s, c) => ({ sent: s.sent + c.stats.sent, leads: s.leads + c.stats.leadsCreated, bookings: s.bookings + c.stats.bookings }), { sent: 0, leads: 0, bookings: 0 });
    return {
      mode: "table",
      text: `${pluralize(list.length, "campaign")} (${q.range.label}): ${totals.sent.toLocaleString("en-IN")} messages sent, ${totals.leads} leads, ${totals.bookings} bookings.${rows[0] ? ` Best for leads: ${rows[0].Campaign} (${rows[0].Leads}).` : ""}`,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
      chart: list.map((c) => ({ label: c.name, value: c.stats.leadsCreated })),
      query: sql("name, channel, type, status, stats_sent, stats_read, stats_replied, stats_leads_created, stats_bookings", "campaigns", rangeWhere("COALESCE(started_at, scheduled_at, created_at)", q.range), "ORDER BY stats_leads_created DESC"),
    };
  },
};

/** Message volume by channel / direction, AI share. */
export const messagesHandler: AskHandler = {
  id: "messages",
  examples: ["Messages by channel this week", "How many WhatsApp messages did the AI send today?"],
  match: (q) => q.entity === "messages",
  run: (q, ctx) => {
    let list = ctx.db.messages.filter((m) => m.status !== "draft" && (!m.enquiryId || ctx.visibleEnquiryIds.has(m.enquiryId)) && inRange(m.at, q.range));
    const where = ["status <> 'draft'", ...rangeWhere("at", q.range)];
    if (q.filters.status && q.filters.status in CHANNEL_LABEL) {
      list = list.filter((m) => m.channel === q.filters.status);
      where.push(`channel = '${q.filters.status}'`);
    }
    if (q.filters.consultantSub === "ai" || /\b(ai|agent|wish|auto-?repl)/.test(q.lower)) {
      list = list.filter((m) => m.sentBy === "ai");
      where.push("sent_by = 'ai'");
    }
    const by = q.groupBy === "consultant" ? "consultant" : "channel";
    const chart = tally(list, (m) => (by === "channel" ? CHANNEL_LABEL[m.channel] : m.sentBy === "ai" ? "Wish (AI)" : m.sentBy === "traveller" ? "Travellers" : userName(ctx.db, m.sentBy)));
    const inbound = list.filter((m) => m.direction === "inbound").length;
    const ai = list.filter((m) => m.sentBy === "ai").length;
    return {
      mode: "table",
      text: `${pluralize(list.length, "message")} (${q.range.label}): ${inbound} inbound, ${list.length - inbound} outbound — ${ai} sent by the AI (${pct(ai, Math.max(1, list.length - inbound))}% of outbound).${ctx.scopeNote}`,
      columns: [by === "channel" ? "Channel" : "Sender", "Messages"],
      rows: chart.map((c) => ({ [by === "channel" ? "Channel" : "Sender"]: c.label, Messages: c.value })),
      chart,
      query: sql(`${by === "channel" ? "channel" : "sent_by"}, COUNT(*)`, "messages", where, "GROUP BY 1 ORDER BY 2 DESC"),
    };
  },
};

/** Travellers: count, top by lifetime value, by city. */
export const travellersHandler: AskHandler = {
  id: "travellers",
  examples: ["Top travellers by lifetime value", "How many repeat travellers do we have?", "Travellers from Bengaluru"],
  match: (q) => q.entity === "travellers",
  run: (q, ctx) => {
    const visibleIds = new Set(ctx.enquiries.map((e) => e.travellerId));
    let list = ctx.db.travellers.filter((t) => visibleIds.has(t.id) && inRange(t.createdAt, q.range.from ? q.range : { label: "" }));
    const where: string[] = [...rangeWhere("created_at", q.range)];
    const repeat = /\brepeat|returning|loyal\b/.test(q.lower);
    if (repeat) {
      list = list.filter((t) => t.tripsCount > 0);
      where.push("trips_count > 0");
    }
    const city = ctx.db.travellers.map((t) => t.city.toLowerCase()).find((c) => q.lower.includes(c));
    if (city) {
      list = list.filter((t) => t.city.toLowerCase() === city);
      where.push(`city = '${city}'`);
    }
    list.sort((a, b) => b.lifetimeValueINR - a.lifetimeValueINR || b.createdAt.localeCompare(a.createdAt));
    const rows = (q.limit ? list.slice(0, q.limit) : cap(list)).map((t) => ({ Traveller: t.fullName, City: t.city, Phone: t.phone, Channel: CHANNEL_LABEL[t.preferredChannel], Trips: t.tripsCount, "Lifetime value": formatINR(t.lifetimeValueINR), Tags: t.tags.join(", ") || "—", Since: formatDate(t.createdAt) }));
    const byCity = tally(list, (t) => t.city).slice(0, 8);
    return {
      mode: "table",
      text: `${pluralize(list.length, `${repeat ? "repeat " : ""}traveller`)}${city ? ` from ${rows[0]?.City ?? city}` : ""}, lifetime value ${formatINR(list.reduce((s, t) => s + t.lifetimeValueINR, 0))}.${rows[0] ? ` Highest value: ${rows[0].Traveller} (${rows[0]["Lifetime value"]}).` : ""}${ctx.scopeNote}`,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      rows,
      chart: q.metric === "top" ? rows.slice(0, 10).map((r) => ({ label: String(r.Traveller), value: list.find((t) => t.fullName === r.Traveller)?.lifetimeValueINR ?? 0 })) : byCity,
      query: sql("full_name, city, phone, preferred_channel, trips_count, lifetime_value_inr", "travellers", where, `ORDER BY lifetime_value_inr DESC LIMIT ${q.limit ?? 50}`),
    };
  },
};

export const OPS_HANDLERS: AskHandler[] = [passportsHandler, paymentsHandler, tasksHandler, callsHandler, itinerariesHandler, campaignsHandler, messagesHandler, travellersHandler];
