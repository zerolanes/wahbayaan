import { ImageResponse } from "next/og";

export const alt = "Wahbayaan — heritage craft from Pakistan, carried home";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0d1124", color: "#f5eee2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 48 48">
            <path d="M9 44V22C9 13 16 7 24 3c8 4 15 10 15 19v22z" fill="#c4623a" />
            <path d="M17 44V27c0-4 3-7.5 7-9.5 4 2 7 5.5 7 9.5v17z" fill="#0d1124" />
          </svg>
          <span style={{ fontSize: 56, letterSpacing: -1 }}>Wahbayaan</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 76, lineHeight: 1.02, maxWidth: 900 }}>Heritage craft, carried home.</span>
          <span style={{ fontSize: 30, color: "#e0bf73" }}>Verified Pakistani artisans · landed cost up front · payment held until delivery</span>
        </div>
      </div>
    ),
    size,
  );
}
