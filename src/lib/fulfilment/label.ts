/**
 * Printable parcel label (100 × 150 mm) for manual and sandbox bookings, as a
 * standalone HTML document with Code 128 barcodes of our reference and the
 * courier tracking number. Pure: returns a string.
 */
import { code128Svg } from "./barcode";
import type { Party } from "./couriers/types";

export type LabelInput = {
  title: string; // "Send to hub" | "Deliver to buyer" | "Export — consolidated"
  reference: string;
  orderNumber: string;
  courierName: string | null;
  serviceName?: string | null;
  trackingNumber: string | null;
  from: Party;
  to: Party;
  weightG: number | null;
  itemCount: number;
  note?: string | null;
  instructions?: string[];
};

const esc = (s: string | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function party(p: Party) {
  return [p.name, p.line1, p.line2, [p.city, p.region, p.postalCode].filter(Boolean).join(", "), p.country, p.phone ? `Tel ${p.phone}` : null]
    .filter(Boolean)
    .map((l) => `<div>${esc(l)}</div>`)
    .join("");
}

export function renderLabelHtml(l: LabelInput): string {
  const tracking = l.trackingNumber ? code128Svg(l.trackingNumber, { height: 48, module: 1.6 }) : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Label ${esc(l.reference)}</title>
<style>
  @page { size: 100mm 150mm; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 12px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; color: #000; background: #f4f4f5; }
  .label { width: 100mm; min-height: 150mm; margin: 12px auto; background: #fff; border: 1px solid #000; padding: 4mm; display: flex; flex-direction: column; gap: 3mm; }
  .row { display: flex; justify-content: space-between; gap: 3mm; }
  .box { border: 1px solid #000; padding: 2mm; }
  .k { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: #333; font-weight: 700; }
  .big { font-size: 15px; font-weight: 700; }
  .to { font-size: 14px; }
  .bar svg { width: 100%; height: auto; display: block; }
  .note { border: 2px dashed #000; padding: 2mm; font-weight: 700; text-align: center; }
  ul { margin: 0; padding-left: 4mm; }
  .tools { text-align: center; margin: 12px; }
  .tools button { font: inherit; padding: 8px 16px; border-radius: 999px; border: 1px solid #000; background: #000; color: #fff; cursor: pointer; }
  @media print { body { background: #fff; } .label { margin: 0; border: 0; } .tools { display: none; } }
</style></head>
<body>
<div class="tools"><button type="button" onclick="window.print()">Print label</button></div>
<main class="label">
  <div class="row"><div><div class="k">Wahbayaan</div><div class="big">${esc(l.title)}</div></div><div style="text-align:right"><div class="k">Order</div><div class="big">${esc(l.orderNumber)}</div></div></div>
  ${l.note ? `<div class="note">${esc(l.note)}</div>` : ""}
  <div class="box"><div class="k">Deliver to</div><div class="to">${party(l.to)}</div></div>
  <div class="box"><div class="k">From</div>${party(l.from)}</div>
  <div class="row"><div><div class="k">Courier</div>${esc(l.courierName ?? "—")}${l.serviceName ? ` · ${esc(l.serviceName)}` : ""}</div><div><div class="k">Weight</div>${l.weightG ? `${(l.weightG / 1000).toFixed(2)} kg` : "Weigh at hand-over"}</div><div><div class="k">Items</div>${l.itemCount}</div></div>
  <div class="bar"><div class="k">Parcel reference</div>${code128Svg(l.reference, { height: 56, module: 1.8 })}</div>
  ${tracking ? `<div class="bar"><div class="k">Courier tracking</div>${tracking}</div>` : ""}
  ${l.instructions?.length ? `<div class="box"><div class="k">Instructions</div><ul>${l.instructions.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>` : ""}
</main>
</body></html>`;
}
