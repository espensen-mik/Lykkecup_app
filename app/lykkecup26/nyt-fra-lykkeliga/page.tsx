import { Lykkecup26NytFraLykkeligaWithContent } from "@/components/lykkecup26/lykkecup26-nyt-fra-lykkeliga";
import { fetchLc26PageContent } from "@/lib/lc26-page-content";

export default async function NytFraLykkeligaPage() {
  const { row } = await fetchLc26PageContent("nyt-fra-lykkeliga");
  return (
    <Lykkecup26NytFraLykkeligaWithContent
      title={row.title}
      intro={row.intro}
      heroImageUrl={row.heroImageUrl}
      content={
        row.content as {
          articles: {
            tag: string;
            tagClass: string;
            date: string;
            dateIso: string;
            title: string;
            paragraphs: string[];
            imageCaption?: string;
          }[];
        }
      }
    />
  );
}
