import * as THREE from "three";

/**
 * Procedural "phool-patti" (flowers and leaves) lacquer painting for the face of
 * the 3D wordmark: a deep indigo lacquer ground with hand-painted petal
 * rosettes, leaf pairs and dotted accents in the truck-art palette. Drawn
 * with vector canvas calls at high resolution and tiled seamlessly, so it
 * stays sharp when the lettering is large. Petal rosettes only — no stars.
 */
export function createPhoolTexture(size = 2048, seed = 7): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

  // Lacquer ground with soft hand-brushed variation.
  const ground = g.createLinearGradient(0, 0, size, size);
  ground.addColorStop(0, "#14204a");
  ground.addColorStop(0.5, "#1a2a5c");
  ground.addColorStop(1, "#121c42");
  g.fillStyle = ground;
  g.fillRect(0, 0, size, size);
  g.globalAlpha = 0.06;
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = rnd() > 0.5 ? "#2c3f7c" : "#0b1230";
    g.lineWidth = 6 + rnd() * 26;
    g.beginPath();
    const x = rnd() * size, y = rnd() * size;
    g.moveTo(x, y);
    g.quadraticCurveTo(x + rnd() * 200 - 100, y + rnd() * 80 - 40, x + rnd() * 400 - 200, y + rnd() * 60 - 30);
    g.stroke();
  }
  g.globalAlpha = 1;

  // Draw at (x, y) and at the wrapped copies so the tile repeats seamlessly.
  const wrapped = (x: number, y: number, r: number, draw: (x: number, y: number) => void) => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      const px = x + dx, py = y + dy;
      if (px + r < 0 || px - r > size || py + r < 0 || py - r > size) continue;
      draw(px, py);
    }
  };

  const PETALS = ["#e0703f", "#f3e3c3", "#2fa3ae", "#e7b84f", "#e57f93"];
  const CENTRES = ["#e7b84f", "#c4452f", "#f6eedd", "#1f8590"];

  const leaf = (x: number, y: number, len: number, angle: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = "#3f9a5f";
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
    g.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
    g.fill();
    g.strokeStyle = "#a9dfa0";
    g.lineWidth = Math.max(1.5, len * 0.04);
    g.beginPath();
    g.moveTo(len * 0.08, 0);
    g.lineTo(len * 0.86, 0);
    g.stroke();
    g.restore();
  };

  type Rosette = { n: number; petal: string; inner: string; centre: string; rot: number; la: number; lb: number };
  const pickRosette = (): Rosette => ({
    n: 5 + Math.floor(rnd() * 4), // 5–8 rounded petals
    petal: PETALS[Math.floor(rnd() * PETALS.length)],
    inner: PETALS[Math.floor(rnd() * PETALS.length)],
    centre: CENTRES[Math.floor(rnd() * CENTRES.length)],
    rot: rnd() * Math.PI,
    la: rnd() * Math.PI * 2,
    lb: Math.PI * (0.75 + rnd() * 0.5),
  });
  const rosette = (x: number, y: number, r: number, { n, petal, inner, centre, rot, la, lb }: Rosette) => {
    // Leaf pair behind the flower.
    leaf(x, y, r * 1.9, la);
    leaf(x, y, r * 1.6, la + lb);
    for (const [rr, col] of [[r, petal], [r * 0.62, inner]] as const) {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * rr * 0.55, y + Math.sin(a) * rr * 0.55, rr * 0.5, rr * 0.3, a, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Painted outline strokes on the petals — the hand-painted look.
    g.strokeStyle = "rgba(255,248,230,0.55)";
    g.lineWidth = Math.max(1.5, r * 0.05);
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.42, r * 0.22, a, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }
    g.fillStyle = centre;
    g.beginPath();
    g.arc(x, y, r * 0.24, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff8e6";
    g.beginPath();
    g.arc(x - r * 0.06, y - r * 0.06, r * 0.07, 0, Math.PI * 2);
    g.fill();
  };

  // Jittered grid of rosettes, sizes varied.
  const cells = 7;
  const cell = size / cells;
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
    const r = cell * (0.22 + rnd() * 0.12);
    const x = (i + 0.5 + (j % 2 ? 0.5 : 0) + (rnd() - 0.5) * 0.3) * cell;
    const y = (j + 0.5 + (rnd() - 0.5) * 0.3) * cell;
    const look = pickRosette();
    wrapped(x, y, r * 2, (px, py) => rosette(px, py, r, look));
  }
  // Dotted accents between flowers.
  for (let i = 0; i < 520; i++) {
    const x = rnd() * size, y = rnd() * size, r = 3 + rnd() * 6;
    const col = rnd() > 0.5 ? "#f6eedd" : "#e7b84f";
    wrapped(x, y, r, (px, py) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    });
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}
