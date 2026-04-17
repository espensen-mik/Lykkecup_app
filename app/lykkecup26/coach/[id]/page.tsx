import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoachPublicView } from "@/components/lykkecup26/coach-public-view";
import { fetchLykkecup26CoachPage } from "@/lib/lykkecup26-public";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchLykkecup26CoachPage(id);
  if (!data.coach) return { title: "Træner" };
  return {
    title: data.coach.name,
    description: `Holdoversigt for ${data.coach.name} — LykkeCup 26`,
  };
}

export default async function Lykkecup26CoachPage({ params }: PageProps) {
  const { id } = await params;
  const data = await fetchLykkecup26CoachPage(id);

  if (data.error) {
    return <CoachPublicView data={data} currentCoachId={id} />;
  }
  if (!data.coach) {
    notFound();
  }
  return <CoachPublicView data={data} currentCoachId={id} />;
}
