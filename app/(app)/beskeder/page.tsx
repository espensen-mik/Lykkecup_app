import type { Metadata } from "next";
import { Lc26BeskederAdminClient } from "@/components/lc26-beskeder-admin-client";

export const metadata: Metadata = {
  title: "Beskeder",
  description: "Planlæg beskeder til LykkeCup 26-webappen",
};

export default function BeskederPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 lg:space-y-10">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em]" style={{ color: "#df6763" }}>
          LykkeCup 26
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">Beskeder</h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Opret beskeder til den offentlige indbakke på{" "}
          <span className="font-medium text-gray-700 dark:text-gray-300">/lykkecup26</span>. Angiv afsender, emne, tekst og
          hvornår beskeden skal kunne åbnes. Upload et lille portræt (avatar), hvis du vil.
        </p>
      </header>

      <Lc26BeskederAdminClient />
    </div>
  );
}
