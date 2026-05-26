import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import { isOrphanKampprogramMatch } from "@/lib/kampprogram";
import { resolvePlanMatchesPerTeam } from "@/lib/lykkecup-regnemaskine";
import type { TurneringsplanMatchStatus } from "@/lib/turneringsplan-status";

export type TeamMatchCountStatus = "ok" | "under" | "over" | "no-plan";

export type TeamMatchCountRow = {
  teamId: string;
  teamName: string;
  levelKey: string;
  actual: number;
  planned: number | null;
  status: TeamMatchCountStatus;
};

export type KampprogramSchedulingSummary = {
  outsidePoolPeriod: number;
  relaxedTeamRest: number;
  teamsWithPlan: number;
  teamsMatchOk: number;
  teamsWrongCount: number;
  teamRows: TeamMatchCountRow[];
};

type MatchForSummary = {
  id: string;
  pool_id: string;
  team_a_id: string;
  team_b_id: string;
  schedule_relaxed_team_rest?: boolean;
};

type TeamForSummary = {
  id: string;
  name: string;
  level: string | null;
};

export function computeTeamMatchCounts(input: {
  teams: readonly TeamForSummary[];
  matches: readonly MatchForSummary[];
  teamIds: ReadonlySet<string>;
  poolIds: ReadonlySet<string>;
  planMatchesByLevel: Record<string, number>;
  scheduleRows?: readonly { level: string; plan_matches_per_team: number | null }[];
}): Pick<KampprogramSchedulingSummary, "teamsWithPlan" | "teamsMatchOk" | "teamsWrongCount" | "teamRows"> {
  const teamMatchCount = new Map<string, number>();
  for (const m of input.matches) {
    if (
      isOrphanKampprogramMatch(
        { teamAId: m.team_a_id, teamBId: m.team_b_id, poolId: m.pool_id },
        input.teamIds,
        input.poolIds,
      )
    ) {
      continue;
    }
    teamMatchCount.set(m.team_a_id, (teamMatchCount.get(m.team_a_id) ?? 0) + 1);
    teamMatchCount.set(m.team_b_id, (teamMatchCount.get(m.team_b_id) ?? 0) + 1);
  }

  const teamRows: TeamMatchCountRow[] = [];
  let teamsWithPlan = 0;
  let teamsMatchOk = 0;

  for (const team of input.teams) {
    const levelKey = canonicalBanerLevelLabel(team.level);
    const planned = resolvePlanMatchesPerTeam(team.level, input.planMatchesByLevel, input.scheduleRows);
    const actual = teamMatchCount.get(team.id) ?? 0;

    if (planned == null) {
      teamRows.push({
        teamId: team.id,
        teamName: team.name,
        levelKey,
        actual,
        planned: null,
        status: "no-plan",
      });
      continue;
    }

    teamsWithPlan += 1;
    let status: TeamMatchCountStatus = "ok";
    if (actual < planned) status = "under";
    else if (actual > planned) status = "over";

    if (status === "ok") teamsMatchOk += 1;
    else {
      teamRows.push({
        teamId: team.id,
        teamName: team.name,
        levelKey,
        actual,
        planned,
        status,
      });
    }
  }

  teamRows.sort(
    (a, b) =>
      a.levelKey.localeCompare(b.levelKey, "da", { sensitivity: "base" }) ||
      a.teamName.localeCompare(b.teamName, "da", { sensitivity: "base" }),
  );

  return {
    teamsWithPlan,
    teamsMatchOk,
    teamsWrongCount: teamRows.filter((r) => r.status !== "no-plan").length,
    teamRows,
  };
}

export function countRelaxedTeamRestMatches(
  matches: readonly { schedule_relaxed_team_rest?: boolean }[],
): number {
  return matches.filter((m) => m.schedule_relaxed_team_rest).length;
}

export type SchedulingSummaryBannerMetrics = {
  generated: number;
  scheduled: number;
  unscheduled: number;
  orphanMatches: number;
  outsidePoolPeriod: number;
  teamsWithPlan: number;
  teamsMatchOk: number;
  teamsWrongCount: number;
  courtConflicts: number;
  teamRestWarnings: number;
  relaxedTeamRest: number;
};

export function buildSchedulingSummaryBannerMetrics(
  kampSummary: KampprogramSchedulingSummary,
  matchStatus: TurneringsplanMatchStatus | null | undefined,
  stats: { total: number; scheduled: number; unscheduled: number; orphanMatches: number },
): SchedulingSummaryBannerMetrics {
  const m = matchStatus?.metrics;
  return {
    generated: m?.generatedMatches ?? stats.total - stats.orphanMatches,
    scheduled: m?.scheduledMatches ?? stats.scheduled,
    unscheduled: m?.unscheduledMatches ?? Math.max(0, stats.unscheduled - stats.orphanMatches),
    orphanMatches: m?.orphanMatches ?? stats.orphanMatches,
    outsidePoolPeriod: kampSummary.outsidePoolPeriod,
    teamsWithPlan: kampSummary.teamsWithPlan,
    teamsMatchOk: kampSummary.teamsMatchOk,
    teamsWrongCount: kampSummary.teamsWrongCount,
    courtConflicts: m?.courtConflicts ?? 0,
    teamRestWarnings: m?.teamRestWarnings ?? 0,
    relaxedTeamRest: kampSummary.relaxedTeamRest || (m?.relaxedRestMatches ?? 0),
  };
}
