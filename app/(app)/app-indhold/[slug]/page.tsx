import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { CalendarClock, ExternalLink, Info, MapPinned, Newspaper } from "lucide-react";
import { Lc26PageContentEditor } from "@/components/lc26-page-content-editor";
import { fetchLc26PageContent, type Lc26PageKey } from "@/lib/lc26-page-content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const slugToPageKey: Record<string, { key: Lc26PageKey; label: string; previewHref: string }> = {
  "dagens-program": { key: "program", label: "Dagens program", previewHref: "/lykkecup26/side-1" },
  "find-rundt-i-mch": { key: "find-rundt", label: "Find rundt i MCH", previewHref: "/lykkecup26/side-2" },
  "praktisk-info": { key: "praktisk-info", label: "Praktisk info", previewHref: "/lykkecup26/side-3" },
  "nyt-fra-lykkeliga": { key: "nyt-fra-lykkeliga", label: "Nyt fra LykkeLiga", previewHref: "/lykkecup26/nyt-fra-lykkeliga" },
};

const pageVisuals: Record<Lc26PageKey, { icon: ComponentType<{ className?: string }>; style: string }> = {
  program: { icon: CalendarClock, style: "from-sky-50 via-cyan-50/60 to-white border-sky-200 dark:from-sky-950/20 dark:via-cyan-950/10 dark:to-transparent dark:border-sky-900/40" },
  "find-rundt": { icon: MapPinned, style: "from-violet-50 via-indigo-50/50 to-white border-violet-200 dark:from-violet-950/20 dark:via-indigo-950/10 dark:to-transparent dark:border-violet-900/40" },
  "praktisk-info": { icon: Info, style: "from-amber-50 via-yellow-50/50 to-white border-amber-200 dark:from-amber-950/20 dark:via-yellow-950/10 dark:to-transparent dark:border-amber-900/40" },
  "nyt-fra-lykkeliga": { icon: Newspaper, style: "from-fuchsia-50 via-pink-50/50 to-white border-fuchsia-200 dark:from-fuchsia-950/20 dark:via-pink-950/10 dark:to-transparent dark:border-fuchsia-900/40" },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cfg = slugToPageKey[slug];
  if (!cfg) return { title: "App indhold" };
  return {
    title: `App indhold · ${cfg.label}`,
    description: `Rediger indhold for ${cfg.label} i LykkeCup26 appen`,
  };
}

export default async function AppIndholdEditPage({ params }: PageProps) {
  const { slug } = await params;
  const cfg = slugToPageKey[slug];
  if (!cfg) notFound();
  const visual = pageVisuals[cfg.key];

  const { row, error } = await fetchLc26PageContent(cfg.key);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className={`rounded-2xl border bg-gradient-to-r px-5 py-6 ${visual.style}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">App indhold</p>
            <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
              <visual.icon className="h-7 w-7 text-[#0d9488] dark:text-teal-300" aria-hidden />
              {cfg.label}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              Rediger tekst, billeder og struktur for siden. Gem for at publicere opdateringer i appen med det samme.
            </p>
          </div>
          <a
            href={cfg.previewHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
          >
            Se frontend
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Indhold kunne ikke hentes fra databasen ({error}). Fallback-indhold vises.
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/35">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Forhaandsvisning</p>
        <iframe
          title={`Forhaandsvisning af ${cfg.label}`}
          src={cfg.previewHref}
          className="h-[440px] w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
        />
      </div>

      <Lc26PageContentEditor pageKey={cfg.key} initialRow={row} previewHref={cfg.previewHref} />
    </div>
  );
}
