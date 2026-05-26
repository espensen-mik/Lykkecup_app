import { GenerationProgress } from "@/components/ui/generation-progress";

export default function KampprogramLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <header className="max-w-3xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Turnering
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Kampprogram
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Indlæser kampe, baner og planlægning…
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
        <div className="p-6 sm:p-8">
          <GenerationProgress
            indeterminate
            label="Henter kampprogram…"
            detail="Dette kan tage et øjeblik ved mange kampe"
          />
        </div>
      </div>
    </div>
  );
}
