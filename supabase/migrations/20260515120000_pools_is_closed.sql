-- Puljer kan lukkes (som hold i Holddannelse) når fordelingen er færdig.

alter table public.pools
  add column if not exists is_closed boolean not null default false;

comment on column public.pools.is_closed is
  'Når true: puljen er færdig — hold kan ikke tilføjes eller fjernes.';
