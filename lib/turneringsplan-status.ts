import { timeToMinutes } from "@/lib/baner-tider";
import {
  canonicalBanerLevelLabel,
  mergeTurneringLevelDisplayLabel,
  sortLevelKeysForNav,
  turneringLevelMergeKey,
} from "@/lib/holddannelse";
import { isOrphanKampprogramMatch } from "@/lib/kampprogram";
import type { CheckStatus, LykkecupCheckResult } from "@/lib/lykkecup-check";
import { findLevelScheduleRow, poolPlanningHint } from "@/lib/puljer";
import { resolvePlanMatchesPerTeam, roundLengthMinutes, type RoundTiming } from "@/lib/lykkecup-regnemaskine";
import { plannedPoolMatchCount } from "@/lib/turnering";
import { teamRestMinutesBetweenMatches, teamRestViolatingTeamIdsByMatchId } from "@/lib/turnering-scheduler";

const MAX_ISSUES = 12;

export type TurneringsplanStatusMatch = {
  id: string;
  pool_id: string;
  team_a_id: string;
  team_b_id: string;
  court_id: string | null;
  start_time: string | null;
  end_time: string | null;
  schedule_relaxed_team_rest?: boolean;
};

export type TurneringsplanStatusInput = {
  teams: { id: string; name: string; level: string | null; pool_id: string | null }[];
  pools: { id: string; name: string; level: string | null }[];
  matches: TurneringsplanStatusMatch[];
  planMatchesByLevel: Record<string, number>;
  scheduleRows: Array<{
    level: string;
    plan_matches_per_team: number | null;
    match_duration_minutes?: number | null;
    break_between_matches_minutes?: number | null;
  }>;
  courtNamesById: Record<string, string>;
  teamNamesById: Record<string, string>;
  /** Optional: pool_id → period_id mapping. Used for the teams-spanning-periods check. */
  poolPeriodIds?: Record<string, string | null>;
};

export type TurneringsplanStatusIssueGroup = {
  id: string;
  title: string;
  status: CheckStatus;
  count: number;
  items: string[];
};

export type TurneringsplanLevelBreakdown = {
  levelKey: string;
  expected: number;
  generated: number;
  scheduled: number;
  unscheduled: number;
};

export type TurneringsplanMatchStatus = {
  ranAt: string;
  overallStatus: CheckStatus;
  metrics: {
    expectedMatches: number;
    generatedMatches: number;
    scheduledMatches: number;
    unscheduledMatches: number;
    orphanMatches: number;
    poolsOutOfSync: number;
    courtConflicts: number;
    teamRestWarnings: number;
    relaxedRestMatches: number;
    teamsSpanningPeriods: number;
  };
  issueGroups: TurneringsplanStatusIssueGroup[];
  levelBreakdown: TurneringsplanLevelBreakdown[];
};

function truncate(items: string[]): string[] {
  if (items.length <= MAX_ISSUES) return items;
  return [...items.slice(0, MAX_ISSUES), `… og ${items.length - MAX_ISSUES} mere`];
}

function timingForLevel(
  levelKey: string,
  scheduleRows: TurneringsplanStatusInput["scheduleRows"],
): RoundTiming {
  const row = findLevelScheduleRow(levelKey, scheduleRows);
  return {
    matchDurationMinutes: row?.match_duration_minutes ?? 9,
    breakBetweenMatchesMinutes: row?.break_between_matches_minutes ?? 1,
  };
}

function overlaps(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1;
}

export function findCourtOverlapIssues(
  matches: readonly TurneringsplanStatusMatch[],
  courtNamesById: Record<string, string>,
  teamNamesById: Record<string, string>,
): string[] {
  const byCourt = new Map<string, Array<{ id: string; start: number; end: number; label: string }>>();

  for (const m of matches) {
    if (!m.court_id || !m.start_time || !m.end_time) continue;
    const start = timeToMinutes(m.start_time);
    const end = timeToMinutes(m.end_time);
    if (start == null || end == null || end <= start) continue;
    const label = `${teamNamesById[m.team_a_id] ?? "Hold"} vs ${teamNamesById[m.team_b_id] ?? "Hold"}`;
    const list = byCourt.get(m.court_id) ?? [];
    list.push({ id: m.id, start, end, label });
    byCourt.set(m.court_id, list);
  }

  const issues: string[] = [];
  for (const [courtId, rows] of byCourt) {
    const sorted = [...rows].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      if (!overlaps(prev.start, prev.end, cur.start, cur.end)) continue;
      const courtName = courtNamesById[courtId] ?? "Bane";
      issues.push(`${courtName}: ${prev.label} overlapper med ${cur.label}`);
    }
  }
  return issues;
}

export function findTeamRestIssues(input: TurneringsplanStatusInput): {
  issues: string[];
  relaxedCount: number;
} {
  const poolLevel = new Map(input.pools.map((p) => [p.id, canonicalBanerLevelLabel(p.level)]));
  const teamLevel = new Map(input.teams.map((t) => [t.id, canonicalBanerLevelLabel(t.level)]));
  const byLevel = new Map<string, TurneringsplanStatusMatch[]>();

  let relaxedCount = 0;
  for (const m of input.matches) {
    if (m.schedule_relaxed_team_rest) relaxedCount += 1;
    const levelKey =
      poolLevel.get(m.pool_id) ?? teamLevel.get(m.team_a_id) ?? teamLevel.get(m.team_b_id) ?? "Ukendt niveau";
    const list = byLevel.get(levelKey) ?? [];
    list.push(m);
    byLevel.set(levelKey, list);
  }

  const issues: string[] = [];
  for (const [levelKey, levelMatches] of byLevel) {
    const rest = teamRestMinutesBetweenMatches(roundLengthMinutes(timingForLevel(levelKey, input.scheduleRows)));
    const violations = teamRestViolatingTeamIdsByMatchId(levelMatches, rest);
    for (const [matchId, teamIds] of violations) {
      const match = levelMatches.find((m) => m.id === matchId);
      if (!match) continue;
      const names = teamIds.map((id) => input.teamNamesById[id] ?? "Hold").join(", ");
      const a = input.teamNamesById[match.team_a_id] ?? "Hold";
      const b = input.teamNamesById[match.team_b_id] ?? "Hold";
      issues.push(`${levelKey}: ${a} vs ${b} — ${names} mangler pause (min. ${rest} min)`);
    }
  }

  return { issues, relaxedCount };
}

/**
 * Find teams whose scheduled matches span more than one non-all-day period,
 * i.e. a team has matches in both Formiddag and Eftermiddag.
 * Returns a list of display strings (one per team) and the count.
 */
export function findTeamsSpanningPeriods(
  matches: readonly TurneringsplanStatusMatch[],
  poolPeriodIds: Record<string, string | null>,
  teamNamesById: Record<string, string>,
): string[] {
  const teamPeriods = new Map<string, Set<string>>();

  for (const m of matches) {
    if (!m.court_id || !m.start_time) continue;
    const periodId = poolPeriodIds[m.pool_id];
    if (!periodId) continue;

    for (const teamId of [m.team_a_id, m.team_b_id]) {
      const set = teamPeriods.get(teamId) ?? new Set<string>();
      set.add(periodId);
      teamPeriods.set(teamId, set);
    }
  }

  const issues: string[] = [];
  for (const [teamId, periods] of teamPeriods) {
    if (periods.size > 1) {
      issues.push(teamNamesById[teamId] ?? teamId);
    }
  }
  issues.sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
  return issues;
}

function computeLevelBreakdown(input: TurneringsplanStatusInput): TurneringsplanLevelBreakdown[] {
  const teamIds = new Set(input.teams.map((t) => t.id));
  const poolIds = new Set(input.pools.map((p) => p.id));
  const teamsByPool = new Map<string, typeof input.teams>();
  for (const p of input.pools) teamsByPool.set(p.id, []);
  for (const t of input.teams) {
    if (!t.pool_id) continue;
    const list = teamsByPool.get(t.pool_id);
    if (list) list.push(t);
  }

  const matchesByPool = new Map<string, TurneringsplanStatusMatch[]>();
  for (const m of input.matches) {
    const list = matchesByPool.get(m.pool_id) ?? [];
    list.push(m);
    matchesByPool.set(m.pool_id, list);
  }

  const levelAgg = new Map<string, TurneringsplanLevelBreakdown>();

  const ensure = (levelRaw: string | null | undefined) => {
    const mergeKey = turneringLevelMergeKey(levelRaw);
    const prev = levelAgg.get(mergeKey);
    if (prev) {
      prev.levelKey = mergeTurneringLevelDisplayLabel(prev.levelKey, levelRaw);
      return prev;
    }
    const row: TurneringsplanLevelBreakdown = {
      levelKey: canonicalBanerLevelLabel(levelRaw),
      expected: 0,
      generated: 0,
      scheduled: 0,
      unscheduled: 0,
    };
    levelAgg.set(mergeKey, row);
    return row;
  };

  for (const pool of input.pools) {
    const row = ensure(pool.level);
    const teams = teamsByPool.get(pool.id) ?? [];
    const planPerTeam =
      resolvePlanMatchesPerTeam(row.levelKey, input.planMatchesByLevel, input.scheduleRows) ??
      poolPlanningHint(row.levelKey, input.scheduleRows).matchesPerTeam;
    row.expected += plannedPoolMatchCount(teams.length, planPerTeam);

    for (const m of matchesByPool.get(pool.id) ?? []) {
      if (isOrphanKampprogramMatch({ teamAId: m.team_a_id, teamBId: m.team_b_id, poolId: m.pool_id }, teamIds, poolIds)) {
        continue;
      }
      row.generated += 1;
      if (m.court_id && m.start_time) row.scheduled += 1;
      else row.unscheduled += 1;
    }
  }

  const rows = [...levelAgg.values()];
  const order = sortLevelKeysForNav(rows.map((r) => r.levelKey));
  return order.map((key) => rows.find((r) => r.levelKey === key)!);
}

function itemFromCheck(result: LykkecupCheckResult, id: string): LykkecupCheckResult["items"][0] | undefined {
  return result.items.find((i) => i.id === id);
}

export function computeTurneringsplanMatchStatus(
  input: TurneringsplanStatusInput,
  check: LykkecupCheckResult,
): TurneringsplanMatchStatus {
  const ranAt = check.ranAt;
  const teamIds = new Set(input.teams.map((t) => t.id));
  const poolIds = new Set(input.pools.map((p) => p.id));

  let generatedMatches = 0;
  let scheduledMatches = 0;
  let unscheduledMatches = 0;
  let orphanMatches = 0;

  for (const m of input.matches) {
    if (isOrphanKampprogramMatch({ teamAId: m.team_a_id, teamBId: m.team_b_id, poolId: m.pool_id }, teamIds, poolIds)) {
      orphanMatches += 1;
      continue;
    }
    generatedMatches += 1;
    if (m.court_id && m.start_time) scheduledMatches += 1;
    else unscheduledMatches += 1;
  }

  const levelBreakdown = computeLevelBreakdown(input);
  const expectedMatches = levelBreakdown.reduce((s, r) => s + r.expected, 0);

  const poolSync = itemFromCheck(check, "pool-match-sync");
  const poolsOutOfSync = typeof poolSync?.metrics.find((m) => m.label === "Problemer")?.value === "number"
    ? (poolSync.metrics.find((m) => m.label === "Problemer")!.value as number)
    : (poolSync?.issues.length ?? 0);

  const courtOverlapIssues = findCourtOverlapIssues(input.matches, input.courtNamesById, input.teamNamesById);
  const { issues: teamRestIssues, relaxedCount } = findTeamRestIssues(input);
  const spanningIssues = input.poolPeriodIds
    ? findTeamsSpanningPeriods(input.matches, input.poolPeriodIds, input.teamNamesById)
    : [];

  const issueGroups: TurneringsplanStatusIssueGroup[] = [];

  if (generatedMatches !== expectedMatches) {
    issueGroups.push({
      id: "match-totals",
      title: "Kampantal afviger",
      status: "error",
      count: 1,
      items: truncate([
        `Forventet ${expectedMatches} kampe ud fra puljer og Opsætning → Kampe, men ${generatedMatches} gyldige kampe er genereret`,
      ]),
    });
  }

  if (unscheduledMatches > 0) {
    issueGroups.push({
      id: "unscheduled",
      title: "Mangler bane eller tid",
      status: "warn",
      count: unscheduledMatches,
      items: truncate([
        `${unscheduledMatches} kamp(e) har ikke bane og starttid — åbn niveauet under Turneringsplan og brug «Planlæg»`,
      ]),
    });
  }

  if (poolSync && poolSync.issues.length > 0) {
    issueGroups.push({
      id: "pool-sync",
      title: "Puljer ikke synkroniseret",
      status: poolSync.status,
      count: poolSync.issueCount,
      items: truncate(poolSync.issues),
    });
  }

  if (courtOverlapIssues.length > 0) {
    issueGroups.push({
      id: "court-overlap",
      title: "Bane-konflikter",
      status: "error",
      count: courtOverlapIssues.length,
      items: truncate(courtOverlapIssues),
    });
  }

  if (teamRestIssues.length > 0) {
    issueGroups.push({
      id: "team-rest",
      title: "Hold-pause ikke overholdt",
      status: "warn",
      count: teamRestIssues.length,
      items: truncate(teamRestIssues),
    });
  }

  if (relaxedCount > 0) {
    issueGroups.push({
      id: "relaxed-rest",
      title: "Planlagt uden fuld hold-pause",
      status: "warn",
      count: relaxedCount,
      items: truncate([
        `${relaxedCount} kamp(e) er markeret med rød note (planlagt med lempet hold-pause)`,
      ]),
    });
  }

  if (spanningIssues.length > 0) {
    issueGroups.push({
      id: "spanning-periods",
      title: "Hold spænder over flere perioder",
      status: "warn",
      count: spanningIssues.length,
      items: truncate(spanningIssues),
    });
  }

  if (orphanMatches > 0) {
    issueGroups.push({
      id: "orphans",
      title: "Forældreløse kampe",
      status: "error",
      count: orphanMatches,
      items: truncate([`${orphanMatches} kamp(e) peger på slettede hold eller puljer`]),
    });
  }

  const orphanItem = itemFromCheck(check, "orphan-matches");
  if (orphanItem && orphanItem.issues.length > 0 && orphanMatches === 0) {
    issueGroups.push({
      id: "orphans",
      title: orphanItem.title,
      status: orphanItem.status,
      count: orphanItem.issueCount,
      items: truncate(orphanItem.issues),
    });
  }

  let overallStatus: CheckStatus = "ok";
  for (const g of issueGroups) {
    if (g.status === "error") {
      overallStatus = "error";
      break;
    }
    if (g.status === "warn") overallStatus = "warn";
  }
  if (generatedMatches === 0 && expectedMatches > 0) overallStatus = "warn";

  return {
    ranAt,
    overallStatus,
    metrics: {
      expectedMatches,
      generatedMatches,
      scheduledMatches,
      unscheduledMatches,
      orphanMatches,
      poolsOutOfSync,
      courtConflicts: courtOverlapIssues.length,
      teamRestWarnings: teamRestIssues.length,
      relaxedRestMatches: relaxedCount,
      teamsSpanningPeriods: spanningIssues.length,
    },
    issueGroups,
    levelBreakdown,
  };
}
