import { ImageResponse } from "next/og";

export const alt = "Wahbayaan — heritage craft from Pakistan, carried home";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  const star = "M24 2l5.4 11 11.2-2.6L38 21.6 46 24l-8 2.4 2.6 11.2L29.4 35 24 46l-5.4-11-11.2 2.6L10 26.4 2 24l8-2.4L7.4 10.4 18.6 13z";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #0d1124 0%, #1f2b55 60%, #6d3220 100%)", color: "#f5eee2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 48 48">
            <path d={star} fill="#d4ac5a" />
            <circle cx="24" cy="24" r="7" fill="#171f3d" stroke="#e0bf73" strokeWidth="1.5" />
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
