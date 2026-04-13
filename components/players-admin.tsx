"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { usePlayerModal } from "@/components/player-modal-context";
import { StyledSelect } from "@/components/ui/styled-select";
import { getLevelVisualClasses } from "@/lib/level-colors";
import type { Player } from "@/types/player";

type Props = {
  players: Player[];
  fetchError: string | null;
};

function formatCell(value: string | number | null): string {
  if (value === null || value === "") return "—";
  return String(value);
}

type SortKey = "name" | "home_club" | "level" | "age" | "ticket_id";
type SortDir = "asc" | "desc";

function sortKeyForEmptyString(v: string | null | undefined): string {
  if (v == null || String(v).trim() === "") return "\uffff";
  return String(v);
}

/** Ved klubfilter: niveau først (stigende), derefter navn A–Å. */
function compareLevelThenName(a: Player, b: Player): number {
  const byLevel = comparePlayers(a, b, "level", "asc");
  if (byLevel !== 0) return byLevel;
  return comparePlayers(a, b, "name", "asc");
}

function comparePlayers(a: Player, b: Player, key: SortKey, dir: SortDir): number {
  const mul = dir === "asc" ? 1 : -1;

  switch (key) {
    case "name":
      return mul * a.name.localeCompare(b.name, "da");
    case "home_club": {
      const va = sortKeyForEmptyString(a.home_club);
      const vb = sortKeyForEmptyString(b.home_club);
      return mul * va.localeCompare(vb, "da");
    }
    case "level": {
      const va = sortKeyForEmptyString(a.level == null ? null : String(a.level));
      const vb = sortKeyForEmptyString(b.level == null ? null : String(b.level));
      return mul * va.localeCompare(vb, "da", { numeric: true });
    }
    case "age": {
      const na = a.age;
      const nb = b.age;
      if (na == null && nb == null) return 0;
      if (na == null) return 1;
      if (nb == null) return -1;
      return mul * (na - nb);
    }
    case "ticket_id": {
      const va = sortKeyForEmptyString(a.ticket_id);
      const vb = sortKeyForEmptyString(b.ticket_id);
      return mul * va.localeCompare(vb, "da", { numeric: true });
    }
    default:
      return 0;
  }
}

function sortColumnLabel(key: SortKey): string {
  switch (key) {
    case "name":
      return "navn";
    case "home_club":
      return "klub";
    case "level":
      return "niveau";
    case "age":
      return "alder";
    case "ticket_id":
      return "billet-ID";
    default:
      return "";
  }
}

function SortableTh({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
  sortDisabled,
}: {
  label: string;
  columnKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  sortDisabled?: boolean;
}) {
  const active = !sortDisabled && sortKey === columnKey;
  return (
    <th scope="col" className="px-5 py-3 text-left align-bottom">
      <button
        type="button"
        aria-disabled={sortDisabled || undefined}
        onClick={() => {
          if (!sortDisabled) onSort(columnKey);
        }}
        title={sortDisabled ? "Ved valgt klub sorteres listen automatisk efter niveau og navn" : undefined}
        className={`group inline-flex max-w-full items-center gap-1.5 rounded-md text-left text-[0.6875rem] font-semibold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6]/35 ${
          sortDisabled
            ? "cursor-default text-gray-400 dark:text-gray-500"
            : active
              ? "text-[#0f766e] dark:text-teal-400"
              : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
      >
        <span className="min-w-0">{label}</span>
        <span
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center ${
            active
              ? "opacity-100"
              : sortDisabled
                ? "opacity-0"
                : "text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-600"
          }`}
          aria-hidden
        >
          {active ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.5} />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={2.5} />
          )}
        </span>
        <span className="sr-only">
          {sortDisabled
            ? "Sortering låst: niveau derefter navn."
            : active
              ? sortDir === "asc"
                ? "Sorteret stigende. Klik for faldende."
                : "Sorteret faldende. Klik for stigende."
              : "Sorter kolonne."}
        </span>
      </button>
    </th>
  );
}

export function PlayersAdmin({ players, fetchError }: Props) {
  const { openPlayer } = usePlayerModal();
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<string>("");
  const [club, setClub] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function goToPlayer(playerId: string) {
    openPlayer(playerId);
  }

  const levels = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) {
      if (p.level != null && p.level !== "") set.add(String(p.level));
    }
    return [...set].sort((a, b) =>
      a.localeCompare(b, "da", { numeric: true }),
    );
  }, [players]);

  const clubs = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) {
      if (p.home_club != null && p.home_club !== "") set.add(p.home_club);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "da"));
  }, [players]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (level && String(p.level) !== level) return false;
      if (club && p.home_club !== club) return false;
      return true;
    });
  }, [players, search, level, club]);

  const clubSortMode = club !== "";

  const sortedRows = useMemo(() => {
    if (clubSortMode) {
      return [...filtered].sort(compareLevelThenName);
    }
    return [...filtered].sort((a, b) => comparePlayers(a, b, sortKey, sortDir));
  }, [filtered, sortKey, sortDir, clubSortMode]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (fetchError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
        Kunne ikke indlæse spillere: {fetchError}
      </div>
    );
  }

  const fieldClass =
    "rounded-md border border-lc-border bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-[border-color,box-shadow] outline-none placeholder:text-gray-400 focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/15 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-teal-500 dark:focus:ring-teal-500/20";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Søg efter navn
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Skriv for at filtrere …"
            className={fieldClass}
          />
        </label>
        <label className="flex min-w-[10rem] flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Niveau
          <StyledSelect value={level} onChange={(e) => setLevel(e.target.value)} className={fieldClass}>
            <option value="">Alle niveauer</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </StyledSelect>
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Klub
          <StyledSelect value={club} onChange={(e) => setClub(e.target.value)} className={fieldClass}>
            <option value="">Alle klubber</option>
            {clubs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </StyledSelect>
        </label>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Viser <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{sortedRows.length}</span> af{" "}
        <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{players.length}</span> spillere
        {sortedRows.length > 0 ? (
          clubSortMode ? (
            <span className="text-gray-400">
              {" "}
              · sorteret efter niveau, derefter navn (A–Å)
            </span>
          ) : (
            <span className="text-gray-400">
              {" "}
              · sorteret efter {sortColumnLabel(sortKey)} ({sortDir === "asc" ? "stigende" : "faldende"})
            </span>
          )
        ) : null}
      </p>

      <div className="-mx-1 overflow-x-auto sm:mx-0">
        <div className="inline-block min-w-full rounded-lg border border-lc-border dark:border-gray-700">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-lc-border bg-gray-50/90 dark:border-gray-700 dark:bg-gray-800/50">
                <SortableTh
                  label="Navn"
                  columnKey="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  sortDisabled={clubSortMode}
                />
                <SortableTh
                  label="Hjemmeklub"
                  columnKey="home_club"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  sortDisabled={clubSortMode}
                />
                <SortableTh
                  label="Niveau"
                  columnKey="level"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  sortDisabled={clubSortMode}
                />
                <SortableTh
                  label="Alder"
                  columnKey="age"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  sortDisabled={clubSortMode}
                />
                <SortableTh
                  label="Billet-ID"
                  columnKey="ticket_id"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  sortDisabled={clubSortMode}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-lc-border bg-white dark:divide-gray-700 dark:bg-gray-900/20">
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  Ingen spillere matcher filtrene.
                </td>
              </tr>
            ) : (
              sortedRows.map((p) => {
                const lv = getLevelVisualClasses(p.level);
                return (
                <tr
                  key={p.id}
                  tabIndex={0}
                  role="link"
                  aria-label={`Vis detaljer for ${p.name}`}
                  onClick={() => goToPlayer(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goToPlayer(p.id);
                    }
                  }}
                  className={`cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#14b8a6]/25 dark:focus:ring-teal-500/30 ${lv.row} ${lv.rowHover} ${lv.rowFocus}`}
                >
                  <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">
                    {p.name}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                    {formatCell(p.home_club)}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">
                    <span className={lv.badge}>{formatCell(p.level)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 tabular-nums dark:text-gray-300">
                    {formatCell(p.age)}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                    {formatCell(p.ticket_id)}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
