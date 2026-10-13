import { ImageResponse } from "next/og";

export const alt = "Wahbayaan — Pakistani heritage craft and brands";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share image for every page without its own: plain cream, navy wordmark, one line (design direction C). */
export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#fbf8f3", color: "#1f2b55" }}>
        <div style={{ display: "flex", height: 14, background: "#b5175e" }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "0 80px", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <svg width="96" height="96" viewBox="0 0 48 48">
              <path d="M9 44V22C9 13 16 7 24 3c8 4 15 10 15 19v22z" fill="#a9502e" />
              <path d="M17 44V27c0-4 3-7.5 7-9.5 4 2 7 5.5 7 9.5v17z" fill="#fbf8f3" />
            </svg>
            <span style={{ fontSize: 124, letterSpacing: -4, fontWeight: 700, textShadow: "0 4px 0 #0d1124" }}>Wahbayaan</span>
          </div>
          <span style={{ fontSize: 44, color: "#221a13" }}>Crafted Heritage.</span>
          <span style={{ fontSize: 28, color: "#5e4f3e" }}>Pakistani heritage craft and brands · delivered in Pakistan and abroad</span>
        </div>
        <div style={{ display: "flex", height: 14 }}>
          <div style={{ flex: 1, background: "#00796f" }} />
          <div style={{ flex: 1, background: "#f2a007" }} />
          <div style={{ flex: 1, background: "#b5175e" }} />
        </div>
      </div>
    ),
    size,
  );
}
