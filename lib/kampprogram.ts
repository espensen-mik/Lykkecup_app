import type { TeamDetailView } from "@/lib/team-detail";

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
