import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { CONSENT_DECISIONS, VISIT_COOKIE, isBotUserAgent } from "@/lib/consent/core";
import { clientIp, shortenIp } from "@/lib/analytics/request-info";
import { recordConsent } from "@/lib/analytics/store";
import { sameOrigin } from "@/lib/analytics/origin";

/**
 * Proof of consent. Every decision in the banner (accept all, essentials only,
 * custom, revoke) is posted here and stored with the IP shortened (IPv4 /24,
 * IPv6 /48). When Statistics is not allowed the visit cookie is cleared.
 */
const Body = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  rev: z.number().int().min(1).max(1_000_000),
  decision: z.enum(CONSENT_DECISIONS as [string, ...string[]]),
  categories: z.object({ essential: z.boolean().optional(), statistics: z.boolean(), functional: z.boolean(), marketing: z.boolean() }),
});

const recent = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const ua = req.headers.get("user-agent");
  if (isBotUserAgent(ua)) return new Response(null, { status: 204 });
  const raw = await req.text();
  if (raw.length > 2048) return new Response("Too large", { status: 413 });
  let parsed;
  try {
    parsed = Body.safeParse(JSON.parse(raw));
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const b = parsed.data;
  // At most 20 records per consent id per hour.
  const now = Date.now();
  const hits = (recent.get(b.id) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= 20) return new Response("Too many requests", { status: 429 });
  hits.push(now);
  if (recent.size > 20_000) recent.clear();
  recent.set(b.id, hits);

  const categories = { essential: true, statistics: b.categories.statistics, functional: b.categories.functional, marketing: b.categories.marketing };
  const ipShort = shortenIp(clientIp(req.headers));
  after(async () => {
    try {
      await recordConsent({ consentId: b.id, decision: b.decision as (typeof CONSENT_DECISIONS)[number], categories, rev: b.rev, ipShort, userAgent: ua });
    } catch (err) {
      console.error("[consent] record failed", err);
    }
  });
  const res = new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  if (!categories.statistics) res.headers.append("set-cookie", `${VISIT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res;
}
