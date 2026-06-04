import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "LykkeCup Galla Scanner",
  description: "QR check-in til LykkeCup Galla",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a0a",
  viewportFit: "cover",
};

export default function GallaScannerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
