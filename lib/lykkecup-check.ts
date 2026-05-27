import { formatTimeForInput, timeToMinutes } from "@/lib/baner-tider";
import { canonicalBanerLevelLabel } from "@/lib/holddannelse";
import { isOrphanKampprogramMatch } from "@/lib/kampprogram";
import {
  poolPlanningHint,
  roundRobinMatchesPerTeam,
  type LevelSchedulePlanningRow,
} from "@/lib/puljer";
import { resolvePlanMatchesPerTeam } from "@/lib/lykkecup-regnemaskine";
import { isAllDayPeriod, periodWindowMinutes } from "@/lib/tournament-periods";
import { analyzePoolMatchSync, plannedLevelMatchCount } from "@/lib/turnering";
import { findCourtOverlapIssues } from "@/lib/turneringsplan-status";

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
  pools: { id: string; name: string; level: string | null; period_id?: string | null }[];
  members: { player_id: string; team_id: string }[];
  matches: {
    id: string;
    pool_id: string;
    team_a_id: string;
    team_b_id: string;
    court_id: string | null;
    start_time: string | null;
    end_time?: string | null;
    schedule_relaxed_team_rest?: boolean;
  }[];
  planMatchesByLevel: Record<string, number>;
  scheduleRows: LevelSchedulePlanningRow[];
  periods?: { id: string; name: string; start_time: string; end_time: string; is_all_day?: boolean }[];
  courtNamesById?: Record<string, string>;
  courtUsage?: LykkecupCheckCourtUsageRow[];
  coaches?: { id: string; name: string }[];
  teamCoaches?: { coach_id: string; team_id: string }[];
};

export type LykkecupCheckCourtUsageRow = {
  courtId: string;
  courtName: string;
  capacityRounds: number;
  usedRounds: number;
  freeRounds: number;
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

  const teamsByPool = new Map<string, typeof input.teams>();
  for (const team of input.teams) {
    if (!team.pool_id || !poolIds.has(team.pool_id)) continue;
    const list = teamsByPool.get(team.pool_id) ?? [];
    list.push(team);
    teamsByPool.set(team.pool_id, list);
  }

  const teamsWrongMatchCount: string[] = [];
  const teamsNoPlanSetting: string[] = [];
  let teamsWithExpected = 0;
  let teamsMatchOk = 0;

  for (const team of input.teams) {
    const expected = resolvePlanMatchesPerTeam(team.level, input.planMatchesByLevel, input.scheduleRows);
    const actual = teamMatchCount.get(team.id) ?? 0;
    if (expected == null) {
      teamsNoPlanSetting.push(team.name);
      continue;
    }
    teamsWithExpected += 1;
    if (actual >= expected) teamsMatchOk += 1;
    else teamsWrongMatchCount.push(`${team.name}: ${actual} kampe (minimum ${expected})`);
  }

  const checkTeamMatchCount = finalizeItem(
    {
      id: "team-match-count",
      title: "Kampe pr. hold",
      description:
        "Hvert hold skal have mindst det aftalte antal kampe fra Opsætning → Kampe. Enkelte hold kan have én ekstra ved ulige puljestørrelse.",
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
    const expected = resolvePlanMatchesPerTeam(team.level, input.planMatchesByLevel, input.scheduleRows);
    if (expected == null) continue;
    playersChecked += 1;
    const actual = teamMatchCount.get(team.id) ?? 0;
    if (actual >= expected) playersMatchOk += 1;
    else playersWrongMatches.push(`${p.name} (${team.name}): ${actual} kampe (minimum ${expected})`);
  }

  const checkPlayerMatchCount = finalizeItem({
    id: "player-match-count",
    title: "Kampe pr. spiller",
    description:
      "Spillere arver antal kampe fra deres hold — mindst Opsætning → Kampe (aldrig færre).",
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

  const matchesByPool = new Map<string, typeof input.matches>();
  for (const pool of input.pools) {
    const teamIdSet = new Set((teamsByPool.get(pool.id) ?? []).map((t) => t.id));
    if (teamIdSet.size === 0) continue;
    const list = input.matches.filter(
      (m) => teamIdSet.has(m.team_a_id) || teamIdSet.has(m.team_b_id),
    );
    matchesByPool.set(pool.id, list);
  }

  const poolSyncIssues: string[] = [];
  let poolsSynced = 0;
  let poolsChecked = 0;

  for (const pool of input.pools) {
    const teams = teamsByPool.get(pool.id) ?? [];
    if (teams.length < 2) continue;
    poolsChecked += 1;
    const levelKey = canonicalBanerLevelLabel(pool.level ?? teams[0]?.level);
    const planPerTeam = resolvePlanMatchesPerTeam(levelKey, input.planMatchesByLevel, input.scheduleRows) ?? poolPlanningHint(
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
          ? [`${unscheduledValid} kamp(e) mangler bane eller starttid — planlæg i Kampprogram (nederst under Ikke planlagt)`]
          : [],
    },
    "warn",
  );

  const teamNamesById = Object.fromEntries(input.teams.map((t) => [t.id, t.name]));
  const schedulingMatches = input.matches.map((m) => ({
    id: m.id,
    pool_id: m.pool_id,
    team_a_id: m.team_a_id,
    team_b_id: m.team_b_id,
    court_id: m.court_id,
    start_time: m.start_time,
    end_time: m.end_time ?? null,
    schedule_relaxed_team_rest: m.schedule_relaxed_team_rest,
  }));

  const courtOverlapIssues = findCourtOverlapIssues(
    schedulingMatches,
    input.courtNamesById ?? {},
    teamNamesById,
  );

  const checkCourtConflicts = finalizeItem({
    id: "court-conflicts",
    title: "Ingen bane-konflikter",
    description: "To kampe må ikke overlappe på samme bane.",
    metrics: [
      { label: "Konflikter", value: courtOverlapIssues.length },
    ],
    issues: courtOverlapIssues,
  });

  const outsidePoolIssues: string[] = [];
  if (input.periods?.length) {
    const periodById = new Map(input.periods.map((p) => [p.id, p]));
    const poolById = new Map(input.pools.map((p) => [p.id, p]));
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
      if (!m.court_id || !m.start_time) continue;
      const pool = poolById.get(m.pool_id);
      const periodId = pool?.period_id;
      if (!periodId) continue;
      const period = periodById.get(periodId);
      if (!period || isAllDayPeriod({ name: period.name, is_all_day: period.is_all_day ?? false })) continue;
      const matchStart = timeToMinutes(m.start_time);
      const win = periodWindowMinutes(period);
      if (matchStart == null || !win) continue;
      if (matchStart < win.startMinutes || matchStart >= win.endMinutes) {
        const a = teamNamesById[m.team_a_id] ?? "Hold";
        const b = teamNamesById[m.team_b_id] ?? "Hold";
        outsidePoolIssues.push(`${a} vs ${b} (${pool?.name ?? "Pulje"}) — uden for ${period.name}`);
      }
    }
  }

  const checkOutsidePoolPeriod = finalizeItem(
    {
      id: "outside-pool-period",
      title: "Kampe inden for pulje-periode",
      description: "Planlagte kampe bør ligge inden for puljens tildelte periode (Formiddag, Eftermiddag osv.).",
      metrics: [{ label: "Uden for periode", value: outsidePoolIssues.length }],
      issues: outsidePoolIssues,
    },
    "warn",
  );

  const manglerPauseMatches: string[] = [];
  const teamsManglerPause = new Set<string>();
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
    if (!m.schedule_relaxed_team_rest) continue;
    teamsManglerPause.add(m.team_a_id);
    teamsManglerPause.add(m.team_b_id);
    const a = teamNamesById[m.team_a_id] ?? "Hold";
    const b = teamNamesById[m.team_b_id] ?? "Hold";
    const court = m.court_id ? (input.courtNamesById?.[m.court_id] ?? "Bane") : "Ikke planlagt";
    const time =
      m.start_time != null ? formatTimeForInput(m.start_time) : "—";
    manglerPauseMatches.push(`${a} vs ${b} — ${time} (${court})`);
  }

  const checkManglerPause = finalizeItem(
    {
      id: "mangler-pause",
      title: "Mangler pause",
      description:
        "Kampe planlagt uden fuld hold-pause mellem kampe. Holdene kan spille, men bør flyttes hvis muligt.",
      metrics: [
        { label: "Hold berørt", value: teamsManglerPause.size },
        { label: "Kampe", value: manglerPauseMatches.length },
      ],
      issues: manglerPauseMatches,
    },
    "warn",
  );

  const courtUsageRows = input.courtUsage ?? [];
  const courtsOverCapacity = courtUsageRows.filter((r) => r.freeRounds <= 0);
  const courtUsageLines = courtUsageRows.map(
    (r) =>
      `${r.courtName}: ${r.freeRounds} ledige runder (kapacitet ${r.capacityRounds}, brugt ${r.usedRounds})`,
  );

  const checkCourtUsage: LykkecupCheckItem = {
    id: "court-usage",
    title: "Baneforbrug",
    description:
      "Aktive baner skal have ledig kapacitet. Rød markering når en bane har 0 eller færre ledige runder.",
    metrics: [
      { label: "Baner", value: courtUsageRows.length },
      { label: "Over kapacitet", value: courtsOverCapacity.length },
      {
        label: "Ledige runder i alt",
        value: courtUsageRows.reduce((s, r) => s + Math.max(0, r.freeRounds), 0),
      },
    ],
    issues: truncateIssues(courtUsageLines),
    issueCount: courtsOverCapacity.length,
    status: courtsOverCapacity.length > 0 ? "error" : "ok",
    ok: courtsOverCapacity.length === 0,
  };

  const assignedCoachIds = new Set((input.teamCoaches ?? []).map((tc) => tc.coach_id));
  const coachesWithoutTeam = (input.coaches ?? []).filter((c) => !assignedCoachIds.has(c.id));

  const checkCoaches = finalizeItem(
    {
      id: "coaches-assigned",
      title: "Træner-tjek",
      description: "Trænere bør være knyttet til mindst ét hold. Manglende tilknytning er kun en advarsel.",
      metrics: [
        { label: "Trænere i alt", value: input.coaches?.length ?? 0 },
        { label: "Uden hold", value: coachesWithoutTeam.length },
      ],
      issues: coachesWithoutTeam.map((c) => c.name),
    },
    "warn",
  );

  const levelsWithTeams = new Set(input.teams.map((t) => canonicalBanerLevelLabel(t.level)));
  const levelsMissingPlan: string[] = [];
  for (const levelKey of levelsWithTeams) {
    if (levelKey === "Ukendt niveau") continue;
    if (resolvePlanMatchesPerTeam(levelKey, input.planMatchesByLevel, input.scheduleRows) == null) {
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

  const teamsByLevel = new Map<string, typeof input.teams>();
  for (const team of input.teams) {
    if (!team.pool_id || !poolIds.has(team.pool_id)) continue;
    const levelKey = canonicalBanerLevelLabel(team.level);
    const list = teamsByLevel.get(levelKey) ?? [];
    list.push(team);
    teamsByLevel.set(levelKey, list);
  }

  let expectedMatchesTotal = 0;
  let generatedInPools = 0;
  const countedMatchIds = new Set<string>();
  for (const [levelKey, levelTeams] of teamsByLevel) {
    const planPerTeam =
      resolvePlanMatchesPerTeam(levelKey, input.planMatchesByLevel, input.scheduleRows) ??
      poolPlanningHint(levelKey, input.scheduleRows).matchesPerTeam;
    expectedMatchesTotal += plannedLevelMatchCount(levelTeams.length, planPerTeam);
  }
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
    if (countedMatchIds.has(m.id)) continue;
    countedMatchIds.add(m.id);
    generatedInPools += 1;
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
    checkPoolSync,
    checkTeamMatchCount,
    checkPlayerMatchCount,
    checkMatchTotals,
    checkOrphans,
    checkScheduled,
    checkCourtConflicts,
    checkOutsidePoolPeriod,
    checkCourtUsage,
    checkManglerPause,
    checkCoaches,
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
