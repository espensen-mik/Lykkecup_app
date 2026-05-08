import { supabase } from "@/lib/supabase";
import { LYKKECUP26_EVENT_ID } from "@/lib/lykkecup26-public";

export const LC26_PAGE_CONTENT_IMAGE_BUCKET = "lc26_page_content_images";

export type Lc26PageKey = "program" | "find-rundt" | "praktisk-info" | "nyt-fra-lykkeliga";

export type Lc26ProgramScheduleItem = {
  time: string;
  title: string;
  note?: string;
  highlight?: boolean;
};

export type Lc26ProgramContent = {
  caption: string;
  schedule: Lc26ProgramScheduleItem[];
};

export type Lc26FindRundtContent = {
  cards: { title: string; body: string }[];
};

export type Lc26PraktiskInfoContent = {
  sections: { title: string; body: string }[];
  faq: { q: string; a: string }[];
};

export type Lc26NytArticle = {
  tag: string;
  tagClass: string;
  date: string;
  dateIso: string;
  title: string;
  paragraphs: string[];
  imageCaption?: string;
};

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
    heroImageUrl: "/mumle.jpg",
    content: {
      caption: "Glæd dig til at Mumle spiller medaljekoncert kl. 16.30 i Boxen",
      schedule: [
        { time: "09.00", title: "Velkommen — hallen åbner", note: "Kaffe og morgenhygge ved indgangen" },
        { time: "10.00", title: "Håndboldkampene starter", note: "Første fløjt på alle baner" },
        { time: "11.30", title: "Pause", note: "Forfriskninger ved sidelinjen" },
        { time: "12.30", title: "Frokost", note: "Caféen er åben — se menu på opslag" },
        { time: "14.00", title: "Puljer og semifinaler", note: "Opdateret kampprogram på storskærm" },
        { time: "16.30", title: "Medaljekoncert med Mumle", note: "I Boxen — find plads i god tid", highlight: true },
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
  "nyt-fra-lykkeliga": {
    title: "Nyt fra LykkeLiga",
    intro:
      "Seneste nyt, reportager og praktiske historier fra LykkeLiga og LykkeCup. Artiklerne nedenfor er pladsholdere — udskift tekst og billeder, når indholdet er klar.",
    heroImageUrl: "/musik.jpg",
    content: {
      articles: [
        {
          tag: "Musik",
          tagClass: "bg-lc26-teal text-white shadow-sm",
          date: "12. april 2026",
          dateIso: "2026-04-12",
          title: "LykkeLiga udgiver 10 nye musikhits",
          imageCaption: "Spillere fra Vordingborg i koncentreret process med at lave lykkelig musik i efteråret 2025.",
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
