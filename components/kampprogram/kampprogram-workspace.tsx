"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { TeamDetailModal, TeamNameWithHover } from "@/components/teams/team-detail-ui";
import { StyledSelect } from "@/components/ui/styled-select";
import { deleteOrphanMatchesAction } from "@/lib/kampprogram-actions";
import { compareCourtNamesForSchedule, formatTimeForInput } from "@/lib/baner-tider";
import { formatLevelShortLabel } from "@/lib/holddannelse";
import { getLevelVisualClasses } from "@/lib/level-colors";
import { formatCourtWithVenue, type KampprogramBundle, type KampprogramMatch } from "@/lib/kampprogram";
import { kontrolCenterTeamDisplayName, type TeamDetailView } from "@/lib/team-detail";

type ViewMode = "court" | "rounds";

type Props = {
  initial: KampprogramBundle;
};

function fmtTimeRange(start: string | null, end: string | null): string {
  const s = formatTimeForInput(start);
  const e = formatTimeForInput(end);
  if (s && e) return `${s}–${e}`;
  if (s) return s;
  return "—";
}

function roundKey(m: KampprogramMatch): string {
  const t = formatTimeForInput(m.startTime);
  return t || "__unscheduled__";
}

function teamDetailOrFallback(
  teamId: string,
  teamDetails: Record<string, TeamDetailView>,
): TeamDetailView {
  return (
    teamDetails[teamId] ?? {
      teamName: "Ukendt hold",
      nickname: null,
      players: [],
      coaches: [],
    }
  );
}

function MatchTable({
  rows,
  showCourt,
  teamDetails,
  onOpenTeam,
}: {
  rows: KampprogramMatch[];
  showCourt: boolean;
  teamDetails: Record<string, TeamDetailView>;
  onOpenTeam: (teamId: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Ingen kampe i dette udsnit.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/90 text-left text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
            {showCourt ? <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Bane</th> : null}
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Tid</th>
            <th className="min-w-[14rem] px-3 py-2.5 font-semibold uppercase tracking-wide">Kamp</th>
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Niveau</th>
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Pulje</th>
            <th className="px-3 py-2.5 font-semibold uppercase tracking-wide">Periode</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m, index) => {
            const lv = getLevelVisualClasses(m.levelKey);
            const detailA = teamDetailOrFallback(m.teamAId, teamDetails);
            const detailB = teamDetailOrFallback(m.teamBId, teamDetails);
            const zebra =
              index % 2 === 0
                ? "bg-white dark:bg-gray-900/25"
                : "bg-gray-50/95 dark:bg-gray-800/40";
            return (
              <tr key={m.id} className={`border-b border-gray-100 last:border-0 dark:border-gray-800/80 ${zebra}`}>
                {showCourt ? (
                  <td className="px-3 py-3 text-gray-900 dark:text-white">
                    {m.courtName ? (
                      <span className="font-medium">{formatCourtWithVenue(m.courtName, m.venueName)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : null}
                <td className="px-3 py-3 tabular-nums font-medium text-gray-700 dark:text-gray-200">
                  {fmtTimeRange(m.startTime, m.endTime)}
                </td>
                <td className="px-3 py-3">
                  <div className="flex min-w-0 max-w-[22rem] flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:flex-nowrap">
                    <TeamNameWithHover
                      detail={detailA}
                      onOpenDetail={() => onOpenTeam(m.teamAId)}
                      maxWidthClass="max-w-[8.75rem] sm:max-w-[9.5rem]"
                    />
                    <span
                      className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
                      aria-hidden
                    >
                      Vs.
                    </span>
                    <TeamNameWithHover
                      detail={detailB}
                      onOpenDetail={() => onOpenTeam(m.teamBId)}
                      maxWidthClass="max-w-[8.75rem] sm:max-w-[9.5rem]"
                    />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className={lv.badge} title={m.levelKey}>
                    {formatLevelShortLabel(m.levelKey)}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{m.poolName}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{m.periodName ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#14b8a6] dark:text-teal-400">{value}</p>
    </div>
  );
}

export function KampprogramWorkspace({ initial }: Props) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("court");
  const [levelFilter, setLevelFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [hideUnscheduled, setHideUnscheduled] = useState(false);
  const [previewTeamId, setPreviewTeamId] = useState<string | null>(null);
  const [deletingOrphans, setDeletingOrphans] = useState(false);
  const [orphanActionMsg, setOrphanActionMsg] = useState<string | null>(null);

  const teamDetails = initial.teamDetails;
  const orphanMatches = useMemo(() => initial.matches.filter((m) => m.isOrphan), [initial.matches]);
  const unscheduledValidCount = Math.max(0, initial.stats.unscheduled - initial.stats.orphanMatches);

  async function handleDeleteOrphans() {
    if (orphanMatches.length === 0) return;
    const ok = window.confirm(
      `Slet ${orphanMatches.length} forældreløse kampe? De kan ikke bruges (manglende pulje eller hold) og vises som «Ukendt hold».`,
    );
    if (!ok) return;
    setDeletingOrphans(true);
    setOrphanActionMsg(null);
    try {
      const result = await deleteOrphanMatchesAction();
      setOrphanActionMsg(result.message);
      if (result.ok) router.refresh();
    } catch (e) {
      setOrphanActionMsg(e instanceof Error ? e.message : "Kunne ikke slette.");
    } finally {
      setDeletingOrphans(false);
    }
  }

  const sortByDisplayName = useCallback(
    (aId: string, bId: string) =>
      kontrolCenterTeamDisplayName(teamDetailOrFallback(aId, teamDetails)).localeCompare(
        kontrolCenterTeamDisplayName(teamDetailOrFallback(bId, teamDetails)),
        "da",
      ),
    [teamDetails],
  );

  const filtered = useMemo(() => {
    return initial.matches.filter((m) => {
      if (m.isOrphan) return false;
      if (hideUnscheduled && !m.isScheduled) return false;
      if (levelFilter && m.levelKey !== levelFilter) return false;
      if (periodFilter && m.periodName !== periodFilter) return false;
      return true;
    });
  }, [initial.matches, hideUnscheduled, levelFilter, periodFilter]);

  const byCourt = useMemo(() => {
    const map = new Map<string, KampprogramMatch[]>();
    for (const court of initial.courts) map.set(court.id, []);
    const unassigned: KampprogramMatch[] = [];

    for (const m of filtered) {
      if (!m.isScheduled || !m.courtId) {
        unassigned.push(m);
        continue;
      }
      const list = map.get(m.courtId);
      if (list) list.push(m);
      else unassigned.push(m);
    }

    for (const list of map.values()) {
      list.sort((a, b) => {
        const ta = formatTimeForInput(a.startTime) ?? "";
        const tb = formatTimeForInput(b.startTime) ?? "";
        return ta.localeCompare(tb, "da") || sortByDisplayName(a.teamAId, b.teamAId);
      });
    }
    unassigned.sort((a, b) => a.poolName.localeCompare(b.poolName, "da"));

    return { map, unassigned };
  }, [filtered, initial.courts, sortByDisplayName]);

  const byRound = useMemo(() => {
    const groups = new Map<string, KampprogramMatch[]>();
    for (const m of filtered) {
      if (!m.isScheduled) continue;
      const key = roundKey(m);
      const list = groups.get(key) ?? [];
      list.push(m);
      groups.set(key, list);
    }
    const keys = [...groups.keys()].filter((k) => k !== "__unscheduled__").sort((a, b) => a.localeCompare(b, "da"));
    for (const list of groups.values()) {
      list.sort(
        (a, b) =>
          compareCourtNamesForSchedule(a.courtName, b.courtName) ||
          sortByDisplayName(a.teamAId, b.teamAId),
      );
    }
    return { groups, keys };
  }, [filtered, sortByDisplayName]);

  const unscheduledFiltered = useMemo(() => filtered.filter((m) => !m.isScheduled), [filtered]);

  const previewDetail = useMemo(() => {
    if (!previewTeamId) return null;
    const detail = teamDetails[previewTeamId];
    if (!detail) return null;
    return { ...detail, playerCount: detail.players.length };
  }, [previewTeamId, teamDetails]);

  const fieldClass =
    "rounded-md border border-lc-border bg-white px-3.5 py-2.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-100";

  return (
    <div className="space-y-8">
      <div className={`grid gap-4 ${initial.stats.orphanMatches > 0 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Kpi label="Kampe i alt" value={initial.stats.total} />
        <Kpi label="Planlagt" value={initial.stats.scheduled} />
        <Kpi label="Mangler bane/tid" value={unscheduledValidCount} />
        {initial.stats.orphanMatches > 0 ? (
          <Kpi label="Forældreløse" value={initial.stats.orphanMatches} />
        ) : null}
      </div>
      {initial.stats.orphanMatches > 0 ? (
        <section className="rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/25">
          <h2 className="text-base font-semibold text-red-900 dark:text-red-100">Forældreløse kampe</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-red-900/90 dark:text-red-100/90">
            {initial.stats.orphanMatches} kampe peger på en pulje eller hold, der ikke findes længere — typisk fordi
            puljen blev slettet, hold blev flyttet, eller kampe blev genereret før puljen blev ryddet op. De vises som
            «Ukendt hold» og kan ikke planlægges. Du kan slette dem herunder; gyldige kampe påvirkes ikke.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleDeleteOrphans()}
              disabled={deletingOrphans}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-800 shadow-sm hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60"
            >
              {deletingOrphans ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
              Slet {initial.stats.orphanMatches} forældreløse kampe
            </button>
            {orphanActionMsg ? (
              <p className="text-sm text-red-800 dark:text-red-200">{orphanActionMsg}</p>
            ) : null}
          </div>
          <div className="mt-4 max-h-64 overflow-auto rounded-md border border-red-200/80 dark:border-red-900/40">
            <MatchTable
              rows={orphanMatches}
              showCourt={false}
              teamDetails={teamDetails}
              onOpenTeam={setPreviewTeamId}
            />
          </div>
        </section>
      ) : null}


      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="inline-flex rounded-lg border border-lc-border bg-gray-50/80 p-1 dark:border-gray-700 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={() => setView("court")}
            className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
              view === "court"
                ? "bg-white text-[#0f766e] shadow-sm dark:bg-gray-900 dark:text-teal-200"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            Per bane
          </button>
          <button
            type="button"
            onClick={() => setView("rounds")}
            className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
              view === "rounds"
                ? "bg-white text-[#0f766e] shadow-sm dark:bg-gray-900 dark:text-teal-200"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            Kronologisk (runder)
          </button>
        </div>

        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          Niveau
          <StyledSelect value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className={fieldClass}>
            <option value="">Alle niveauer</option>
            {initial.levels.map((l) => (
              <option key={l} value={l}>
                {formatLevelShortLabel(l)}
              </option>
            ))}
          </StyledSelect>
        </label>

        <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          Periode
          <StyledSelect value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} className={fieldClass}>
            <option value="">Alle perioder</option>
            {initial.periods.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </StyledSelect>
        </label>

        <label className="flex items-center gap-2 pb-2.5 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={hideUnscheduled}
            onChange={(e) => setHideUnscheduled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#14b8a6] focus:ring-[#14b8a6]/30"
          />
          Skjul kampe uden bane/tid
        </label>
      </div>

      {initial.stats.total === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Ingen kampe endnu</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Generér kampe under Turneringsplan for hvert niveau. De vises her, når de er oprettet.
          </p>
        </div>
      ) : view === "court" ? (
        <div className="space-y-6">
          {initial.courts.map((court) => {
            const rows = byCourt.map.get(court.id) ?? [];
            if (rows.length === 0 && hideUnscheduled) return null;
            return (
              <section
                key={court.id}
                className="rounded-lg border border-lc-border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50"
              >
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  <span>{court.name}</span>
                  {court.venueName ? (
                    <span className="font-normal text-gray-500 dark:text-gray-400"> · {court.venueName}</span>
                  ) : null}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {rows.length} kamp{rows.length === 1 ? "" : "e"}
                </p>
                <div className="mt-3">
                  <MatchTable
                    rows={rows}
                    showCourt={false}
                    teamDetails={teamDetails}
                    onOpenTeam={setPreviewTeamId}
                  />
                </div>
              </section>
            );
          })}
          {byCourt.unassigned.length > 0 ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100">Ikke planlagt</h2>
              <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/80">
                {byCourt.unassigned.length} kamp{byCourt.unassigned.length === 1 ? "" : "e"} uden bane eller tid
              </p>
              <div className="mt-3">
                <MatchTable
                  rows={byCourt.unassigned}
                  showCourt={false}
                  teamDetails={teamDetails}
                  onOpenTeam={setPreviewTeamId}
                />
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {byRound.keys.length === 0 && hideUnscheduled ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ingen planlagte kampe matcher filtrene.</p>
          ) : (
            byRound.keys.map((key) => {
              const rows = byRound.groups.get(key) ?? [];
              return (
                <section
                  key={key}
                  className="rounded-lg border border-lc-border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/50"
                >
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Runde {key}</h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {rows.length} kamp{rows.length === 1 ? "" : "e"} samtidig på tværs af baner
                  </p>
                  <div className="mt-3">
                    <MatchTable
                      rows={rows}
                      showCourt
                      teamDetails={teamDetails}
                      onOpenTeam={setPreviewTeamId}
                    />
                  </div>
                </section>
              );
            })
          )}
          {!hideUnscheduled && unscheduledFiltered.length > 0 ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100">Ikke planlagt</h2>
              <div className="mt-3">
                <MatchTable
                  rows={unscheduledFiltered}
                  showCourt={false}
                  teamDetails={teamDetails}
                  onOpenTeam={setPreviewTeamId}
                />
              </div>
            </section>
          ) : null}
        </div>
      )}

      <TeamDetailModal
        open={Boolean(previewDetail)}
        onClose={() => setPreviewTeamId(null)}
        detail={previewDetail ?? { teamName: "", nickname: null, players: [], coaches: [] }}
        playerCount={previewDetail?.playerCount ?? 0}
      />
    </div>
  );
}
