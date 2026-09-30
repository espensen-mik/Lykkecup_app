import type { Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f2442",
  viewportFit: "cover",
};

export default function FrivilligLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} ${graduate.variable} min-h-[100svh] overflow-x-hidden bg-[#0f2442]`}>
      {children}
    </div>
  );
}
