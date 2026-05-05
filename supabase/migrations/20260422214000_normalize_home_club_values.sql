-- Clean up duplicate-looking clubs caused by hidden spaces/non-breaking spaces.
-- Example: "VRI Dreamers" vs "VRI Dreamers " should become one canonical value.

create or replace function public.normalize_home_club_text(v text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      replace(trim(coalesce(v, '')), chr(160), ' '),
      '\s+',
      ' ',
      'g'
    ),
    ''
  );
$$;

update public.players
set home_club = public.normalize_home_club_text(home_club)
where home_club is distinct from public.normalize_home_club_text(home_club);

update public.coaches
set home_club = public.normalize_home_club_text(home_club)
where home_club is distinct from public.normalize_home_club_text(home_club);

update public.club_feedback
set home_club = public.normalize_home_club_text(home_club)
where home_club is distinct from public.normalize_home_club_text(home_club);
