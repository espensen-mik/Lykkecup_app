import { Lykkecup26HomeClient } from "@/components/lykkecup26/lykkecup26-home-client";
import { fetchLykkecup26HomeData } from "@/lib/lykkecup26-public";

export const dynamic = "force-dynamic";

export default async function Lykkecup26HomePage() {
  const bundle = await fetchLykkecup26HomeData();
  return <Lykkecup26HomeClient bundle={bundle} />;
}
