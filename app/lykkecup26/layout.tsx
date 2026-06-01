import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Inter } from "next/font/google";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { Lc26PwaBootstrap } from "@/components/lykkecup26/lc26-pwa-bootstrap";
import { Lykkecup26Shell } from "@/components/lykkecup26/lykkecup26-shell";
import { buildLc26PublicMetadata } from "@/lib/lc26-public-site-metadata";

/** Egen CSS-chunk for offentlig app — reducer risiko for ustylet QR-førstebesøg. */
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  ...buildLc26PublicMetadata({ canonicalPath: "/" }),
  manifest: "/lykkecup26.webmanifest",
};

/** Fastlås zoom/pinch som i en app (LykkeCup 26-offentlig del). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#00a182",
  viewportFit: "cover",
};

export default function Lykkecup26Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} lc26-app min-h-[100dvh]`}>
      <Lc26PwaBootstrap />
      <AnalyticsTracker />
      <Analytics />
      <Lykkecup26Shell>{children}</Lykkecup26Shell>
    </div>
  );
}
