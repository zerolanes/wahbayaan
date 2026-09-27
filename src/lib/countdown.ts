export type CountdownParts = { done: boolean; days: number; hours: number; minutes: number; seconds: number };

/** Time remaining until `target`, split into whole units. Never negative. */
export function countdownParts(target: Date | string | number, now: Date | number = Date.now()): CountdownParts {
  const t = new Date(target).getTime();
  const n = typeof now === "number" ? now : now.getTime();
  const ms = Math.max(0, t - n);
  const total = Math.floor(ms / 1000);
  return {
    done: ms <= 0,
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function isUpcomingDrop(p: { isLimitedDrop: boolean; dropStartsAt: Date | string | null }, now = new Date()) {
  return !!(p.isLimitedDrop && p.dropStartsAt && new Date(p.dropStartsAt).getTime() > now.getTime());
}
