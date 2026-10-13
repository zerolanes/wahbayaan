/**
 * Brand outreach pipeline: statuses, timeline event kinds and the rules that
 * move a contact along. Pure — shared by admin pages, actions and tests.
 */
import type { Tone } from "@/components/ui/misc";

export const OUTREACH_STATUSES = ["new", "contacted", "replied", "call_booked", "negotiating", "agreed", "declined", "do_not_contact"] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const STATUS_LABEL: Record<OutreachStatus, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  call_booked: "Call booked",
  negotiating: "Negotiating",
  agreed: "Agreed",
  declined: "Declined",
  do_not_contact: "Do not contact",
};

export const STATUS_TONE: Record<OutreachStatus, Tone> = {
  new: "neutral",
  contacted: "indigo",
  replied: "gold",
  call_booked: "turquoise",
  negotiating: "warning",
  agreed: "success",
  declined: "neutral",
  do_not_contact: "danger",
};

/** No more follow-ups once a contact reaches one of these. */
export const CLOSED_STATUSES: readonly OutreachStatus[] = ["agreed", "declined", "do_not_contact"];

export function isOutreachStatus(v: string): v is OutreachStatus {
  return (OUTREACH_STATUSES as readonly string[]).includes(v);
}

/** Manual timeline entries staff can record. */
export const MANUAL_EVENTS = [
  { kind: "replied", label: "They replied" },
  { kind: "call_booked", label: "Call booked" },
  { kind: "phone_call", label: "Phone call" },
  { kind: "instagram_dm", label: "Instagram DM sent" },
  { kind: "whatsapp", label: "WhatsApp sent" },
  { kind: "note", label: "Note" },
] as const;
export type ManualEventKind = (typeof MANUAL_EVENTS)[number]["kind"];

export const EVENT_LABEL: Record<string, string> = {
  email: "Email",
  replied: "Replied",
  call_booked: "Call booked",
  phone_call: "Phone call",
  instagram_dm: "Instagram DM",
  whatsapp: "WhatsApp",
  note: "Note",
  status: "Status",
  unsubscribed: "Opted out",
};

const RANK: Record<OutreachStatus, number> = { new: 0, contacted: 1, replied: 2, call_booked: 3, negotiating: 4, agreed: 5, declined: 5, do_not_contact: 6 };

/**
 * The status a contact moves to after an event. Only ever moves forward, and
 * never out of agreed / declined / do-not-contact (those are set by hand).
 */
export function statusAfterEvent(current: OutreachStatus, kind: ManualEventKind | "email"): OutreachStatus {
  if (CLOSED_STATUSES.includes(current)) return current;
  const target: OutreachStatus | null =
    kind === "email" || kind === "instagram_dm" || kind === "whatsapp" || kind === "phone_call" ? "contacted" : kind === "replied" ? "replied" : kind === "call_booked" ? "call_booked" : null;
  if (!target) return current;
  return RANK[target] > RANK[current] ? target : current;
}

/** Follow-up is due when its date has passed and the contact is still open. */
export function isFollowUpDue(c: { status: string; nextFollowUpAt: Date | null }, now = new Date()) {
  return !!c.nextFollowUpAt && c.nextFollowUpAt <= now && !CLOSED_STATUSES.includes(c.status as OutreachStatus);
}

export const FOLLOW_UP_DAYS = 5;
