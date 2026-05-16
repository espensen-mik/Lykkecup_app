import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import { isOrphanKampprogramMatch } from "@/lib/kampprogram";
import { poolPlanningHint, POOL_MAX_TEAMS, roundRobinMatchesPerTeam } from "@/lib/puljer";
import { resolvePlanMatchesPerTeam } from "@/lib/lykkecup-regnemaskine";
import { analyzePoolMatchSync, plannedPoolMatchCount } from "@/lib/turnering";

export type CheckStatus = "ok" | "warn" | "error";

export type LykkecupCheckMetric = {
  label: string;
  value: string | number;
};

export type LykkecupCheckItem = {
  id: string;
  title: string;
  description: string;
  status: CheckStatus;
  ok: boolean;
  metrics: LykkecupCheckMetric[];
  issues: string[];
  issueCount: number;
};

export type LykkecupCheckResult = {
  ranAt: string;
  overallOk: boolean;
  summary: { ok: number; warn: number; error: number; total: number };
  items: LykkecupCheckItem[];
};

export type LykkecupCheckInput = {
  players: { id: string; name: string; level: string | null }[];
  teams: { id: string; name: string; level: string | null; pool_id: string | null; sort_order: number }[];
  pools: { id: string; name: string; level: string | null }[];
  members: { player_id: string; team_id: string }[];
  matches: {
    id: string;
    pool_id: string;
    team_a_id: string;
    team_b_id: string;
    court_id: string | null;
    start_time: string | null;
  }[];
  planMatchesByLevel: Record<string, number>;
  scheduleRows: { level: string; plan_matches_per_team: number | null }[];
};

const MAX_ISSUES_SHOWN = 10;

function finalizeItem(
  base: Omit<LykkecupCheckItem, "ok" | "status" | "issueCount">,
  severity: "warn" | "error" = "error",
): LykkecupCheckItem {
  const issueCount = base.issues.length;
  if (issueCount === 0) {
    return { ...base, issueCount: 0, status: "ok", ok: true };
  }
  return { ...base, issueCount, status: severity, ok: false };
}

function truncateIssues(issues: string[]): string[] {
  if (issues.length <= MAX_ISSUES_SHOWN) return issues;
  return [...issues.slice(0, MAX_ISSUES_SHOWN), `… og ${issues.length - MAX_ISSUES_SHOWN} mere`];
}

export function runLykkecupCheck(input: LykkecupCheckInput): LykkecupCheckResult {
  const ranAt = new Date().toISOString();
  const teamById = new Map(input.teams.map((t) => [t.id, t]));
  const poolById = new Map(input.pools.map((p) => [p.id, p]));
  const teamIds = new Set(input.teams.map((t) => t.id));
  const poolIds = new Set(input.pools.map((p) => p.id));

  const membersByPlayer = new Map<string, string[]>();
  for (const m of input.members) {
    const list = membersByPlayer.get(m.player_id) ?? [];
    list.push(m.team_id);
    membersByPlayer.set(m.player_id, list);
  }

  const playersWithoutTeam: string[] = [];
  const playersMultiTeam: string[] = [];
  for (const p of input.players) {
    const teams = membersByPlayer.get(p.id) ?? [];
    if (teams.length === 0) playersWithoutTeam.push(p.name);
    else if (teams.length > 1) playersMultiTeam.push(p.name);
  }

  const checkPlayersOnTeams = finalizeItem({
    id: "players-on-teams",
    title: "Spillere på hold",
    description: "Hver spiller skal være på præcis ét hold i arrangementet.",
    metrics: [
      { label: "Spillere i alt", value: input.players.length },
      { label: "På hold", value: input.players.length - playersWithoutTeam.length },
      { label: "Uden hold", value: playersWithoutTeam.length },
      { label: "Flere hold", value: playersMultiTeam.length },
    ],
    issues: [
      ...playersWithoutTeam.map((n) => `${n} — ikke på noget hold`),
      ...playersMultiTeam.map((n) => `${n} — på flere hold`),
    ],
  });

  const teamMatchCount = new Map<string, number>();
  for (const m of input.matches) {
    if (
      isOrphanKampprogramMatch(
        { teamAId: m.team_a_id, teamBId: m.team_b_id, poolId: m.pool_id },
        teamIds,
        poolIds,
      )
    ) {
      continue;
    }
    teamMatchCount.set(m.team_a_id, (teamMatchCount.get(m.team_a_id) ?? 0) + 1);
    teamMatchCount.set(m.team_b_id, (teamMatchCount.get(m.team_b_id) ?? 0) + 1);
  }

  const teamsWrongMatchCount: string[] = [];
  const teamsNoPlanSetting: string[] = [];
  let teamsWithExpected = 0;
  let teamsMatchOk = 0;

  for (const team of input.teams) {
    const expected = resolvePlanMatchesPerTeam(team.level, input.planMatchesByLevel);
    const actual = teamMatchCount.get(team.id) ?? 0;
    if (expected == null) {
      teamsNoPlanSetting.push(team.name);
      continue;
    }
    teamsWithExpected += 1;
    if (actual === expected) teamsMatchOk += 1;
    else teamsWrongMatchCount.push(`${team.name}: ${actual} kampe (forventet ${expected})`);
  }

  const checkTeamMatchCount = finalizeItem(
    {
      id: "team-match-count",
      title: "Kampe pr. hold",
      description:
        "Hvert hold skal have det aftalte antal kampe fra Opsætning → Kampe (plan_matches_per_team pr. niveau).",
      metrics: [
        { label: "Hold med mål", value: teamsWithExpected },
        { label: "Korrekt antal", value: teamsMatchOk },
        { label: "Afvigelse", value: teamsWrongMatchCount.length },
        { label: "Mangler niveau-indstilling", value: teamsNoPlanSetting.length },
      ],
      issues: [
        ...teamsWrongMatchCount,
        ...teamsNoPlanSetting.map((n) => `${n} — niveau mangler kampe-indstilling i Opsætning`),
      ],
    },
    teamsNoPlanSetting.length > 0 && teamsWrongMatchCount.length === 0 ? "warn" : "error",
  );

  const playersWrongMatches: string[] = [];
  let playersChecked = 0;
  let playersMatchOk = 0;

  for (const p of input.players) {
    const teamLinks = membersByPlayer.get(p.id) ?? [];
    if (teamLinks.length !== 1) continue;
    const team = teamById.get(teamLinks[0]!);
    if (!team) continue;
    const expected = resolvePlanMatchesPerTeam(team.level, input.planMatchesByLevel);
    if (expected == null) continue;
    playersChecked += 1;
    const actual = teamMatchCount.get(team.id) ?? 0;
    if (actual === expected) playersMatchOk += 1;
    else playersWrongMatches.push(`${p.name}: ${actual} kampe (forventet ${expected})`);
  }

  const checkPlayerMatchCount = finalizeItem({
    id: "player-match-count",
    title: "Kampe pr. spiller",
    description: "Spillere arver antal kampe fra deres hold — skal matche niveauets mål.",
    metrics: [
      { label: "Spillere tjekket", value: playersChecked },
      { label: "Korrekt antal", value: playersMatchOk },
      { label: "Afvigelse", value: playersWrongMatches.length },
    ],
    issues: playersWrongMatches,
  });

  const teamsWithoutPool: string[] = [];
  const teamsInvalidPool: string[] = [];
  let teamsInPool = 0;

  for (const team of input.teams) {
    if (!team.pool_id) {
      teamsWithoutPool.push(team.name);
      continue;
    }
    if (!poolIds.has(team.pool_id)) {
      teamsInvalidPool.push(team.name);
      continue;
    }
    teamsInPool += 1;
  }

  const checkTeamsInPools = finalizeItem({
    id: "teams-in-pools",
    title: "Hold i puljer",
    description: "Alle hold skal være placeret i en gyldig pulje under Puljer.",
    metrics: [
      { label: "Hold i alt", value: input.teams.length },
      { label: "I pulje", value: teamsInPool },
      { label: "Uden pulje", value: teamsWithoutPool.length },
      { label: "Ugyldig pulje", value: teamsInvalidPool.length },
    ],
    issues: [
      ...teamsWithoutPool.map((n) => `${n} — mangler pulje`),
      ...teamsInvalidPool.map((n) => `${n} — pulje findes ikke`),
    ],
  });

  const teamsByPool = new Map<string, typeof input.teams>();
  for (const team of input.teams) {
    if (!team.pool_id || !poolIds.has(team.pool_id)) continue;
    const list = teamsByPool.get(team.pool_id) ?? [];
    list.push(team);
    teamsByPool.set(team.pool_id, list);
  }

  const matchesByPool = new Map<string, typeof input.matches>();
  for (const m of input.matches) {
    const list = matchesByPool.get(m.pool_id) ?? [];
    list.push(m);
    matchesByPool.set(m.pool_id, list);
  }

  const poolSyncIssues: string[] = [];
  let poolsSynced = 0;
  let poolsChecked = 0;

  for (const pool of input.pools) {
    const teams = teamsByPool.get(pool.id) ?? [];
    if (teams.length < 2) continue;
    poolsChecked += 1;
    const levelKey = canonicalBanerLevelLabel(pool.level ?? teams[0]?.level);
    const planPerTeam = resolvePlanMatchesPerTeam(levelKey, input.planMatchesByLevel) ?? poolPlanningHint(
      levelKey,
      input.scheduleRows,
    ).matchesPerTeam;
    const sync = analyzePoolMatchSync(teams, matchesByPool.get(pool.id) ?? [], planPerTeam);
    if (sync.isSynced) poolsSynced += 1;
    else poolSyncIssues.push(`${pool.name} (${levelKey}): ${sync.message ?? "Ikke synkroniseret"}`);
  }

  const checkPoolSync = finalizeItem({
    id: "pool-match-sync",
    title: "Puljekampe synkroniseret",
    description: "Genererede kampe skal matche holdene i hver pulje (round-robin ift. kampe pr. hold).",
    metrics: [
      { label: "Puljer tjekket", value: poolsChecked },
      { label: "Synkroniseret", value: poolsSynced },
      { label: "Problemer", value: poolsChecked - poolsSynced },
    ],
    issues: poolSyncIssues,
  });

  const orphanMatches: string[] = [];
  let validMatches = 0;
  let scheduledMatches = 0;
  let unscheduledValid = 0;

  for (const m of input.matches) {
    if (isOrphanKampprogramMatch({ teamAId: m.team_a_id, teamBId: m.team_b_id, poolId: m.pool_id }, teamIds, poolIds)) {
      orphanMatches.push(m.id.slice(0, 8));
      continue;
    }
    validMatches += 1;
    if (m.court_id && m.start_time) scheduledMatches += 1;
    else unscheduledValid += 1;
  }

  const checkOrphans = finalizeItem({
    id: "orphan-matches",
    title: "Gyldige kampreferencer",
    description: "Kampe skal pege på eksisterende pulje og hold (ingen forældreløse rækker).",
    metrics: [
      { label: "Kampe i alt", value: input.matches.length },
      { label: "Gyldige", value: validMatches },
      { label: "Forældreløse", value: orphanMatches.length },
    ],
    issues: orphanMatches.length > 0 ? [`${orphanMatches.length} forældreløse kampe i databasen`] : [],
  });

  const checkScheduled = finalizeItem(
    {
      id: "matches-scheduled",
      title: "Kampe planlagt med bane og tid",
      description: "Gyldige kampe skal have bane og starttid før de vises i appen.",
      metrics: [
        { label: "Gyldige kampe", value: validMatches },
        { label: "Planlagt", value: scheduledMatches },
        { label: "Mangler bane/tid", value: unscheduledValid },
      ],
      issues:
        unscheduledValid > 0
          ? [`${unscheduledValid} kamp(e) mangler bane eller starttid — planlæg under Turneringsplan`]
          : [],
    },
    "warn",
  );

  const levelsWithTeams = new Set(input.teams.map((t) => canonicalBanerLevelLabel(t.level)));
  const levelsMissingPlan: string[] = [];
  for (const levelKey of levelsWithTeams) {
    if (levelKey === "Ukendt niveau") continue;
    if (resolvePlanMatchesPerTeam(levelKey, input.planMatchesByLevel) == null) {
      levelsMissingPlan.push(levelKey);
    }
  }

  const checkPlanSettings = finalizeItem(
    {
      id: "plan-settings",
      title: "Opsætning: kampe pr. niveau",
      description: "Niveauer med hold skal have gemt «kampe pr. hold» under Opsætning → Kampe.",
      metrics: [
        { label: "Niveauer med hold", value: levelsWithTeams.size },
        { label: "Mangler indstilling", value: levelsMissingPlan.length },
      ],
      issues: levelsMissingPlan.map((l) => `${l} — ingen gemt kampe pr. hold`),
    },
    "warn",
  );

  const emptyTeams: string[] = [];
  const membersByTeam = new Map<string, number>();
  for (const m of input.members) {
    membersByTeam.set(m.team_id, (membersByTeam.get(m.team_id) ?? 0) + 1);
  }
  for (const team of input.teams) {
    if ((membersByTeam.get(team.id) ?? 0) === 0) emptyTeams.push(team.name);
  }

  const checkEmptyTeams = finalizeItem(
    {
      id: "teams-have-players",
      title: "Hold har spillere",
      description: "Hold uden spillere kan ikke spille turneringskampe.",
      metrics: [
        { label: "Hold i alt", value: input.teams.length },
        { label: "Uden spillere", value: emptyTeams.length },
      ],
      issues: emptyTeams.map((n) => `${n} — ingen spillere`),
    },
    "warn",
  );

  const poolSizeIssues: string[] = [];
  let poolsOkSize = 0;
  for (const pool of input.pools) {
    const count = teamsByPool.get(pool.id)?.length ?? 0;
    const levelKey = canonicalBanerLevelLabel(pool.level);
    const hint = poolPlanningHint(levelKey, input.scheduleRows);
    if (count < 2) poolSizeIssues.push(`${pool.name}: kun ${count} hold (min. 2)`);
    else if (count > POOL_MAX_TEAMS) poolSizeIssues.push(`${pool.name}: ${count} hold (max ${POOL_MAX_TEAMS})`);
    else if (count > hint.recommendedTeamCount)
      poolSizeIssues.push(
        `${pool.name}: ${count} hold (anbefalet max ${hint.recommendedTeamCount} for ${hint.matchesPerTeam} kampe/hold)`,
      );
    else poolsOkSize += 1;
  }

  const checkPoolSize = finalizeItem(
    {
      id: "pool-size",
      title: "Puljestørrelse",
      description: `Puljer bør have 2–${POOL_MAX_TEAMS} hold og passe til kampe pr. hold.`,
      metrics: [
        { label: "Puljer i alt", value: input.pools.length },
        { label: "OK størrelse", value: poolsOkSize },
        { label: "Bemærkninger", value: poolSizeIssues.length },
      ],
      issues: poolSizeIssues,
    },
    "warn",
  );

  let expectedMatchesTotal = 0;
  let generatedInPools = 0;
  for (const pool of input.pools) {
    const teams = teamsByPool.get(pool.id) ?? [];
    const levelKey = canonicalBanerLevelLabel(pool.level ?? teams[0]?.level);
    const planPerTeam =
      resolvePlanMatchesPerTeam(levelKey, input.planMatchesByLevel) ??
      poolPlanningHint(levelKey, input.scheduleRows).matchesPerTeam;
    expectedMatchesTotal += plannedPoolMatchCount(teams.length, planPerTeam);
    generatedInPools += (matchesByPool.get(pool.id) ?? []).filter(
      (m) => !isOrphanKampprogramMatch({ teamAId: m.team_a_id, teamBId: m.team_b_id, poolId: m.pool_id }, teamIds, poolIds),
    ).length;
  }

  const checkMatchTotals = finalizeItem(
    {
      id: "match-totals",
      title: "Samlet kampantal",
      description: "Antal genererede kampe vs. forventet på tværs af alle puljer.",
      metrics: [
        { label: "Forventet", value: expectedMatchesTotal },
        { label: "Genereret (gyldige)", value: generatedInPools },
        { label: "Difference", value: generatedInPools - expectedMatchesTotal },
      ],
      issues:
        generatedInPools !== expectedMatchesTotal
          ? [
              `Der er ${generatedInPools} gyldige kampe, men forventet ${expectedMatchesTotal} ud fra puljer og kampe pr. hold`,
            ]
          : [],
    },
    "error",
  );

  const rawItems = [
    checkPlayersOnTeams,
    checkTeamsInPools,
    checkEmptyTeams,
    checkPlanSettings,
    checkPoolSize,
    checkPoolSync,
    checkTeamMatchCount,
    checkPlayerMatchCount,
    checkMatchTotals,
    checkOrphans,
    checkScheduled,
  ];

  const items = rawItems.map((i) => ({
    ...i,
    issues: truncateIssues([...new Set(i.issues)]),
  }));

  const summary = { ok: 0, warn: 0, error: 0, total: items.length };
  for (const i of items) {
    if (i.status === "ok") summary.ok += 1;
    else if (i.status === "warn") summary.warn += 1;
    else summary.error += 1;
  }

  return {
    ranAt,
    overallOk: summary.error === 0 && summary.warn === 0,
    summary,
    items,
  };
}

/** Forventet kampe pr. hold i pulje med n hold (til hjælpetekst). */
export { roundRobinMatchesPerTeam };
