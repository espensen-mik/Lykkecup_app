export type TeamRow = {
  id: string;
  event_id: string;
  pool_id: string | null;
  name: string;
  level: string | null;
  sort_order: number;
  /** Når true: holdet er lukket (grønt kort + “Luk hold”). Kræver kolonnen `is_completed` i `teams`. */
  is_completed?: boolean | null;
};

export type TeamMemberRow = {
  id: string;
  event_id: string;
  player_id: string;
  team_id: string;
};

/** Tilknytning mellem hold og træner (`team_coaches`). */
export type TeamCoachRow = {
  id: string;
  event_id: string;
  team_id: string;
  coach_id: string;
};

/** Træner til listen i holddannelse (minimalt udtræk). */
export type HoldCoachRow = {
  id: string;
  name: string;
  home_club: string | null;
};

/** Spiller til holddannelse (felt udvidet ift. listevisning) */
export type HoldPlayerRow = {
  id: string;
  name: string;
  home_club: string | null;
  age: number | null;
  gender: string | null;
  level: string | null;
  preferences: unknown;
};
