import { Lykkecup26ProgramDagWithContent } from "@/components/lykkecup26/lykkecup26-program-dag";
import { fetchLc26PageContent } from "@/lib/lc26-page-content";

export const dynamic = "force-dynamic";

export default async function Side1Page() {
  const { row } = await fetchLc26PageContent("program");
  return (
    <Lykkecup26ProgramDagWithContent
      title={row.title}
      intro={row.intro}
      heroImageUrl={row.heroImageUrl}
      content={row.content as { caption: string; schedule: { time: string; title: string; note?: string; highlight?: boolean }[] }}
    />
  );
}
