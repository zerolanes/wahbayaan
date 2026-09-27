export const REGION_LABELS: Record<string, string> = {
  punjab: "Punjab",
  sindh: "Sindh",
  khyber_pakhtunkhwa: "Khyber Pakhtunkhwa",
  balochistan: "Balochistan",
  gilgit_baltistan: "Gilgit-Baltistan",
  azad_kashmir: "Azad Kashmir",
  islamabad: "Islamabad",
};

export function regionLabel(region: string | null | undefined) {
  return region ? (REGION_LABELS[region] ?? region) : null;
}

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", opts).format(typeof d === "string" ? new Date(d) : d);
}

export function formatDateTime(d: Date | string | null | undefined) {
  return formatDate(d, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2629800, "week"],
    [31557600, "month"],
  ];
  let unit: Intl.RelativeTimeFormatUnit = "year";
  let div = 31557600;
  for (let i = 0; i < steps.length; i++) {
    if (Math.abs(s) < steps[i][0]) {
      unit = steps[i][1];
      div = i === 0 ? 1 : steps[i - 1][0];
      break;
    }
  }
  return rtf.format(-Math.round(s / div), unit);
}

export function formatDims(w?: string | number | null, h?: string | number | null, d?: string | number | null) {
  const parts = [w, h, d].filter((v) => v != null && Number(v) > 0).map((v) => Number(v));
  if (!parts.length) return null;
  const cm = parts.map((v) => `${+v.toFixed(1)}`).join(" × ") + " cm";
  const inches = parts.map((v) => `${+(v / 2.54).toFixed(1)}`).join(" × ") + " in";
  return { cm, inches };
}

export function formatWeight(g: number | null | undefined) {
  if (!g) return null;
  return { metric: g >= 1000 ? `${+(g / 1000).toFixed(1)} kg` : `${g} g`, imperial: `${+(g / 453.592).toFixed(1)} lb` };
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

export function yearsSince(year: number | null | undefined) {
  return year ? new Date().getFullYear() - year : null;
}
