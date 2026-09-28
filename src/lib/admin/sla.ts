/**
 * Dispute service levels: a case should get a first staff response within a
 * day and be resolved within five days. Age is measured from opening.
 */
export const SLA_FIRST_RESPONSE_HOURS = 24;
export const SLA_RESOLVE_HOURS = 120;

export type SlaTone = "success" | "gold" | "warning" | "danger" | "neutral";

export function ageLabel(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export function disputeSla(input: { createdAt: Date; resolvedAt?: Date | null; status: string; staffReplied: boolean }, now = new Date()) {
  const end = input.resolvedAt ?? now;
  const hours = (end.getTime() - input.createdAt.getTime()) / 3_600_000;
  const closed = input.status === "resolved" || input.status === "closed";
  let tone: SlaTone;
  let note: string;
  if (closed) {
    tone = hours <= SLA_RESOLVE_HOURS ? "success" : "neutral";
    note = `Resolved in ${ageLabel(hours)}`;
  } else if (!input.staffReplied && hours > SLA_FIRST_RESPONSE_HOURS) {
    tone = "danger";
    note = "No staff reply yet";
  } else if (hours > SLA_RESOLVE_HOURS) {
    tone = "danger";
    note = "Past the 5-day target";
  } else if (hours > SLA_RESOLVE_HOURS * 0.6) {
    tone = "warning";
    note = "Approaching the 5-day target";
  } else {
    tone = "gold";
    note = "Within target";
  }
  return { hours, label: ageLabel(hours), tone, note, breached: tone === "danger" };
}
