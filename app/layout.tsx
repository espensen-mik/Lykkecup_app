import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const FAVICON = "/favicon.png";

export const metadata: Metadata = {
  title: {
    default: "LykkeCup KontrolCenter",
    template: "%s · LykkeCup KontrolCenter",
  },
  description: "LykkeCup KontrolCenter — spillere, klubber og overblik",
  icons: {
    icon: [{ url: FAVICON, sizes: "512x512", type: "image/png" }],
    shortcut: FAVICON,
    apple: [{ url: FAVICON, sizes: "512x512", type: "image/png" }],
  },
  openGraph: {
    locale: "da_DK",
  },
  appleWebApp: {
    capable: true,
    title: "LykkeCup KontrolCenter",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#14b8a6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="da"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
