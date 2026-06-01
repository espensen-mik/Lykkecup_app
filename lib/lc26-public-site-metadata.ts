import type { Metadata } from "next";

/** Offentlig app-navn (browserfane, deling, PWA) — ikke KontrolCenter. */
export const LC26_PUBLIC_SITE_NAME = "LykkeCup 2026";
export const LC26_PUBLIC_SITE_SHORT_NAME = "LykkeCup 2026";
export const LC26_PUBLIC_SITE_DESCRIPTION =
  "Find dit hold, holdkammerater og kampprogram til LykkeCup 2026 i Messecenter Herning.";

/** 16:9 — Open Graph / sociale medier. */
export const LC26_PUBLIC_OG_IMAGE_PATH = "/lykkecup_thumb.jpg";

const DEFAULT_SITE_URL = "https://lykkecup.dk";

function publicSiteOrigin(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  return new URL(raw.endsWith("/") ? raw.slice(0, -1) : raw);
}

type Options = {
  /** Canonical og openGraph.url (fx `/` eller `/lykkecup26`). */
  canonicalPath?: string;
};

/** Metadata til offentlig LykkeCup-app under /lykkecup26 og forsiden /. */
export function buildLc26PublicMetadata(options?: Options): Metadata {
  const origin = publicSiteOrigin();
  const canonicalPath = options?.canonicalPath ?? "/lykkecup26";

  return {
    metadataBase: origin,
    applicationName: LC26_PUBLIC_SITE_NAME,
    title: {
      default: LC26_PUBLIC_SITE_NAME,
      template: `%s · ${LC26_PUBLIC_SITE_NAME}`,
    },
    description: LC26_PUBLIC_SITE_DESCRIPTION,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "website",
      locale: "da_DK",
      url: canonicalPath,
      siteName: LC26_PUBLIC_SITE_NAME,
      title: LC26_PUBLIC_SITE_NAME,
      description: LC26_PUBLIC_SITE_DESCRIPTION,
      images: [
        {
          url: LC26_PUBLIC_OG_IMAGE_PATH,
          width: 1200,
          height: 675,
          alt: LC26_PUBLIC_SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: LC26_PUBLIC_SITE_NAME,
      description: LC26_PUBLIC_SITE_DESCRIPTION,
      images: [LC26_PUBLIC_OG_IMAGE_PATH],
    },
    icons: {
      icon: [{ url: "/favicon.png", sizes: "512x512", type: "image/png" }],
      apple: [{ url: "/favicon.png", sizes: "512x512", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      title: LC26_PUBLIC_SITE_SHORT_NAME,
      statusBarStyle: "black-translucent",
    },
  };
}
