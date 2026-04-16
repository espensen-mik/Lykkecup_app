import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerPublicView } from "@/components/lykkecup26/player-public-view";
import { fetchLykkecup26PlayerPage } from "@/lib/lykkecup26-public";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchLykkecup26PlayerPage(id);
  if (!data.player) {
    return { title: "Spiller" };
  }
  return {
    title: data.player.name,
    description: `Hold og kampprogram for ${data.player.name} — LykkeCup 26`,
  };
}

export default async function Lykkecup26PlayerPage({ params }: PageProps) {
  const { id } = await params;
  const data = await fetchLykkecup26PlayerPage(id);

  if (data.error) {
    return <PlayerPublicView data={data} currentPlayerId={id} />;
  }

  if (!data.player) {
    notFound();
  }

  return <PlayerPublicView data={data} currentPlayerId={id} />;
}
