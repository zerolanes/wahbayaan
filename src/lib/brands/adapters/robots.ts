/**
 * Minimal robots.txt support (RFC 9309) for the brand fetch adapter: the most
 * specific matching user-agent group applies, the longest matching rule wins,
 * `Allow` wins ties, `*` and `$` wildcards are honoured, and `Crawl-delay` is
 * respected (it can only make us slower, never faster than our own limit).
 */
export const BOT_TOKEN = "WahbayaanCatalogBot";

type Rule = { allow: boolean; pattern: string };
type Group = { agents: string[]; rules: Rule[]; crawlDelay: number | null };

export type Robots = { groups: Group[] };

export function parseRobots(text: string): Robots {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      // An empty Disallow means "allow everything" and adds no rule.
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return { groups };
}

function groupFor(robots: Robots, agent: string): Group | null {
  const ua = agent.toLowerCase();
  const specific = robots.groups.filter((g) => g.agents.some((a) => a !== "*" && ua.includes(a)));
  if (specific.length) return { agents: [ua], rules: specific.flatMap((g) => g.rules), crawlDelay: specific.find((g) => g.crawlDelay != null)?.crawlDelay ?? null };
  const star = robots.groups.filter((g) => g.agents.includes("*"));
  if (star.length) return { agents: ["*"], rules: star.flatMap((g) => g.rules), crawlDelay: star.find((g) => g.crawlDelay != null)?.crawlDelay ?? null };
  return null;
}

function patternToRegex(pattern: string) {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** `pathWithQuery` is the URL path plus search, e.g. `/products.json?page=2`. */
export function isAllowed(robots: Robots, pathWithQuery: string, agent = BOT_TOKEN): boolean {
  const group = groupFor(robots, agent);
  if (!group) return true;
  let best: Rule | null = null;
  for (const rule of group.rules) {
    if (!patternToRegex(rule.pattern).test(pathWithQuery)) continue;
    const len = rule.pattern.replace(/[*$]/g, "").length;
    const bestLen = best ? best.pattern.replace(/[*$]/g, "").length : -1;
    if (len > bestLen || (len === bestLen && rule.allow && !best!.allow)) best = rule;
  }
  return best ? best.allow : true;
}

/** Seconds, or null when the site sets none for us. */
export function crawlDelay(robots: Robots, agent = BOT_TOKEN): number | null {
  return groupFor(robots, agent)?.crawlDelay ?? null;
}
