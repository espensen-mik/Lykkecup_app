"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { StyledSelect } from "@/components/ui/styled-select";
import type { Coach } from "@/types/coach";
import { useCoachModal } from "@/components/coach-modal-context";

type Props = {
  coaches: Coach[];
  fetchError: string | null;
};

type SortKey = "name" | "home_club" | "age";
type SortDir = "asc" | "desc";

function formatCell(value: string | number | null): string {
  if (value === null || value === "") return "—";
  return String(value);
}

function emptySort(v: string | null | undefined): string {
  if (v == null || v.trim() === "") return "\uffff";
  return v;
}

function compareCoaches(a: Coach, b: Coach, key: SortKey, dir: SortDir): number {
  const mul = dir === "asc" ? 1 : -1;
  switch (key) {
    case "name":
      return mul * a.name.localeCompare(b.name, "da");
    case "home_club":
      return mul * emptySort(a.home_club).localeCompare(emptySort(b.home_club), "da");
    case "age": {
      const av = a.age;
      const bv = b.age;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return mul * (av - bv);
    }
    default:
      return 0;
  }
}

function sortLabel(key: SortKey): string {
  if (key === "name") return "navn";
  if (key === "home_club") return "klub";
  return "alder";
}

const tshirtSizeOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"] as const;
type TShirtSize = (typeof tshirtSizeOrder)[number];

function canonicalTshirtSize(v: string | null | undefined): TShirtSize | null {
  if (!v) return null;
  const n = v.trim().toUpperCase();
  if (!n) return null;

  if (n.includes("4XL")) return "4XL";
  if (n.includes("3XL")) return "3XL";
  if (n.includes("2XL") || n.includes("XXL")) return "2XL";
  if (n.includes("XL")) return "XL";
  if (n.includes("XS")) return "XS";

  const firstToken = n.split(/\s|\(/)[0];
  if (firstToken === "S") return "S";
  if (firstToken === "M") return "M";
  if (firstToken === "L") return "L";

  return null;
}

function tshirtRank(size: string | null | undefined): number {
  if (!size) return 999;
  const idx = tshirtSizeOrder.indexOf(size as TShirtSize);
  return idx === -1 ? 999 : idx;
}

function tshirtPillClasses(size: string): string {
  const n = size;
  switch (n) {
    case "XS":
      return "border-fuchsia-200 bg-fuchsia-100 text-fuchsia-800 dark:border-fuchsia-800/50 dark:bg-fuchsia-950/40 dark:text-fuchsia-200";
    case "S":
      return "border-sky-200 bg-sky-100 text-sky-800 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200";
    case "M":
      return "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "L":
      return "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-200";
    case "XL":
      return "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200";
    case "2XL":
      return "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200";
    case "3XL":
      return "border-cyan-200 bg-cyan-100 text-cyan-800 dark:border-cyan-800/50 dark:bg-cyan-950/40 dark:text-cyan-200";
    case "4XL":
      return "border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-800/50 dark:bg-indigo-950/40 dark:text-indigo-200";
    default:
      return "border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-200";
  }
}

function SortableTh({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  columnKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === columnKey;
  return (
    <th scope="col" className="px-5 py-3 text-left align-bottom">
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`group inline-flex items-center gap-1.5 rounded-md text-left text-[0.6875rem] font-semibold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6]/35 ${
          active ? "text-[#0f766e] dark:text-teal-400" : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        }`}
      >
        <span>{label}</span>
        <span
          className={`inline-flex h-4 w-4 items-center justify-center ${
            active ? "opacity-100" : "text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-600"
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
      </button>
    </th>
  );
}

export function TrainersAdmin({ coaches, fetchError }: Props) {
  const [search, setSearch] = useState("");
  const [club, setClub] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { openCoach } = useCoachModal();

  const clubs = useMemo(() => {
    const set = new Set<string>();
    for (const c of coaches) {
      const val = c.home_club?.trim();
      if (val) set.add(val);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "da"));
  }, [coaches]);

  const tshirtCounts = useMemo(() => {
    const map = new Map<TShirtSize, number>();
    for (const c of coaches) {
      const n = canonicalTshirtSize(c.tshirt_size);
      if (!n) continue;
      map.set(n, (map.get(n) ?? 0) + 1);
    }
    const ordered: [TShirtSize, number][] = [];
    for (const size of tshirtSizeOrder) {
      const count = map.get(size);
      if (count != null) ordered.push([size, count]);
    }
    return ordered;
  }, [coaches]);

  const avgAge = useMemo(() => {
    const ages: number[] = [];
    for (const c of coaches) {
      if (c.age == null) continue;
      if (Number.isFinite(c.age)) ages.push(c.age);
    }
    if (ages.length === 0) return null;
    return Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10;
  }, [coaches]);

  const avgAgeText = useMemo(() => {
    if (avgAge == null) return "Gns. alder: —";
    return `Gns. alder: ${avgAge} år`;
  }, [avgAge]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return coaches.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (club && (c.home_club ?? "") !== club) return false;
      return true;
    });
  }, [coaches, search, club]);

  const sortedRows = useMemo(
    () => [...filtered].sort((a, b) => compareCoaches(a, b, sortKey, sortDir)),
    [filtered, sortKey, sortDir],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (fetchError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
        Kunne ikke indlæse trænere: {fetchError}
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

      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Der er{" "}
          <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{coaches.length}</span> trænere ·{" "}
          {avgAgeText}
        </p>
        <div className="flex flex-wrap gap-2">
          {tshirtCounts.length === 0 ? (
            <span className="rounded-full border border-lc-border bg-white px-2 py-1 text-[0.72rem] font-medium text-gray-500 dark:text-gray-400">
              T-shirt: —
            </span>
          ) : (
            tshirtCounts.map(([size, count]) => (
              <span
                key={size}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[0.72rem] font-semibold ${tshirtPillClasses(
                  size,
                )}`}
                title={`${size}: ${count}`}
              >
                {size}
                <span className="tabular-nums">{count}</span>
              </span>
            ))
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Viser <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{sortedRows.length}</span> af{" "}
        <span className="tabular-nums font-medium text-gray-700 dark:text-gray-300">{coaches.length}</span> trænere
        {sortedRows.length > 0 ? (
          <span className="text-gray-400">
            {" "}
            · sorteret efter {sortLabel(sortKey)} ({sortDir === "asc" ? "stigende" : "faldende"})
          </span>
        ) : null}
      </p>

      <div className="-mx-1 overflow-x-auto sm:mx-0">
        <div className="inline-block min-w-full rounded-lg border border-lc-border dark:border-gray-700">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-lc-border bg-gray-50/90 dark:border-gray-700 dark:bg-gray-800/50">
                <SortableTh label="Navn" columnKey="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Klub" columnKey="home_club" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Alder" columnKey="age" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500">
                  T-shirt
                </th>
                <th scope="col" className="px-5 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500">
                  Billet-id
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lc-border bg-white dark:divide-gray-700 dark:bg-gray-900/20">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    Ingen trænere matcher filtrene.
                  </td>
                </tr>
              ) : (
                sortedRows.map((c) => (
                  <tr
                    key={c.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Vis detaljer for ${c.name}`}
                    onClick={() => openCoach(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openCoach(c.id);
                      }
                    }}
                    className="cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#14b8a6]/25 odd:bg-white even:bg-gray-50/35 dark:odd:bg-gray-900/20 dark:even:bg-gray-900/35"
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{c.name}</td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{formatCell(c.home_club)}</td>
                    <td className="px-5 py-3.5 tabular-nums text-gray-600 dark:text-gray-300">{formatCell(c.age)}</td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{formatCell(c.tshirt_size)}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-500 dark:text-gray-400">{formatCell(c.ticket_id)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
