alter table public.matches
  add column if not exists schedule_relaxed_team_rest boolean not null default false;

comment on column public.matches.schedule_relaxed_team_rest is
  'True when kamp er planlagt uden den ønskede hold-pause (min. 1 runde).';
