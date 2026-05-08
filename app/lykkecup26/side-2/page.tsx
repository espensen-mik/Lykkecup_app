import { Lykkecup26FindMchWithContent } from "@/components/lykkecup26/lykkecup26-find-mch";
import { fetchLc26PageContent } from "@/lib/lc26-page-content";

export default async function Side2Page() {
  const { row } = await fetchLc26PageContent("find-rundt");
  return (
    <Lykkecup26FindMchWithContent
      title={row.title}
      intro={row.intro}
      content={row.content as { cards: { title: string; body: string }[] }}
    />
  );
}
