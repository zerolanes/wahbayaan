import { randomBytes } from "node:crypto";

/**
 * In-app scheduler for hosts without a cron service (Railway runs one
 * long-lived `next start`). It calls this server's own /api/cron/<job> routes,
 * which record when each job last ran, so a redeploy doesn't repeat daily jobs.
 * Vercel runs the same routes from vercel.json instead.
 *
 * On in production unless WB_JOBS=off; WB_JOBS=auto-release,brands runs only
 * those jobs. Without CRON_SECRET the process makes up its own, so the routes
 * still refuse outside callers.
 */
const JOBS = [
  { name: "auto-release", everyHours: 1 },
  { name: "fx-refresh", everyHours: 24 },
  { name: "brands", everyHours: 24 },
  { name: "analytics-cleanup", everyHours: 24 },
];
const TICK_MS = 10 * 60_000;
const FIRST_TICK_MS = 2 * 60_000;

function start() {
  const setting = (process.env.WB_JOBS ?? "").trim();
  if (process.env.NODE_ENV !== "production" || process.env.VERCEL || setting === "off") return;
  const only = setting && setting !== "on" ? new Set(setting.split(",").map((s) => s.trim())) : null;
  const jobs = JOBS.filter((j) => !only || only.has(j.name));
  if (!jobs.length) return;
  process.env.CRON_SECRET ||= randomBytes(32).toString("hex");
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (const job of jobs) {
        try {
          const res = await fetch(`${base}/api/cron/${job.name}?everyHours=${job.everyHours}`, {
            headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
            signal: AbortSignal.timeout(5 * 60_000),
          });
          const body = await res.text();
          if (!res.ok) console.warn(`[jobs] ${job.name}: ${res.status} ${body.slice(0, 200)}`);
          else if (!body.includes('"skipped":true')) console.info(`[jobs] ${job.name}: ${body.slice(0, 200)}`);
        } catch (e) {
          console.warn(`[jobs] ${job.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } finally {
      running = false;
    }
  };
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), TICK_MS).unref();
  }, FIRST_TICK_MS).unref();
}

start();
