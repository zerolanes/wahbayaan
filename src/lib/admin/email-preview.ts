/**
 * Outbox emails are stored as plain text and may contain one-time passwords
 * (staff invites, artisan approvals) or sign-in links. The admin preview masks
 * them; resending still sends the original body.
 */
const SECRET_LINE = /^(\s*(?:temporary password|password|one-time code|verification code)\s*:\s*)(\S.*)$/gim;
const TOKEN_PARAM = /([?&](?:token|code|key|signature)=)[^&\s#]+/gi;

export function redactEmailBody(body: string): { text: string; redactions: number } {
  let redactions = 0;
  const text = body
    .replace(SECRET_LINE, (_m, label: string) => {
      redactions++;
      return `${label}••••••••`;
    })
    .replace(TOKEN_PARAM, (_m, key: string) => {
      redactions++;
      return `${key}••••`;
    });
  return { text, redactions };
}

/** Split plain text into paragraphs and link out URLs for the rendered preview. */
export function emailBlocks(text: string): { kind: "p"; lines: string[] }[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.split("\n"))
    .filter((lines) => lines.some((l) => l.trim()))
    .map((lines) => ({ kind: "p" as const, lines }));
}

/** Queued for more than this many minutes means delivery is stuck. */
export const STUCK_AFTER_MINUTES = 15;
