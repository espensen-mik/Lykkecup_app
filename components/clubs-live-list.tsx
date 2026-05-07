"use client";

import { CheckCircle2, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { OpenPlayerRowButton } from "@/components/open-player";
import { UNKNOWN_CLUB_LABEL, groupPlayersByClub } from "@/lib/clubs";
import { indexFeedbackByClub } from "@/lib/club-feedback";
import { formatDaDateTime } from "@/lib/datetime";
import { getLevelVisualClasses } from "@/lib/level-colors";
import { subscribePlayerUpdated } from "@/lib/player-updates";
import type { Player } from "@/types/player";
import type { ClubFeedbackRow } from "@/types/club-feedback";

type Props = {
  initialPlayers: Player[];
  comments: ClubFeedbackRow[];
  assignedPlayerIds: string[];
  feedbackLoadError: string | null;
  membersLoadError: string | null;
};

function formatLevel(level: string | null): string | null {
  if (level == null || String(level).trim() === "") return null;
  return String(level);
}

export function ClubsLiveList({
  initialPlayers,
  comments,
  assignedPlayerIds,
  feedbackLoadError,
  membersLoadError,
}: Props) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);

  useEffect(() => {
    setPlayers(initialPlayers);
  }, [initialPlayers]);

  useEffect(() => {
    return subscribePlayerUpdated((updated) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === updated.id
            ? {
                ...p,
                name: updated.name ?? p.name,
                home_club: updated.home_club ?? null,
                level: updated.level ?? null,
                age: updated.age ?? null,
                ticket_id: updated.ticket_id ?? p.ticket_id,
              }
            : p,
        ),
      );
    });
  }, []);

  const feedbackByClub = useMemo(() => indexFeedbackByClub(comments), [comments]);
  const assignedPlayerIdSet = useMemo(() => new Set(assignedPlayerIds), [assignedPlayerIds]);
  const groups = useMemo(() => groupPlayersByClub(players), [players]);
  const totalClubs = groups.filter((g) => g.name !== UNKNOWN_CLUB_LABEL).length;
  const unknownCount = groups.find((g) => g.name === UNKNOWN_CLUB_LABEL)?.players.length ?? 0;

  return (
    <>
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
      {membersLoadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Holddannelse-fremdrift kunne ikke indlæses: {membersLoadError}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Ingen spillere at vise.</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2 lg:gap-5">
          {groups.map((group) => {
            const clubComments = feedbackByClub.get(group.name) ?? [];
            const totalPlayers = group.players.length;
            const assignedPlayers = group.players.reduce(
              (count, player) => count + (assignedPlayerIdSet.has(player.id) ? 1 : 0),
              0,
            );
            const progressPercent = totalPlayers > 0 ? (assignedPlayers / totalPlayers) * 100 : 0;
            return (
              <li
                key={group.name}
                className={`overflow-hidden rounded-lg border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none ${
                  group.name === UNKNOWN_CLUB_LABEL ? "lg:col-span-2" : ""
                }`}
              >
                <div className="space-y-2 border-b border-lc-border bg-gray-50/80 px-5 py-3.5 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">{group.name}</h2>
                    <span
                      title={`Antal spillere i ${group.name}: ${group.players.length}`}
                      className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-[#0f766e] dark:bg-teal-950/50 dark:text-teal-300"
                    >
                      {group.players.length} {group.players.length === 1 ? "spiller" : "spillere"}
                    </span>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[0.7rem] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <span>Holddannelse</span>
                      <span className="tabular-nums">
                        {assignedPlayers}/{totalPlayers} · {Math.round(progressPercent)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-[width] duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                      />
                    </div>
                  </div>
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
                          {lvl ? <span className={lv.badge}>Niveau {lvl}</span> : null}
                        </OpenPlayerRowButton>
                      </li>
                    );
                  })}
                </ul>
                {clubComments.length > 0 ? (
                  <details className="group border-t border-lc-border dark:border-gray-700">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-gray-50/50 px-5 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500 transition-colors hover:bg-gray-100/70 dark:bg-gray-800/30 dark:text-gray-400 dark:hover:bg-gray-800/45">
                      <span>
                        Træner kommentar
                        <span className="ml-1 text-[0.62rem] font-medium normal-case tracking-normal text-gray-400 dark:text-gray-500">
                          ({clubComments.length})
                        </span>
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
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
                          {c.author_phone?.trim() ? (
                            <p className="mt-1 text-[0.6875rem] tabular-nums text-gray-600 dark:text-gray-400">
                              Tel. {c.author_phone.trim()}
                            </p>
                          ) : null}
                          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                            {c.comment_text}
                          </p>
                          {c.handled_at ? (
                            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                              Håndteret
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
