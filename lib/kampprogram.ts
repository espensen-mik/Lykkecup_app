import type { TeamDetailView } from "@/lib/team-detail";
import { compareCourtNamesForSchedule, formatTimeForInput } from "@/lib/baner-tider";

/** Client-safe types for kampprogram (ingen server-imports). */

export type KampprogramMatch = {
  id: string;
  poolId: string;
  teamAId: string;
  teamBId: string;
  /** Pulje eller hold findes ikke længere — typisk efter sletning i Puljer. */
  isOrphan: boolean;
  levelKey: string;
  poolName: string;
  periodName: string | null;
  courtId: string | null;
  courtName: string | null;
  venueName: string | null;
  startTime: string | null;
  endTime: string | null;
  roundIndex: number | null;
  isScheduled: boolean;
};

export type KampprogramCourt = {
  id: string;
  name: string;
  venueName: string | null;
  sortOrder: number;
};

/** Kampe hvis pulje eller hold ikke findes længere (typisk efter sletning i Puljer). */
export function isOrphanKampprogramMatch(
  match: { teamAId: string; teamBId: string; poolId: string },
  teamIds: ReadonlySet<string>,
  poolIds: ReadonlySet<string>,
): boolean {
  return !poolIds.has(match.poolId) || !teamIds.has(match.teamAId) || !teamIds.has(match.teamBId);
}

/** Vis bane med hal/navn, fx «Bane 1 · Boxen». */
export function formatCourtWithVenue(courtName: string, venueName: string | null | undefined): string {
  const venue = venueName?.trim();
  if (venue) return `${courtName} · ${venue}`;
  return courtName;
}

export type KampprogramPeriod = {
  id: string;
  name: string;
};

export type KampprogramRoundGroup = {
  roundNumber: number;
  /** Fx «Runde 1» — samme nummer på tværs af baner ved samme starttid. */
  label: string;
  startTime: string;
  timeLabel: string;
  matches: KampprogramMatch[];
};

/** Gruppér planlagte kampe i kronologiske runder (samme starttid = samme runde). */
export function groupKampprogramByRound(
  matches: readonly KampprogramMatch[],
  sortByTeamDisplayName?: (teamAId: string, teamBId: string) => number,
): KampprogramRoundGroup[] {
  const groups = new Map<string, KampprogramMatch[]>();
  for (const m of matches) {
    if (!m.isScheduled || !m.startTime) continue;
    const list = groups.get(m.startTime) ?? [];
    list.push(m);
    groups.set(m.startTime, list);
  }

  const keys = [...groups.keys()].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const teamSort =
    sortByTeamDisplayName ??
    ((a, b) => a.localeCompare(b, "da"));

  return keys.map((startTime, index) => {
    const roundMatches = [...(groups.get(startTime) ?? [])];
    roundMatches.sort(
      (a, b) =>
        compareCourtNamesForSchedule(a.courtName, b.courtName) || teamSort(a.teamAId, b.teamAId),
    );
    const sample = roundMatches[0];
    const start = formatTimeForInput(sample?.startTime ?? null);
    const end = formatTimeForInput(sample?.endTime ?? null);
    const timeLabel = start && end ? `${start}–${end}` : start ?? "—";
    const roundNumber = index + 1;
    return {
      roundNumber,
      label: `Runde ${roundNumber}`,
      startTime,
      timeLabel,
      matches: roundMatches,
    };
  });
}

export type KampprogramBundle = {
  matches: KampprogramMatch[];
  courts: KampprogramCourt[];
  levels: string[];
  periods: KampprogramPeriod[];
  teamDetails: Record<string, TeamDetailView>;
  stats: {
    total: number;
    scheduled: number;
    unscheduled: number;
    /** Kampe uden gyldig pulje/hold (vises som Ukendt hold). */
    orphanMatches: number;
  };
  error: string | null;
};
