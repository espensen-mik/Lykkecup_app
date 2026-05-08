"use client";

import { useEffect, useState } from "react";

type BreakdownGroup = {
  key: string;
  label: string;
  sold: number;
};

type BreakdownData = {
  event_id: number;
  total: number;
  groups: BreakdownGroup[];
  updated: string;
};

function formatDaDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

export function LiveTicketBreakdown() {
  const [data, setData] = useState<BreakdownData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/live-tickets", { cache: "no-store" });
        const json = (await res.json()) as BreakdownData | { error?: string };
        if (cancelled) return;
        if (!res.ok || "error" in json) {
          setError((json as { error?: string }).error ?? "Kunne ikke hente billetsalg.");
          return;
        }
        setError(null);
        setData(json as BreakdownData);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Kunne ikke hente billetsalg.");
      }
    }

    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50 to-white px-5 py-4 shadow-sm dark:border-teal-900/50 dark:from-teal-950/40 dark:to-gray-900/35">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Total solgte</p>
          <p className="mt-1 text-3xl font-black tabular-nums text-[#0f766e] dark:text-teal-300">{data?.total ?? "—"}</p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/35">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Event ID</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{data?.event_id ?? "—"}</p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/35">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</p>
          <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {data?.updated ? `Opdateret ${formatDaDateTime(data.updated)}` : "Opdaterer..."}
          </p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-lc-border bg-white shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lc-border bg-gray-50/80 px-5 py-3.5 dark:border-gray-700 dark:bg-gray-800/40">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Billet-typer</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{data?.groups?.length ?? 0} rækker</p>
        </div>

        {data?.groups?.length ? (
          <ul className="divide-y divide-lc-border dark:divide-gray-700">
            {data.groups.map((g) => (
              <li key={g.key} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{g.label}</span>
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-[#0f766e] dark:bg-teal-950/50 dark:text-teal-300">
                  {g.sold}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-sm text-gray-500 dark:text-gray-400">Ingen billetdata endnu.</p>
        )}
      </section>
    </div>
  );
}
