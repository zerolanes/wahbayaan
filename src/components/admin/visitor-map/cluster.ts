import { CLUSTER_RADIUS, clamp, MAX_K } from "./geo";

export type ClusterItem<T> = { x: number; y: number; weight: number; item: T };
export type Cluster<T> = { x: number; y: number; weight: number; members: T[]; points: { x: number; y: number }[] };

/**
 * Greedy screen-space clustering. The heaviest point leads a cluster and takes
 * every unassigned point within `radius` px of it; the cross stays at the
 * leader's position so it doesn't drift as the cluster grows or splits.
 * A uniform grid keeps it near O(n).
 */
export function clusterPoints<T>(items: ClusterItem<T>[], radius = CLUSTER_RADIUS): Cluster<T>[] {
  const order = items.map((_, i) => i).sort((a, b) => items[b].weight - items[a].weight || a - b);
  const cell = Math.max(1, radius);
  const grid = new Map<string, number[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  items.forEach((it, i) => {
    const k = key(Math.floor(it.x / cell), Math.floor(it.y / cell));
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  });
  const taken = new Uint8Array(items.length);
  const r2 = radius * radius;
  const out: Cluster<T>[] = [];
  for (const i of order) {
    if (taken[i]) continue;
    const lead = items[i];
    taken[i] = 1;
    const cluster: Cluster<T> = { x: lead.x, y: lead.y, weight: lead.weight, members: [lead.item], points: [{ x: lead.x, y: lead.y }] };
    const gx = Math.floor(lead.x / cell);
    const gy = Math.floor(lead.y / cell);
    const near: number[] = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const list = grid.get(key(gx + dx, gy + dy));
        if (list) for (const j of list) if (!taken[j]) near.push(j);
      }
    near.sort((a, b) => items[b].weight - items[a].weight || a - b);
    for (const j of near) {
      const o = items[j];
      const ddx = o.x - lead.x;
      const ddy = o.y - lead.y;
      if (ddx * ddx + ddy * ddy < r2) {
        taken[j] = 1;
        cluster.members.push(o.item);
        cluster.points.push({ x: o.x, y: o.y });
        cluster.weight += o.weight;
      }
    }
    out.push(cluster);
  }
  return out;
}

/**
 * Zoom factor at which a cluster's members stop merging. Screen distances
 * between nearby places grow linearly with k, so it's the current k scaled by
 * radius / (closest pair distance), with 25% headroom. Capped at maxK.
 */
export function zoomToSeparate(points: { x: number; y: number }[], k: number, radius = CLUSTER_RADIUS, maxK = MAX_K): number {
  if (points.length < 2) return clamp(k * 2, k, maxK);
  let best = Infinity;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (d < best) best = d;
    }
  if (best < 1e-6) return maxK;
  return clamp(k * Math.max(1.5, (radius * 1.25) / best), k, maxK);
}

/** Cross size in px: 11 px for a single visit, growing with the log of visits. */
export function crossSize(visits: number, multiplier = 1): number {
  const v = Math.max(1, visits);
  return Math.min(30, 11 * (1 + 0.42 * Math.log10(v))) * multiplier;
}
