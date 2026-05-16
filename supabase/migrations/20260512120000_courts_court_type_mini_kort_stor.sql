-- Baner: court sizes Mini / Kort / Stor (DB values: mini, kort, stor).
-- Migrates legacy large → stor, small → mini.

-- If `level_court_settings` was applied before this migration, it holds a reference to
-- `public.court_type` and PostgreSQL will refuse to DROP TYPE. Detach to text first.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'level_court_settings'
      and column_name = 'court_type'
  ) then
    execute 'alter table public.level_court_settings alter column court_type type text using court_type::text';
  end if;
end $$;

alter table public.courts drop constraint if exists courts_court_type_check;

do $$
declare
  prev_oid oid;
begin
  select a.atttypid
  into prev_oid
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'courts'
    and a.attname = 'court_type'
    and not a.attisdropped;

  alter table public.courts
    alter column court_type type text using court_type::text;

  if prev_oid is not null and (select typtype from pg_type where oid = prev_oid) = 'e' then
    execute format('drop type if exists %s', prev_oid::regtype);
  end if;
end $$;

update public.courts
set court_type = case lower(trim(court_type))
  when 'large' then 'stor'
  when 'small' then 'mini'
  else court_type
end;

do $$
begin
  create type public.court_type as enum ('mini', 'kort', 'stor');
exception
  when duplicate_object then null;
end $$;

alter table public.courts
  alter column court_type type public.court_type using (
    case lower(trim(court_type))
      when 'large' then 'stor'
      when 'small' then 'mini'
      when 'mini' then 'mini'::public.court_type
      when 'kort' then 'kort'::public.court_type
      when 'stor' then 'stor'::public.court_type
      else 'kort'::public.court_type
    end
  );

-- Reattach niveau-mapping tabellen hvis den blev sat til text ovenfor (forkert migrationsrækkefølge).
do $$
declare
  col_typ text;
begin
  select pg_catalog.format_type(a.atttypid, a.atttypmod)
    into col_typ
  from pg_catalog.pg_attribute a
  join pg_catalog.pg_class c on c.oid = a.attrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'level_court_settings'
    and a.attname = 'court_type'
    and not a.attisdropped;

  if col_typ is not null and col_typ = 'text' then
    execute $sql$
      alter table public.level_court_settings
        alter column court_type type public.court_type using (
          case lower(trim(court_type))
            when 'large' then 'stor'::public.court_type
            when 'small' then 'mini'::public.court_type
            when 'mini' then 'mini'::public.court_type
            when 'kort' then 'kort'::public.court_type
            when 'stor' then 'stor'::public.court_type
            else 'kort'::public.court_type
          end
        );
    $sql$;
  end if;
end $$;

comment on type public.court_type is 'Bane størrelse: mini (lille), kort, stor — matcher LykkeCup taksonomi.';
