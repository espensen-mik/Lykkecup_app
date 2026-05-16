import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LykkecupCheckWorkspace } from "@/components/kampprogram/lykkecup-check-workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LykkeCup Check",
  description: "Live kontrol af spillere, hold, puljer og kampprogram",
};

export default function LykkecupCheckPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <header className="max-w-3xl">
        <Link
          href="/kampprogram"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#0d9488] hover:underline dark:text-teal-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kampprogram
        </Link>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Turnering
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          LykkeCup Check
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Turneringskontrol på tværs af holddannelse, puljer, kampgenerering og planlægning. Kør tjekket når du har lavet
          ændringer — så tallene og checkmarks viser om alt stemmer.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
        <div className="p-6 sm:p-8">
          <LykkecupCheckWorkspace />
        </div>
      </div>
    </div>
  );
}
