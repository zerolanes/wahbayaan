/**
 * Detects contact details shared in buyer↔artisan messages. Taking a sale
 * off-platform removes buyer protection and escrow, so staff review and redact
 * these. Pure functions — used for highlighting, filtering and redaction.
 */

export type ContactKind = "email" | "phone" | "link" | "handle" | "app";

export type ContactHit = { kind: ContactKind; match: string; index: number };

export const CONTACT_LABEL: Record<ContactKind, string> = {
  email: "Email address",
  phone: "Phone number",
  link: "Outside link",
  handle: "Social handle",
  app: "Messaging app",
};

const PATTERNS: { kind: ContactKind; re: RegExp }[] = [
  { kind: "email", re: /[A-Z0-9._%+-]+(?:@|\s*(?:\(at\)|\[at\])\s*)[A-Z0-9-]+(?:\.[A-Z0-9-]+)*(?:\.|\s*(?:\(dot\)|\[dot\])\s*)[A-Z]{2,}\b/gi },
  // Sequences of 9+ digits allowing spaces, dashes, dots and brackets; optional leading +.
  { kind: "phone", re: /(?:\+|00)?\d(?:[\s().-]*\d){8,14}/g },
  { kind: "link", re: /\b(?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9-]+\.(?:com|net|org|pk|co|io|me|shop|store)(?:\/[^\s]*)?\b/gi },
  { kind: "handle", re: /(?:^|\s)@[a-z0-9_.]{3,30}\b/gi },
  { kind: "app", re: /\b(?:whats\s?app|wa\.me|telegram|viber|insta(?:gram)?|facebook|fb\.com|snap(?:chat)?|wechat|paypal\.me|easypaisa|jazzcash)\b/gi },
];

/** Every contact detail in a message, in text order, without overlaps. */
export function detectContactDetails(text: string): ContactHit[] {
  const hits: ContactHit[] = [];
  for (const { kind, re } of PATTERNS) {
    for (const m of text.matchAll(re)) {
      let match = m[0];
      let index = m.index ?? 0;
      const lead = match.length - match.trimStart().length;
      match = match.trim();
      index += lead;
      if (kind === "link" && /@/.test(text.slice(Math.max(0, index - 1), index))) continue; // domain of an email
      hits.push({ kind, match, index });
    }
  }
  hits.sort((a, b) => a.index - b.index || b.match.length - a.match.length);
  const out: ContactHit[] = [];
  let end = -1;
  for (const h of hits) {
    if (h.index < end) continue;
    out.push(h);
    end = h.index + h.match.length;
  }
  return out;
}

export function hasContactDetails(text: string) {
  return detectContactDetails(text).length > 0;
}

/** Split text into plain and flagged segments for highlighting. */
export function segmentContactDetails(text: string): { text: string; hit?: ContactKind }[] {
  const hits = detectContactDetails(text);
  const out: { text: string; hit?: ContactKind }[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.index > pos) out.push({ text: text.slice(pos, h.index) });
    out.push({ text: h.match, hit: h.kind });
    pos = h.index + h.match.length;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

export const REDACTION = "[removed by Wahbayaan]";

/** Replace each detected contact detail with a redaction marker. */
export function redactContactDetails(text: string): string {
  return segmentContactDetails(text)
    .map((s) => (s.hit ? REDACTION : s.text))
    .join("");
}

/**
 * A coarse Postgres regular expression for filtering conversations in SQL:
 * an @, a long digit run, a link or a messaging-app name. Precise detection
 * happens in JS on the rows it returns.
 */
export const CONTACT_SQL_REGEX = "(@|\\d[\\s().-]*\\d[\\s().-]*\\d[\\s().-]*\\d[\\s().-]*\\d[\\s().-]*\\d[\\s().-]*\\d[\\s().-]*\\d[\\s().-]*\\d|https?://|www\\.|whats ?app|wa\\.me|telegram|instagram|\\.com)";
