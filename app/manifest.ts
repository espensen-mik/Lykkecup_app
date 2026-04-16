import type { MetadataRoute } from "next";

const ICON = "/Kontrolcenter26.jpg";

/** Web App Manifest — ikon ved «Tilføj til hjemmeskærm» (især Android/Chrome). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LykkeCup KontrolCenter",
    short_name: "KontrolCenter",
    description: "LykkeCup KontrolCenter — spillere, klubber og overblik",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#14b8a6",
    icons: [
      {
        src: ICON,
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: ICON,
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "maskable",
      },
    ],
  };
}
