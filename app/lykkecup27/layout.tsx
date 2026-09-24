import type { Metadata, Viewport } from "next";
import { Graduate, Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const graduate = Graduate({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  variable: "--font-lc27-display",
});

export const metadata: Metadata = {
  title: "LykkeCup 2027",
  description: "LykkeCup 2027 · 5. juni · Herning",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function Lykkecup27Layout({ children }: { children: React.ReactNode }) {
  return <main className={`${inter.className} ${graduate.variable} min-h-[100svh] overflow-x-hidden bg-[#0f2442]`}>{children}</main>;
}
