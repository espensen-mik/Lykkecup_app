import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Lc26PwaBootstrap } from "@/components/lykkecup26/lc26-pwa-bootstrap";
import { Lykkecup26Shell } from "@/components/lykkecup26/lykkecup26-shell";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  applicationName: "LykkeCup 26",
  title: "LykkeCup 26",
  description: "Find dit hold, holdkammerater og kampprogram til LykkeCup 26.",
  /** Egen manifest så «Tilføj til hjemmeskårm» får start_url + scope under /lykkecup26 (bedre standalone på iOS). */
  manifest: "/lykkecup26.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LykkeCup 26",
    statusBarStyle: "black-translucent",
  },
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
      <Lykkecup26Shell>{children}</Lykkecup26Shell>
    </div>
  );
}
