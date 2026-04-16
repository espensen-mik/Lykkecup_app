import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Lykkecup26Shell } from "@/components/lykkecup26/lykkecup26-shell";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LykkeCup 26",
  description: "Find dit hold, holdkammerater og kampprogram til LykkeCup 26.",
  appleWebApp: {
    capable: true,
    title: "LykkeCup 26",
    statusBarStyle: "default",
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
      <Lykkecup26Shell>{children}</Lykkecup26Shell>
    </div>
  );
}
