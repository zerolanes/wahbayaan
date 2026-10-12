import type { GeoMarker, VisitorMapData, VisitorMapSettings } from "./types";

export function placeLabel(p: { city: string | null; region: string | null; country: string | null }) {
  return p.city ?? p.region ?? p.country ?? "Unknown place";
}

export function relativeTime(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(iso).toLocaleDateString();
}

/** Value written to the host page's filter param: "GB" for a country, "GB:London" for a place. */
export function filterValue(m: GeoMarker): string {
  const cc = m.countryCode ?? "";
  return m.kind === "country" || !m.city ? cc : `${cc}:${m.city}`;
}

export function buildMarkers(data: VisitorMapData | null, s: VisitorMapSettings): GeoMarker[] {
  if (!data) return [];
  const latestKey = data.latest?.key;
  const places = [...data.places].sort((a, b) => b.visits - a.visits);
  if (s.mode === "countries") {
    const acc = new Map<string, { lat: number; lng: number; w: number }>();
    for (const p of places) {
      if (!p.countryCode) continue;
      const a = acc.get(p.countryCode) ?? { lat: 0, lng: 0, w: 0 };
      const w = Math.max(1, p.visits);
      a.lat += p.lat * w;
      a.lng += p.lng * w;
      a.w += w;
      acc.set(p.countryCode, a);
    }
    return data.countries
      .filter((c) => acc.has(c.countryCode))
      .map((c) => {
        const a = acc.get(c.countryCode)!;
        return {
          id: `country:${c.countryCode}`,
          lat: a.lat / a.w,
          lng: a.lng / a.w,
          visits: c.visits,
          uniqueVisitors: c.uniqueVisitors,
          online: c.online,
          lastSeen: c.lastSeen,
          label: c.country,
          city: null,
          region: null,
          country: c.country,
          countryCode: c.countryCode,
          kind: "country" as const,
        };
      });
  }
  const toMarker = (p: VisitorMapData["places"][number], rank?: number): GeoMarker => ({
    id: p.key,
    lat: p.lat,
    lng: p.lng,
    visits: p.visits,
    uniqueVisitors: p.uniqueVisitors,
    online: p.online,
    lastSeen: p.lastSeen,
    label: placeLabel(p),
    city: p.city,
    region: p.region,
    country: p.country,
    countryCode: p.countryCode,
    kind: "place",
    rank,
  });
  if (s.mode === "top10") return places.slice(0, 10).map((p, i) => toMarker(p, i + 1));
  const kept = places.slice(0, s.maxMarkers);
  const keptKeys = new Set(kept.map((p) => p.key));
  // Never drop someone who is online right now, or the latest visit, to the marker cap.
  for (const p of places) if (!keptKeys.has(p.key) && (p.online || p.key === latestKey)) kept.push(p);
  return kept.map((p) => toMarker(p));
}
