export type Player = {
  id: string;
  name: string;
  home_club: string | null;
  level: string | null;
  age: number | null;
  ticket_id: string | null;
};

export type PlayerDetail = {
  id: string;
  name: string;
  home_club: string | null;
  birthdate: string | null;
  age: number | null;
  gender: string | null;
  level: string | null;
  preferences: unknown;
  ticket_id: string | null;
};

/** Row used for dashboard KPIs, charts, and “recent” list */
export type DashboardPlayer = {
  id: string;
  name: string;
  home_club: string | null;
  level: string | null;
  age: number | null;
  gender: string | null;
  /** Used for “recent” ordering; null if not returned from API */
  created_at: string | null;
};
