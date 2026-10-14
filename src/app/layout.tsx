import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import "./fonts.css";
import "@fontsource-variable/fraunces/full-italic.css";
// Noto Nastaliq Urdu is loaded after the page by <UrduFont /> (decorative, never render-critical).
import "./globals.css";
import { UrduFont } from "@/components/fonts/urdu-font";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

// Every page reads the database or the buyer's cookies; render on request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: `${SITE_NAME} — Pakistani heritage craft and brands`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // The share image is app/opengraph-image.tsx (applies to every page without its own image).
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0d1124",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Only Inter and Fraunces (Latin) are render-critical: fetch them with the HTML, not after the CSS.
  preload("/fonts/inter-latin-wght-normal.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  preload("/fonts/fraunces-latin-full-normal.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="en">
      <body className="min-h-dvh">
        {children}
        <UrduFont />
      </body>
    </html>
  );
}
