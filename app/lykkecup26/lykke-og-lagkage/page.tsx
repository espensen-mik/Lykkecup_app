import { LykkeLagkageProgram } from "@/components/lykkecup26/lykke-lagkage-program";
import { fetchLc26PageContent, type Lc26ProgramContent } from "@/lib/lc26-page-content";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lykke & Lagkage · LykkeCup 26",
  description: "VIP-program for Lykke & Lagkage",
};

export default async function LykkeOgLagkagePage() {
  const { row } = await fetchLc26PageContent("lykke-og-lagkage");
  const content = row.content as Lc26ProgramContent | null;

  return (
    <LykkeLagkageProgram
      title={row.title}
      intro={row.intro}
      heroImageUrl={row.heroImageUrl}
      content={content ?? undefined}
    />
  );
}
