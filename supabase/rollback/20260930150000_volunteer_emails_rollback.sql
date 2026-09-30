-- Fjerner mailhistorikken for frivillige. Selve de sendte mails påvirkes ikke.
begin;

drop table if exists public.volunteer_email_recipients;
drop table if exists public.volunteer_emails;
drop function if exists public.volunteer_email_recipients_check_event();

commit;
