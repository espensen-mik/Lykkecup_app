"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { StyledSelect } from "@/components/ui/styled-select";
import { formatDaDateTime } from "@/lib/datetime";
import type { ClubFeedbackRow } from "@/types/club-feedback";

type Props = {
  comments: ClubFeedbackRow[];
  totalCount: number;
};

const ALL_CLUBS = "__all__";

export function KommentarerFilteredList({ comments, totalCount }: Props) {
  const [clubKey, setClubKey] = useState<string>(ALL_CLUBS);
  const [query, setQuery] = useState("");

  const clubs = useMemo(() => {
    const set = new Set<string>();
    for (const c of comments) {
      const t = c.home_club?.trim();
      if (t) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
  }, [comments]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return comments.filter((c) => {
      const club = c.home_club?.trim() ?? "";
      if (clubKey !== ALL_CLUBS && club !== clubKey) return false;
      if (!needle) return true;
      const blob = [c.comment_text, c.author_name, club, c.created_at]
        .join("\n")
        .toLowerCase();
      return blob.includes(needle);
    });
  }, [comments, clubKey, query]);

  const filterActive =
    clubKey !== ALL_CLUBS || query.trim().length > 0 || filtered.length !== totalCount;

  if (comments.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        Der er endnu ingen kommentarer registreret.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label
            htmlFor="kommentarer-club"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Klub
          </label>
          <StyledSelect
            id="kommentarer-club"
            value={clubKey}
            onChange={(e) => setClubKey(e.target.value)}
            className="rounded-lg border border-lc-border bg-white py-2.5 pl-3 text-sm text-gray-900 shadow-sm outline-none transition-colors focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/25 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value={ALL_CLUBS}>Alle klubber</option>
            {clubs.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </StyledSelect>
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[min(100%,20rem)]">
          <label
            htmlFor="kommentarer-search"
            className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Søg
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              strokeWidth={2}
              aria-hidden
            />
            <input
              id="kommentarer-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søg i kommentarer, træner eller klub …"
              autoComplete="off"
              className="w-full rounded-lg border border-lc-border bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/25 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {filterActive ? (
          <>
            Viser{" "}
            <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">
              {filtered.length}
            </span>{" "}
            af {totalCount}{" "}
            {totalCount === 1 ? "kommentar" : "kommentarer"}
          </>
        ) : (
          <>
            {totalCount}{" "}
            {totalCount === 1 ? "kommentar" : "kommentarer"} i alt
          </>
        )}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
          Ingen kommentarer matcher filtrene.
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((c) => (
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
