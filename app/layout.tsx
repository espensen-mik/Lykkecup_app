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

const APP_ICON = "/Kontrolcenter26.jpg";

export const metadata: Metadata = {
  title: {
    default: "LykkeCup KontrolCenter",
    template: "%s · LykkeCup KontrolCenter",
  },
  description: "LykkeCup KontrolCenter — spillere, klubber og overblik",
  icons: {
    icon: [{ url: APP_ICON, type: "image/jpeg" }],
    shortcut: APP_ICON,
    apple: [{ url: APP_ICON, type: "image/jpeg" }],
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
