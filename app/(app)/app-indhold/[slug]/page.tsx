import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lc26PageContentEditor } from "@/components/lc26-page-content-editor";
import { fetchLc26PageContent, type Lc26PageKey } from "@/lib/lc26-page-content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const slugToPageKey: Record<string, { key: Lc26PageKey; label: string }> = {
  "dagens-program": { key: "program", label: "Dagens program" },
  "find-rundt-i-mch": { key: "find-rundt", label: "Find rundt i MCH" },
  "praktisk-info": { key: "praktisk-info", label: "Praktisk info" },
  "nyt-fra-lykkeliga": { key: "nyt-fra-lykkeliga", label: "Nyt fra LykkeLiga" },
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

  const { row, error } = await fetchLc26PageContent(cfg.key);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="max-w-3xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">App indhold</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">{cfg.label}</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Rediger tekst og struktur for siden. JSON-feltet styrer sektioner/lister på den offentlige side.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Indhold kunne ikke hentes fra databasen ({error}). Fallback-indhold vises.
        </div>
      ) : null}

      <Lc26PageContentEditor pageKey={cfg.key} initialRow={row} />
    </div>
  );
}
