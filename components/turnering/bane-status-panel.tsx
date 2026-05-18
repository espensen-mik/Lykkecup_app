"use client";

import { useMemo } from "react";
import type { BanerTiderBundle, CourtType } from "@/lib/baner-tider";
import { compareCourtTypes } from "@/lib/baner-tider";
import type { PoolDemandSnapshot, RegnemaskineSnapshot } from "@/lib/lykkecup-regnemaskine";

function courtTypeLabel(t: string): string {
  switch (t) {
    case "mini":
      return "Mini";
    case "kort":
      return "Kort";
    case "stor":
      return "Stor";
    default:
      return t;
  }
}

type CourtStatusRow = {
  courtId: string;
  courtName: string;
  venueName: string;
  courtType: CourtType;
  used: number;
  capacity: number;
  free: number;
  isActive: boolean;
};

export function BaneStatusPanel({
  baner,
  snapshot,
  poolDemand,
}: {
  baner: BanerTiderBundle;
  snapshot: RegnemaskineSnapshot | null;
  poolDemand: PoolDemandSnapshot;
}) {
  const venueNameById = useMemo(() => new Map(baner.venues.map((v) => [v.id, v.name])), [baner.venues]);

  const capacityByCourtId = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of snapshot?.courts ?? []) {
      m.set(r.courtId, r.slots);
    }
    return m;
  }, [snapshot?.courts]);

  const courtRows = useMemo((): CourtStatusRow[] => {
    const rows: CourtStatusRow[] = [];
    for (const c of baner.courts) {
      const capacity = capacityByCourtId.get(c.id) ?? 0;
      const used = baner.scheduledSlotsByCourtId[c.id] ?? 0;
      rows.push({
        courtId: c.id,
        courtName: c.name,
        venueName: venueNameById.get(c.venue_id) ?? "—",
        courtType: c.court_type,
        used,
        capacity,
        free: Math.max(0, capacity - used),
        isActive: c.is_active,
      });
    }
    rows.sort(
      (a, b) =>
        a.venueName.localeCompare(b.venueName, "da") ||
        a.courtName.localeCompare(b.courtName, "da", { numeric: true }),
    );
    return rows;
  }, [baner.courts, baner.scheduledSlotsByCourtId, capacityByCourtId, venueNameById]);

  const activeCourts = courtRows.filter((c) => c.isActive);
  const totalCapacity = activeCourts.reduce((s, c) => s + c.capacity, 0);
  const totalUsed = activeCourts.reduce((s, c) => s + c.used, 0);
  const totalFree = Math.max(0, totalCapacity - totalUsed);

  const levelDemandRounds = snapshot?.levels.reduce((s, r) => s + r.requiredRounds, 0) ?? 0;
  const poolTotals = poolDemand.totals;

  return (
    <section className="mt-8 space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Bane status</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Ledige runder pr. bane nu · behov opdateres når du ændrer kampe/hold eller puljer
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Runder kapacitet" value={`${totalCapacity}`} sub="aktive baner" />
        <StatCard label="Brugt" value={`${totalUsed}`} sub={`${totalFree} ledige`} />
        <StatCard
          label="Behov (puljer)"
          value={`${poolTotals.requiredRounds}`}
          sub={`${poolTotals.totalMatches} kampe · ${poolTotals.poolCount} puljer · ${poolTotals.teamCount} hold`}
        />
        <StatCard label="Behov (hold)" value={`${levelDemandRounds}`} sub="alle hold × kampe/hold" />
      </div>

      {activeCourts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Ingen aktive baner.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
          <table className="min-w-[480px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                <th className="px-3 py-2">Bane</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Brugt</th>
                <th className="px-3 py-2">Kapacitet</th>
                <th className="px-3 py-2">Ledige</th>
              </tr>
            </thead>
            <tbody>
              {activeCourts.map((c) => (
                <tr key={c.courtId} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2 text-gray-900 dark:text-white">
                    <span className="font-medium">{c.courtName}</span>
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({c.venueName})</span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{courtTypeLabel(c.courtType)}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">{c.used}</td>
                  <td className="px-3 py-2 tabular-nums text-gray-700 dark:text-gray-300">
                    {c.capacity > 0 ? c.capacity : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 tabular-nums font-medium ${
                      c.capacity === 0
                        ? "text-gray-400 dark:text-gray-500"
                        : c.free === 0
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {c.capacity > 0 ? c.free : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {poolDemand.byCourtType.length > 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Behov fra puljer pr. banetype:{" "}
          {poolDemand.byCourtType
            .map((r) => `${courtTypeLabel(r.courtType)} ${r.totalSlots} runder`)
            .join(" · ")}
          {snapshot?.byCourtType.length ? (
            <>
              {" "}
              — kapacitet:{" "}
              {[...snapshot.byCourtType]
                .sort((a, b) => compareCourtTypes(a.courtType, b.courtType))
                .map((r) => `${courtTypeLabel(r.courtType)} ${r.capacityRounds}`)
                .join(" · ")}
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/40">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>
    </div>
  );
}
