import type { Metadata } from "next";
import { OpenPlayerRowButton } from "@/components/open-player";
import { UNKNOWN_CLUB_LABEL, groupPlayersByClub } from "@/lib/clubs";
import { indexFeedbackByClub, fetchClubFeedbackForEvent } from "@/lib/club-feedback";
import { formatDaDateTime } from "@/lib/datetime";
import { getLevelVisualClasses } from "@/lib/level-colors";
import { fetchPlayersForEvent } from "@/lib/players";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Klubber",
  description: "Spillere grupperet efter klub",
};

function formatLevel(level: string | null): string | null {
  if (level == null || String(level).trim() === "") return null;
  return String(level);
}

export default async function KlubberPage() {
  const [playersRes, feedbackRes] = await Promise.all([
    fetchPlayersForEvent(),
    fetchClubFeedbackForEvent(),
  ]);
  const { players, error } = playersRes;
  const feedbackByClub = indexFeedbackByClub(feedbackRes.comments);
  const feedbackLoadError = feedbackRes.error;

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Klubber
        </h1>
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse spillere: {error}
        </div>
      </div>
    );
  }

  const groups = groupPlayersByClub(players);
  const totalClubs = groups.filter((g) => g.name !== UNKNOWN_CLUB_LABEL).length;
  const unknownCount = groups.find((g) => g.name === UNKNOWN_CLUB_LABEL)?.players.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-10 lg:space-y-11">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Oversigt
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Klubber
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Hvem der deltager fra hvilken klub ved dette arrangement.{" "}
          <span className="tabular-nums text-gray-700 dark:text-gray-300">
            {totalClubs > 0 && (
              <>
                {totalClubs} {totalClubs === 1 ? "klub" : "klubber"}
                {unknownCount > 0 ? " · " : ""}
              </>
            )}
            {unknownCount > 0 && (
              <>
                {unknownCount} {unknownCount === 1 ? "spiller" : "spillere"} uden klub
              </>
            )}
            {totalClubs === 0 && unknownCount === 0 && "Ingen spillere endnu."}
          </span>
        </p>
      </header>

      {feedbackLoadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Kommentarer kunne ikke indlæses: {feedbackLoadError}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Ingen spillere at vise.</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          {groups.map((group) => {
            const clubComments = feedbackByClub.get(group.name) ?? [];
            return (
              <li
                key={group.name}
                className={`overflow-hidden rounded-lg border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none ${
                  group.name === UNKNOWN_CLUB_LABEL ? "lg:col-span-2" : ""
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-lc-border bg-gray-50/80 px-5 py-3.5 dark:border-gray-700 dark:bg-gray-800/40">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    {group.name}
                  </h2>
                  <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-[#0f766e] dark:bg-teal-950/50 dark:text-teal-300">
                    {group.players.length}{" "}
                    {group.players.length === 1 ? "spiller" : "spillere"}
                  </span>
                </div>
                <ul className="divide-y divide-lc-border dark:divide-gray-700">
                  {group.players.map((p) => {
                    const lvl = formatLevel(p.level);
                    const lv = getLevelVisualClasses(p.level);
                    return (
                      <li key={p.id}>
                        <OpenPlayerRowButton
                          playerId={p.id}
                          className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#14b8a6]/25 dark:focus-visible:ring-teal-500/30 ${lv.row} ${lv.rowHover} ${lv.rowFocus}`}
                        >
                          <span className="font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400">
                            {p.name}
                          </span>
                          {lvl ? (
                            <span className={lv.badge}>Niveau {lvl}</span>
                          ) : null}
                        </OpenPlayerRowButton>
                      </li>
                    );
                  })}
                </ul>
                {clubComments.length > 0 ? (
                  <div className="border-t border-lc-border dark:border-gray-700">
                    <p className="border-b border-gray-100 bg-gray-50/50 px-5 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
                      Kommentarer
                    </p>
                    <ul className="max-h-56 divide-y divide-lc-border overflow-y-auto dark:divide-gray-700">
                      {clubComments.map((c) => (
                        <li key={c.id} className="px-5 py-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                              {c.author_name}
                            </span>
                            <time
                              className="text-[0.6875rem] tabular-nums text-gray-400 dark:text-gray-500"
                              dateTime={c.created_at}
                            >
                              {formatDaDateTime(c.created_at)}
                            </time>
                          </div>
                          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                            {c.comment_text}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
