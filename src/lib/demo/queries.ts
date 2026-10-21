import type { DemoData, Enquiry, Message, Traveller, Trip, User, Destination, Itinerary, Task, Payment, Call } from "./types";
import { WON_STAGES } from "@/lib/pipeline";

/** Pure selectors over DemoData — keep page components thin. */

export const travellerById = (db: DemoData, id?: string | null): Traveller | undefined => (id ? db.travellers.find((t) => t.id === id) : undefined);
export const enquiryById = (db: DemoData, id?: string | null): Enquiry | undefined => (id ? db.enquiries.find((e) => e.id === id) : undefined);
export const tripById = (db: DemoData, id?: string | null): Trip | undefined => (id ? db.trips.find((t) => t.id === id) : undefined);
export const userBySub = (db: DemoData, sub?: string | null): User | undefined => (sub ? db.users.find((u) => u.sub === sub) : undefined);
export const userName = (db: DemoData, sub?: string | null): string => (sub === "ai" ? "AI agent" : sub === "system" ? "System" : userBySub(db, sub)?.name ?? "Unassigned");
export const destinationById = (db: DemoData, id?: string | null): Destination | undefined => (id ? db.destinations.find((d) => d.id === id) : undefined);

export const messagesForEnquiry = (db: DemoData, enquiryId: string): Message[] => db.messages.filter((m) => m.enquiryId === enquiryId).sort((a, b) => a.at.localeCompare(b.at));
export const messagesForTraveller = (db: DemoData, travellerId: string): Message[] => db.messages.filter((m) => m.travellerId === travellerId).sort((a, b) => a.at.localeCompare(b.at));
export const itinerariesForEnquiry = (db: DemoData, enquiryId: string): Itinerary[] => db.itineraries.filter((i) => i.enquiryId === enquiryId).sort((a, b) => b.version - a.version);
export const tasksForEnquiry = (db: DemoData, enquiryId: string): Task[] => db.tasks.filter((t) => t.enquiryId === enquiryId).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
export const paymentsForTrip = (db: DemoData, tripId: string): Payment[] => db.payments.filter((p) => p.tripId === tripId).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
export const callsForEnquiry = (db: DemoData, enquiryId: string): Call[] => db.calls.filter((c) => c.enquiryId === enquiryId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
export const enquiriesForTraveller = (db: DemoData, travellerId: string): Enquiry[] => db.enquiries.filter((e) => e.travellerId === travellerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const tripsForTraveller = (db: DemoData, travellerId: string): Trip[] => db.trips.filter((t) => t.travellerIds.includes(travellerId) || t.travellerId === travellerId).sort((a, b) => b.startDate.localeCompare(a.startDate));

export const isWon = (e: Enquiry) => WON_STAGES.includes(e.stage);
export const isOpen = (e: Enquiry) => !["completed", "lost", "non_lead"].includes(e.stage);

/** One thread per traveller+channel, newest first, with unread/unanswered flags. */
export interface Thread {
  key: string;
  travellerId: string;
  channel: Message["channel"];
  enquiryId?: string;
  last: Message;
  count: number;
  unanswered: boolean;
  hasDraft: boolean;
  aiHandled: number;
}
export function threads(db: DemoData): Thread[] {
  const map = new Map<string, Message[]>();
  for (const m of db.messages) {
    const k = `${m.travellerId}:${m.channel}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(m);
  }
  const out: Thread[] = [];
  for (const [key, msgs] of map) {
    msgs.sort((a, b) => a.at.localeCompare(b.at));
    const last = msgs[msgs.length - 1];
    const lastIn = [...msgs].reverse().find((m) => m.direction === "inbound");
    const lastOut = [...msgs].reverse().find((m) => m.direction === "outbound" && m.status !== "draft");
    out.push({
      key,
      travellerId: last.travellerId,
      channel: last.channel,
      enquiryId: msgs.find((m) => m.enquiryId)?.enquiryId,
      last,
      count: msgs.length,
      unanswered: Boolean(lastIn && (!lastOut || lastIn.at > lastOut.at)),
      hasDraft: msgs.some((m) => m.status === "draft"),
      aiHandled: msgs.filter((m) => m.sentBy === "ai" && m.status !== "draft").length,
    });
  }
  return out.sort((a, b) => b.last.at.localeCompare(a.last.at));
}

/** Enquiries visible to a user given role scoping (Sales sees own + unassigned). */
export function visibleEnquiries(db: DemoData, user: { sub: string; role: string }): Enquiry[] {
  if (user.role === "SALES") return db.enquiries.filter((e) => !e.assignedTo || e.assignedTo === user.sub);
  return db.enquiries;
}

export function logActivity(db: DemoData, a: Omit<DemoData["activities"][number], "id" | "at"> & { at?: string }) {
  db.activities.unshift({ id: `act_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: a.at ?? new Date().toISOString(), ...a });
}
