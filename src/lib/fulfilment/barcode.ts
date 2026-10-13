/**
 * Code 128 (subset B) barcode as an SVG string — enough for printable parcel
 * labels without a dependency. Encodes printable ASCII (32–126). Pure.
 */

// Bar/space module widths for symbol values 0–106 (106 = stop, 13 modules).
export const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
] as const;

const START_B = 104;
const STOP = 106;

/** Symbol values for `text`, including start, checksum and stop. */
export function code128Values(text: string): number[] {
  const values = [START_B];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code > 126) throw new Error(`Code 128B can't encode ${JSON.stringify(ch)}`);
    values.push(code - 32);
  }
  const checksum = values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
  return [...values, checksum, STOP];
}

/** Alternating bar/space widths (in modules), starting with a bar. */
export function code128Modules(text: string): number[] {
  return code128Values(text).flatMap((v) => CODE128_PATTERNS[v].split("").map(Number));
}

export function code128Svg(text: string, opts: { height?: number; module?: number; quiet?: number; label?: boolean } = {}): string {
  const mod = opts.module ?? 2;
  const height = opts.height ?? 60;
  const quiet = (opts.quiet ?? 10) * mod;
  const widths = code128Modules(text);
  let x = quiet;
  const bars: string[] = [];
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w * mod}" height="${height}"/>`);
    x += w * mod;
  });
  const total = x + quiet;
  const textH = opts.label === false ? 0 : 16;
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height + textH}" width="${total}" height="${height + textH}" role="img" aria-label="Barcode ${esc}">` +
    `<rect width="100%" height="100%" fill="#fff"/><g fill="#000">${bars.join("")}</g>` +
    (textH ? `<text x="${total / 2}" y="${height + 13}" font-family="monospace" font-size="13" text-anchor="middle">${esc}</text>` : "") +
    `</svg>`
  );
}
