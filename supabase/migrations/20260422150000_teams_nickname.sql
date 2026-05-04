-- Optional public-facing team label ("Holdets kaldenavn") for LykkeCup 26; official `name` stays for KontrolCenter.

alter table public.teams
  add column if not exists nickname text;

comment on column public.teams.nickname is 'Holdets kaldenavn — vises på den offentlige LykkeCup 26-app når udfyldt; `name` forbliver det autogenererede navn til oversigt i KontrolCenter.';
