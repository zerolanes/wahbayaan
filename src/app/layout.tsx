import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/inter/index.css";
import "@fontsource/noto-nastaliq-urdu/400.css";
import "@fontsource/noto-nastaliq-urdu/700.css";
import "./globals.css";

// Every page reads the database or the buyer's cookies; render on request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "Wahbayaan — Heritage craft from Pakistan, carried home", template: "%s · Wahbayaan" },
  description:
    "A cross-border marketplace for Pakistani heritage craft — calligraphy, hand-knotted rugs, Taxila stone, Himalayan salt and more, with landed cost shown up front and payment held until delivery.",
  openGraph: { type: "website", siteName: "Wahbayaan" },
};

export const viewport: Viewport = {
  themeColor: "#0d1124",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
