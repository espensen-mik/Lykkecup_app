import { Lykkecup26PraktiskInfoWithContent } from "@/components/lykkecup26/lykkecup26-praktisk-info";
import { fetchLc26PageContent } from "@/lib/lc26-page-content";

export const dynamic = "force-dynamic";

export default async function Side3Page() {
  const { row } = await fetchLc26PageContent("praktisk-info");
  return (
    <Lykkecup26PraktiskInfoWithContent
      title={row.title}
      intro={row.intro}
      content={row.content as { sections: { title: string; body: string }[]; faq: { q: string; a: string }[] }}
    />
  );
}
