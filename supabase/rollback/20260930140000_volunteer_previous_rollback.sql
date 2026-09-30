-- Genskaber tilmeldingsfunktionen med participation og fjerner previous_volunteer.
begin;

drop function if exists public.submit_volunteer_signup(
  uuid, text, text, text, text, date, boolean, text, text, text, text, text, text, boolean, text, boolean
);
alter table public.volunteers drop column if exists previous_volunteer;

create or replace function public.submit_volunteer_signup(
  p_event_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_birthdate date,
  p_participation text,
  p_availability text,
  p_availability_note text,
  p_tshirt_size text,
  p_task_wish text,
  p_buddy_wish text,
  p_dietary_needs text,
  p_photo_consent boolean,
  p_other_info text,
  p_gdpr_consent boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not exists (select 1 from public.events where id = p_event_id and status = 'active') then
    raise exception 'Tilmeldingen er ikke åben.';
  end if;
  if p_gdpr_consent is not true then
    raise exception 'Samtykke mangler.';
  end if;
  if (
    select count(*) from public.volunteers
    where event_id = p_event_id and lower(email) = v_email and created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'For mange tilmeldinger fra samme e-mail. Prøv igen senere.';
  end if;

  insert into public.volunteers (
    event_id, first_name, last_name, email, phone, birthdate, participation, availability,
    availability_note, tshirt_size, task_wish, buddy_wish, dietary_needs, photo_consent,
    other_info, gdpr_consent_at, source
  ) values (
    p_event_id, btrim(p_first_name), btrim(p_last_name), v_email, btrim(p_phone), p_birthdate,
    nullif(btrim(p_participation), ''), nullif(btrim(p_availability), ''),
    nullif(btrim(p_availability_note), ''), nullif(btrim(p_tshirt_size), ''),
    nullif(btrim(p_task_wish), ''), nullif(btrim(p_buddy_wish), ''),
    nullif(btrim(p_dietary_needs), ''), p_photo_consent, nullif(btrim(p_other_info), ''),
    now(), 'web'
  );
end;
$$;

revoke all on function public.submit_volunteer_signup(
  uuid, text, text, text, text, date, text, text, text, text, text, text, text, boolean, text, boolean
) from public;
grant execute on function public.submit_volunteer_signup(
  uuid, text, text, text, text, date, text, text, text, text, text, text, text, boolean, text, boolean
) to anon, authenticated;

commit;
