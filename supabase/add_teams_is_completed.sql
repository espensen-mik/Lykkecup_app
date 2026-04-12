-- Kør i Supabase SQL Editor (eller som migration), så “Udført” og grøn prik virker.
alter table public.teams
  add column if not exists is_completed boolean not null default false;
