import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildLc26PublicMetadata } from "@/lib/lc26-public-site-metadata";

/** Deling af lykkecup.dk/ skal vise offentlig app — ikke KontrolCenter. */
export const metadata: Metadata = buildLc26PublicMetadata({ canonicalPath: "/" });

/** Offentlig forside — samme app som /lykkecup26. */
export default function HomePage() {
  redirect("/lykkecup26");
}
