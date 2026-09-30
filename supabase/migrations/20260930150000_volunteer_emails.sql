-- Historik over mails sendt til frivillige fra KontrolCenter (via Resend).
-- Kun KontrolCenter-brugere har adgang, og historikken kan ikke slettes fra appen.
-- Tilbagerulning: supabase/rollback/20260930150000_volunteer_emails_rollback.sql

begin;

create table public.volunteer_emails (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 1 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  audience jsonb not null default '{}'::jsonb,
  audience_label text not null check (char_length(audience_label) <= 300),
  sent_by uuid,
  sent_by_name text check (sent_by_name is null or char_length(sent_by_name) <= 200),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  status text not null default 'sending' check (status in ('sending', 'sent', 'partial', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.volunteer_email_recipients (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.volunteer_emails(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  volunteer_id uuid references public.volunteers(id) on delete set null,
  name text not null check (char_length(name) <= 220),
  email text not null check (char_length(email) between 3 and 320),
  resend_id text,
  status text not null default 'queued' check (status in (
    'queued', 'sent', 'delivered', 'delivery_delayed', 'opened', 'clicked',
    'bounced', 'complained', 'suppressed', 'failed'
  )),
  error text check (error is null or char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_id, volunteer_id)
);

create index volunteer_emails_event_idx on public.volunteer_emails (event_id, created_at desc);
create index volunteer_email_recipients_email_idx on public.volunteer_email_recipients (email_id);
create index volunteer_email_recipients_volunteer_idx on public.volunteer_email_recipients (volunteer_id);

-- Modtageren skal høre til samme arrangement som udsendelsen.
create or replace function public.volunteer_email_recipients_check_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.volunteer_emails e where e.id = new.email_id and e.event_id = new.event_id) then
    raise exception 'Modtageren hører til et andet arrangement end udsendelsen.';
  end if;
  return new;
end;
$$;

create trigger volunteer_email_recipients_check_event
  before insert or update of email_id, event_id on public.volunteer_email_recipients
  for each row execute function public.volunteer_email_recipients_check_event();

create trigger volunteer_emails_set_updated_at
  before update on public.volunteer_emails
  for each row execute function public.set_updated_at();

create trigger volunteer_email_recipients_set_updated_at
  before update on public.volunteer_email_recipients
  for each row execute function public.set_updated_at();

create trigger archived_event_guard
  before insert or update or delete on public.volunteer_emails
  for each row execute function public.guard_archived_event_write();

create trigger archived_event_guard
  before insert or update or delete on public.volunteer_email_recipients
  for each row execute function public.guard_archived_event_write();

alter table public.volunteer_emails enable row level security;
alter table public.volunteer_email_recipients enable row level security;

revoke all on public.volunteer_emails from anon, public;
revoke all on public.volunteer_email_recipients from anon, public;
grant select, insert, update on public.volunteer_emails to authenticated;
grant select, insert, update on public.volunteer_email_recipients to authenticated;

create policy volunteer_emails_select on public.volunteer_emails
  for select to authenticated using (true);
create policy volunteer_emails_insert on public.volunteer_emails
  for insert to authenticated with check (true);
create policy volunteer_emails_update on public.volunteer_emails
  for update to authenticated using (true) with check (true);

create policy volunteer_email_recipients_select on public.volunteer_email_recipients
  for select to authenticated using (true);
create policy volunteer_email_recipients_insert on public.volunteer_email_recipients
  for insert to authenticated with check (true);
create policy volunteer_email_recipients_update on public.volunteer_email_recipients
  for update to authenticated using (true) with check (true);

commit;

select
  (select count(*) from pg_tables where schemaname = 'public'
     and tablename in ('volunteer_emails', 'volunteer_email_recipients')) as nye_tabeller,
  (select count(*) from pg_trigger where tgname = 'archived_event_guard') as beskyttede_tabeller;
