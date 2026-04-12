import type { Metadata } from "next";
import { formatDaDateTime } from "@/lib/datetime";
import { fetchClubFeedbackForEvent } from "@/lib/club-feedback";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kommentarer",
  description: "Alle trænerkommentarer for arrangementet",
};

export default async function KommentarerPage() {
  const { comments, error } = await fetchClubFeedbackForEvent();

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Kommentarer
        </h1>
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse kommentarer: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 lg:space-y-11">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Trænere
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Kommentarer
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Samlet oversigt over kommentarer om niveauer og holdinddeling.{" "}
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {comments.length}{" "}
            {comments.length === 1 ? "kommentar" : "kommentarer"}
          </span>
        </p>
      </header>

      {comments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          Der er endnu ingen kommentarer registreret.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li
              key={c.id}
              className="overflow-hidden rounded-xl border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-lc-border bg-gray-50/80 px-5 py-3 dark:border-gray-700 dark:bg-gray-800/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {c.home_club?.trim() || "—"}
                </p>
                <time
                  className="text-xs tabular-nums text-gray-500 dark:text-gray-400"
                  dateTime={c.created_at}
                >
                  {formatDaDateTime(c.created_at)}
                </time>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {c.author_name}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {c.comment_text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
