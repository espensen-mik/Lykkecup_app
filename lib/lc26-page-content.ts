import { supabase } from "@/lib/supabase";
import { LYKKECUP26_EVENT_ID } from "@/lib/lykkecup26-public";

export const LC26_PAGE_CONTENT_IMAGE_BUCKET = "lc26_page_content_images";

export type Lc26PageKey = "program" | "find-rundt" | "praktisk-info" | "nyt-fra-lykkeliga" | "lykke-og-lagkage";

/** Offentlig URL til VIP-programmet (ikke i burger-menu — kun direkte link / QR). */
export const LC26_LYKKE_LAGKAGE_HREF = "/lykkecup26/lykke-og-lagkage" as const;

export type Lc26ProgramScheduleItem = {
  time: string;
  title: string;
  /** Fx «SKY Lounge · BOXEN» — bruges på VIP-programmet. */
  location?: string;
  note?: string;
  highlight?: boolean;
};

export type Lc26ProgramContent = {
  caption: string;
  schedule: Lc26ProgramScheduleItem[];
};

export type Lc26FindRundtContent = {
  cards: { title: string; body: string; imageUrl?: string }[];
};

export type Lc26PraktiskInfoContent = {
  sections: { title: string; body: string }[];
  faq: { q: string; a: string }[];
};

/** Tag-farve på nyhedsbilleder — kun LykkeCup 26-paletten. */
export type Lc26NytTagTone = "teal" | "navy" | "gold";

export const LC26_NYT_TAG_TONE_OPTIONS: { value: Lc26NytTagTone; label: string }[] = [
  { value: "teal", label: "Teal" },
  { value: "navy", label: "Navy" },
  { value: "gold", label: "Guld" },
];

export const LC26_NYT_TAG_TONE_CLASS: Record<Lc26NytTagTone, string> = {
  teal: "bg-lc26-teal text-white shadow-sm",
  navy: "bg-lc26-navy text-white shadow-sm",
  gold: "bg-lc26-gold-dark text-white shadow-sm",
};

export type Lc26NytArticle = {
  tag: string;
  /** @deprecated Brug `tagTone`. Beholdes for ældre rækker i databasen. */
  tagClass?: string;
  tagTone?: Lc26NytTagTone;
  date: string;
  dateIso: string;
  title: string;
  paragraphs: string[];
  imageUrl?: string;
  imageCaption?: string;
  /** Valgfrit link nederst i artiklen (åbner i ny fane). */
  linkUrl?: string;
  linkLabel?: string;
};

/** Normaliserer sti til fil i `public/` (fx `Nyhed1_kongeligt.webp` → `/Nyhed1_kongeligt.webp`). */
export function normalizeLc26ImageUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed}`;
}

export function isLc26RemoteImageUrl(src: string): boolean {
  return src.startsWith("http://") || src.startsWith("https://");
}

/** Vælger palet-tag ud fra `tagTone` eller falder tilbage for ældre `tagClass`/rækkefølge. */
export function resolveLc26NytTagTone(article: Pick<Lc26NytArticle, "tagTone" | "tagClass">, index: number): Lc26NytTagTone {
  if (article.tagTone === "teal" || article.tagTone === "navy" || article.tagTone === "gold") {
    return article.tagTone;
  }
  const legacy = (article.tagClass ?? "").toLowerCase();
  if (legacy.includes("navy")) return "navy";
  if (legacy.includes("gold") || legacy.includes("amber")) return "gold";
  if (legacy.includes("teal") || legacy.includes("emerald")) return "teal";
  const cycle: Lc26NytTagTone[] = ["teal", "navy", "gold"];
  return cycle[index % cycle.length]!;
}

export type Lc26NytContent = {
  articles: Lc26NytArticle[];
};

export type Lc26PageContentRow = {
  pageKey: Lc26PageKey;
  title: string;
  intro: string;
  heroImageUrl: string | null;
  content: unknown;
  updatedAt: string | null;
};

const defaults: Record<
  Lc26PageKey,
  { title: string; intro: string; heroImageUrl: string | null; content: unknown }
> = {
  program: {
    title: "Dagens program",
    intro: "Fra kl. 9.00 til 21.00 — tiderne kan justeres, når det endelige program foreligger.",
    heroImageUrl: "/mumle.webp",
    content: {
      caption: "Glæd dig til at Mumle spiller medaljekoncert kl. 16.30 i Boxen",
      schedule: [
        { time: "09.00", title: "Velkommen — hallen åbner", note: "Kaffe og morgenhygge ved indgangen" },
        { time: "10.00", title: "Håndboldkampene starter", note: "Første fløjt på alle baner" },
        { time: "11.30", title: "Pause", note: "Forfriskninger ved sidelinjen" },
        { time: "12.30", title: "Frokost", note: "Caféen er åben — se menu på opslag" },
        { time: "14.00", title: "Puljer og semifinaler", note: "Opdateret kampprogram på storskærm" },
        { time: "16.30", title: "Medaljekoncert med Mumle", note: "I Boxen — find plads i god tid" },
        { time: "18.00", title: "Middag og hygge", note: "Fælles spisning for holdene" },
        { time: "19.30", title: "Præmieoverrækkelse", note: "Hæder til dagens helte" },
        { time: "21.00", title: "Tak for i dag", note: "Vi ses i morgen" },
      ],
    } satisfies Lc26ProgramContent,
  },
  "find-rundt": {
    title: "Find rundt i MCH",
    intro:
      "Her finder du snart kort og oversigter, så spillere og familier nemt kan orientere sig i Messecenter Herning. Teksten og grafikken nedenfor er pladsholdere.",
    heroImageUrl: null,
    content: {
      cards: [
        {
          title: "Oversigtskort — MCH",
          body: "Her kommer et samlet kort over Messecenter Herning med indgange, hallområder og fælles faciliteter.",
        },
        { title: "Boxen & omklædning", body: "Pladsholder til et kort med tribuner, scenen og nærmeste toiletter og omklædning." },
        { title: "Parkering & ankomst", body: "Pladsholder til p-pladser, cykelparkering og vejvisning fra motorvejen." },
      ],
    } satisfies Lc26FindRundtContent,
  },
  "praktisk-info": {
    title: "Praktisk info",
    intro: "Korte pladsholdere til praktiske emner. Erstat teksterne med endeligt indhold, når det er klar.",
    heroImageUrl: null,
    content: {
      sections: [
        {
          title: "Åbningstider",
          body: "Pladsholder: Her beskrives hvornår hallen, café og sekretariat typisk er åbne under LykkeCup. Ret tider og tilføj undtagelser, når programmet er fastlagt.",
        },
        {
          title: "Parkering og transport",
          body: "Pladsholder: Kort om P-pladser, handicapparkering, bus og tog til Herning. Link til rejseplan kan tilføjes senere.",
        },
      ],
      faq: [
        {
          q: "Hvor finder jeg kampprogrammet?",
          a: "Pladsholder: Beskriv hvor programmet vises — fx app, web, opslag i hallen eller på storskærm.",
        },
      ],
    } satisfies Lc26PraktiskInfoContent,
  },
  "lykke-og-lagkage": {
    title: "Lykke & Lagkage",
    intro:
      "Kære gæst til LykkeCup. Velkommen til en særlig dag med håndbold i verdensklasse, musik og Danmarks lykkeligste VIP-event. Her finder du dit personlige program for dagen.",
    heroImageUrl: "/lykkecupheader4.webp",
    content: {
      caption: "",
      schedule: [
        {
          time: "9.15",
          title: "Indløb og åbningsceremoni",
          location: "SKY Lounge · BOXEN",
          note: "Oplev den rørende og livsglade indmarch i Boxen, når 950 lykkelige håndboldspillere gør deres entré",
        },
        {
          time: "10.10",
          title: "Håndboldkampe starter",
          location: "BOXEN & Hal L",
          note: "Så er der håndbold i verdensklasse. Alle kampe har en varighed på 9 minutter",
        },
        {
          time: "10.20",
          title: "Opvisningskamp",
          location: "Hal L, Bane 7",
          note: "Der er masser af stjerner, når der spilles opvisningskamp i Hal L.",
        },
        {
          time: "11.00",
          title: "Lykke & Lagkage",
          location: "SKY Lounge · BOXEN",
          note: "Lykke & Lagkage er Danmarks lykkeligste VIP-event, hvor gæster af LykkeLiga får årets status på lykken.",
          highlight: true,
        },
        {
          time: "12.00",
          title: "Guidet rundvisning",
          location: "BOXEN & Hal L",
          note: "I selskab med medarbejdere og bestyrelse fra LykkeLiga tager vi jer med på rundtur i MCH, hvor I kan snuse til lykken.",
        },
      ],
    } satisfies Lc26ProgramContent,
  },
  "nyt-fra-lykkeliga": {
    title: "Nyt fra LykkeLiga",
    intro:
      "Seneste nyt, reportager og praktiske historier fra LykkeLiga og LykkeCup. Artiklerne nedenfor er pladsholdere — udskift tekst og billeder, når indholdet er klar.",
    heroImageUrl: "/musik.jpg",
    content: {
      articles: [
        {
          tag: "Musik",
          tagTone: "teal",
          date: "12. april 2026",
          dateIso: "2026-04-12",
          title: "LykkeLiga udgiver 10 nye musikhits",
          imageUrl: "/musik.jpg",
          imageCaption:
            "Spillere fra Vordingborg i koncentreret process med at lave lykkelig musik i efteråret 2025.",
          paragraphs: [
            "Så kan du godt skrue op, for der er ny LykkeLiga-musik til din håndboldtræning.",
            "Find alle sangene i vores helt nye webapp: LykkeMusik",
          ],
        },
      ],
    } satisfies Lc26NytContent,
  },
};

export async function fetchLc26PageContent(pageKey: Lc26PageKey): Promise<{ row: Lc26PageContentRow; error: string | null }> {
  const { data, error } = await supabase
    .from("lc26_page_content")
    .select("page_key, title, intro, hero_image_url, content, updated_at")
    .eq("event_id", LYKKECUP26_EVENT_ID)
    .eq("page_key", pageKey)
    .maybeSingle();

  if (error) {
    return {
      row: {
        pageKey,
        title: defaults[pageKey].title,
        intro: defaults[pageKey].intro,
        heroImageUrl: defaults[pageKey].heroImageUrl,
        content: defaults[pageKey].content,
        updatedAt: null,
      },
      error: error.message,
    };
  }

  if (!data) {
    return {
      row: {
        pageKey,
        title: defaults[pageKey].title,
        intro: defaults[pageKey].intro,
        heroImageUrl: defaults[pageKey].heroImageUrl,
        content: defaults[pageKey].content,
        updatedAt: null,
      },
      error: null,
    };
  }

  return {
    row: {
      pageKey: pageKey,
      title: (data as { title: string | null }).title ?? defaults[pageKey].title,
      intro: (data as { intro: string | null }).intro ?? defaults[pageKey].intro,
      heroImageUrl: (data as { hero_image_url: string | null }).hero_image_url ?? defaults[pageKey].heroImageUrl,
      content: (data as { content: unknown }).content ?? defaults[pageKey].content,
      updatedAt: (data as { updated_at: string | null }).updated_at ?? null,
    },
    error: null,
  };
}
