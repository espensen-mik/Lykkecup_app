import type { Metadata } from "next";
import { BanerTiderWorkspace } from "@/components/turnering/baner-tider-workspace";
import { createServerSupabase } from "@/lib/auth-server";
import { fetchBanerTiderData } from "@/lib/baner-tider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Baner & tider",
  description: "Haller, baner, åbningstider og niveauindstillinger",
};

export default async function BanerTiderPage() {
  const supabase = await createServerSupabase();
  const bundle = await fetchBanerTiderData(supabase);
  return <BanerTiderWorkspace initial={bundle} />;
}
