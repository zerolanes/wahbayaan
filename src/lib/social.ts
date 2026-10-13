import type { SocialLinks } from "@/lib/db/schema";

/**
 * Social profile links (site footer, mobile menu, brand pages). Pure.
 *
 * Only networks with a URL are rendered. Links are plain outbound anchors — no
 * third-party scripts, embeds or trackers.
 */
export type { SocialLinks };

export const SOCIAL_NETWORKS = [
  { key: "instagram", label: "Instagram", host: /(^|\.)instagram\.com$/i, placeholder: "https://instagram.com/…" },
  { key: "facebook", label: "Facebook", host: /(^|\.)(facebook\.com|fb\.com)$/i, placeholder: "https://facebook.com/…" },
  { key: "tiktok", label: "TikTok", host: /(^|\.)tiktok\.com$/i, placeholder: "https://tiktok.com/@…" },
  { key: "youtube", label: "YouTube", host: /(^|\.)(youtube\.com|youtu\.be)$/i, placeholder: "https://youtube.com/@…" },
  { key: "x", label: "X", host: /(^|\.)(x\.com|twitter\.com)$/i, placeholder: "https://x.com/…" },
  { key: "pinterest", label: "Pinterest", host: /(^|\.)pinterest\.(com|co\.uk|ca)$/i, placeholder: "https://pinterest.com/…" },
  { key: "whatsapp", label: "WhatsApp", host: /(^|\.)(wa\.me|whatsapp\.com)$/i, placeholder: "+92 300 1234567 or https://wa.me/…" },
  { key: "linkedin", label: "LinkedIn", host: /(^|\.)linkedin\.com$/i, placeholder: "https://linkedin.com/company/…" },
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]["key"];
export const SOCIAL_KEYS = SOCIAL_NETWORKS.map((n) => n.key) as SocialNetwork[];

export type SocialParse = { ok: true; url: string | null } | { ok: false; error: string };

/**
 * Validate one link typed by staff or a brand. Empty → null (not shown).
 * WhatsApp also accepts a phone number, turned into a wa.me link.
 */
export function normalizeSocialUrl(network: SocialNetwork, raw: string | null | undefined): SocialParse {
  const value = (raw ?? "").trim();
  if (!value) return { ok: true, url: null };
  const meta = SOCIAL_NETWORKS.find((n) => n.key === network)!;
  if (network === "whatsapp" && /^\+?[\d\s()-]{7,20}$/.test(value)) {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 7) return { ok: false, error: "WhatsApp: enter the number in international format, e.g. +92 300 1234567." };
    return { ok: true, url: `https://wa.me/${digits}` };
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return { ok: false, error: `${meta.label}: enter a full link, e.g. ${meta.placeholder}` };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, error: `${meta.label}: use an https:// link.` };
  if (!meta.host.test(url.hostname)) return { ok: false, error: `${meta.label}: that link isn't a ${meta.label} address.` };
  url.protocol = "https:";
  return { ok: true, url: url.toString() };
}

/** Validate a whole set (e.g. from a form). Returns the cleaned links or the first error. */
export function parseSocialLinks(input: Partial<Record<string, string | null | undefined>>): { ok: true; links: SocialLinks } | { ok: false; error: string } {
  const links: SocialLinks = {};
  for (const key of SOCIAL_KEYS) {
    const r = normalizeSocialUrl(key, input[key]);
    if (!r.ok) return r;
    if (r.url) links[key] = r.url;
  }
  return { ok: true, links };
}

/** The links to render, in a fixed order — only those with a URL. */
export function activeSocialLinks(links: SocialLinks | null | undefined): { key: SocialNetwork; label: string; url: string }[] {
  if (!links) return [];
  return SOCIAL_NETWORKS.filter((n) => typeof links[n.key] === "string" && /^https:\/\//.test(links[n.key]!.trim())).map((n) => ({
    key: n.key,
    label: n.label,
    url: links[n.key]!.trim(),
  }));
}
