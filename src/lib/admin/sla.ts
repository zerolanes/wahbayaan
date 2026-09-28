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

/**
 * Commission (custom request) service levels: match a new request to an
 * artisan within a day and get the buyer a quote within three days. Quotes the
 * buyer hasn't answered in two weeks are candidates to expire.
 */
export const REQUEST_MATCH_HOURS = 24;
export const REQUEST_QUOTE_HOURS = 72;
export const REQUEST_QUOTE_STALE_HOURS = 14 * 24;

export function requestSla(input: { status: string; createdAt: Date; quotedAt?: Date | null; updatedAt?: Date | null; matched: boolean }, now = new Date()) {
  const since = (d: Date) => (now.getTime() - d.getTime()) / 3_600_000;
  const hours = since(input.createdAt);
  let tone: SlaTone = "neutral";
  let note: string;
  let stageHours = hours;
  switch (input.status) {
    case "new":
      if (!input.matched && hours > REQUEST_MATCH_HOURS) [tone, note] = ["danger", "Not matched to an artisan"];
      else if (hours > REQUEST_QUOTE_HOURS) [tone, note] = ["danger", "No quote after 3 days"];
      else if (hours > REQUEST_QUOTE_HOURS * 0.6) [tone, note] = ["warning", "Quote due soon"];
      else [tone, note] = ["gold", input.matched ? "Waiting for the artisan's quote" : "Needs an artisan"];
      break;
    case "quoted":
      stageHours = since(input.quotedAt ?? input.createdAt);
      if (stageHours > REQUEST_QUOTE_STALE_HOURS) [tone, note] = ["warning", "Quote unanswered for 2 weeks"];
      else [tone, note] = ["gold", "Waiting for the buyer"];
      break;
    case "accepted":
      stageHours = since(input.updatedAt ?? input.createdAt);
      [tone, note] = stageHours > 7 * 24 ? ["warning", "Accepted — no order yet"] : ["gold", "Accepted — awaiting order"];
      break;
    default:
      note = "Closed";
  }
  return { hours, stageHours, label: ageLabel(hours), stageLabel: ageLabel(stageHours), tone, note, breached: tone === "danger" };
}

/** Support inbox: first reply within a day; open tickets resolved within three. */
export function ticketSla(input: { status: string; createdAt: Date; updatedAt?: Date | null }, now = new Date()) {
  const hours = (now.getTime() - input.createdAt.getTime()) / 3_600_000;
  let tone: SlaTone;
  let note: string;
  if (input.status === "resolved") [tone, note] = ["success", "Resolved"];
  else if (input.status === "new" && hours > 24) [tone, note] = ["danger", "No reply after a day"];
  else if (input.status === "new" && hours > 12) [tone, note] = ["warning", "Reply due soon"];
  else if (input.status === "open" && hours > 72) [tone, note] = ["warning", "Open for 3+ days"];
  else [tone, note] = ["gold", "Within target"];
  return { hours, label: ageLabel(hours), tone, note, breached: tone === "danger" };
}
