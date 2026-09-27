// Renders a contact sheet of every art generator to screenshots/art-sheet.html for visual review.
import fs from "node:fs";
import { ART_KINDS, renderArt } from "../src/lib/art/generators";

const cells: string[] = [];
for (const kind of ART_KINDS) {
  for (const seed of [1, 2, 3]) {
    const svg = renderArt(kind, seed);
    cells.push(`<figure><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"/><figcaption>${kind} ${seed}</figcaption></figure>`);
  }
}
fs.mkdirSync("screenshots", { recursive: true });
fs.writeFileSync(
  "screenshots/art-sheet.html",
  `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(6,1fr);gap:6px;font:12px sans-serif;color:#ccc">${cells
    .map((c) => c.replace("<img", '<img style="width:100%;display:block"'))
    .join("")}</body></html>`,
);
console.log("wrote screenshots/art-sheet.html");
