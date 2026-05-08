-- LykkeCup26 CMS-indhold til offentlige sider:
-- - Dagens program
-- - Find rundt i MCH
-- - Praktisk info
-- - Nyt fra LykkeLiga
--
-- Struktur:
-- - Én række pr. side pr. event_id.
-- - `content` er fleksibel JSONB til tekst/billede/sektioner, så UI kan udvides uden ny migration.

create table if not exists public.lc26_page_content (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  page_key text not null,
  title text not null default '',
  intro text not null default '',
  hero_image_url text,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lc26_page_content_page_key_check
    check (page_key in ('program', 'find-rundt', 'praktisk-info', 'nyt-fra-lykkeliga')),
  constraint lc26_page_content_event_page_unique unique (event_id, page_key)
);

create index if not exists lc26_page_content_event_idx
  on public.lc26_page_content (event_id, page_key);

comment on table public.lc26_page_content is
  'CMS-indhold for LykkeCup26 offentlige informationssider.';
comment on column public.lc26_page_content.page_key is
  'program | find-rundt | praktisk-info | nyt-fra-lykkeliga';
comment on column public.lc26_page_content.content is
  'Fleksibel JSONB payload til sektioner, lister, FAQ, artikler, billedtekster mv.';

create or replace function public.lc26_page_content_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lc26_page_content_touch_updated_at on public.lc26_page_content;
create trigger lc26_page_content_touch_updated_at
  before update on public.lc26_page_content
  for each row
  execute procedure public.lc26_page_content_set_updated_at();

alter table public.lc26_page_content enable row level security;

-- Offentlig app: læs indhold for LykkeCup26 eventet.
drop policy if exists "lc26_page_content_anon_select_event" on public.lc26_page_content;
create policy "lc26_page_content_anon_select_event"
  on public.lc26_page_content
  for select
  to anon
  using (event_id = 'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid);

-- KontrolCenter (authenticated): fuld redigering.
drop policy if exists "lc26_page_content_authenticated_select" on public.lc26_page_content;
create policy "lc26_page_content_authenticated_select"
  on public.lc26_page_content
  for select
  to authenticated
  using (true);

drop policy if exists "lc26_page_content_authenticated_insert" on public.lc26_page_content;
create policy "lc26_page_content_authenticated_insert"
  on public.lc26_page_content
  for insert
  to authenticated
  with check (true);

drop policy if exists "lc26_page_content_authenticated_update" on public.lc26_page_content;
create policy "lc26_page_content_authenticated_update"
  on public.lc26_page_content
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "lc26_page_content_authenticated_delete" on public.lc26_page_content;
create policy "lc26_page_content_authenticated_delete"
  on public.lc26_page_content
  for delete
  to authenticated
  using (true);

insert into public.lc26_page_content (event_id, page_key, title, intro, hero_image_url, content)
values
  (
    'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid,
    'program',
    'Dagens program',
    'Fra kl. 9.00 til 21.00 — tiderne kan justeres, når det endelige program foreligger.',
    '/mumle.jpg',
    jsonb_build_object(
      'caption', 'Glæd dig til at Mumle spiller medaljekoncert kl. 16.30 i Boxen',
      'schedule', jsonb_build_array(
        jsonb_build_object('time','09.00','title','Velkommen — hallen åbner','note','Kaffe og morgenhygge ved indgangen'),
        jsonb_build_object('time','10.00','title','Håndboldkampene starter','note','Første fløjt på alle baner'),
        jsonb_build_object('time','11.30','title','Pause','note','Forfriskninger ved sidelinjen'),
        jsonb_build_object('time','12.30','title','Frokost','note','Caféen er åben — se menu på opslag'),
        jsonb_build_object('time','14.00','title','Puljer og semifinaler','note','Opdateret kampprogram på storskærm'),
        jsonb_build_object('time','16.30','title','Medaljekoncert med Mumle','note','I Boxen — find plads i god tid','highlight', true),
        jsonb_build_object('time','18.00','title','Middag og hygge','note','Fælles spisning for holdene'),
        jsonb_build_object('time','19.30','title','Præmieoverrækkelse','note','Hæder til dagens helte'),
        jsonb_build_object('time','21.00','title','Tak for i dag','note','Vi ses i morgen')
      )
    )
  ),
  (
    'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid,
    'find-rundt',
    'Find rundt i MCH',
    'Her finder du snart kort og oversigter, så spillere og familier nemt kan orientere sig i Messecenter Herning. Teksten og grafikken nedenfor er pladsholdere.',
    null,
    jsonb_build_object(
      'cards', jsonb_build_array(
        jsonb_build_object('title','Oversigtskort — MCH','body','Her kommer et samlet kort over Messecenter Herning med indgange, hallområder og fælles faciliteter.'),
        jsonb_build_object('title','Boxen & omklædning','body','Pladsholder til et kort med tribuner, scenen og nærmeste toiletter og omklædning.'),
        jsonb_build_object('title','Parkering & ankomst','body','Pladsholder til p-pladser, cykelparkering og vejvisning fra motorvejen.')
      )
    )
  ),
  (
    'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid,
    'praktisk-info',
    'Praktisk info',
    'Korte pladsholdere til praktiske emner. Erstat teksterne med endeligt indhold, når det er klar.',
    null,
    jsonb_build_object(
      'sections', jsonb_build_array(
        jsonb_build_object('title','Åbningstider','body','Pladsholder: Her beskrives hvornår hallen, café og sekretariat typisk er åbne under LykkeCup. Ret tider og tilføj undtagelser, når programmet er fastlagt.'),
        jsonb_build_object('title','Parkering og transport','body','Pladsholder: Kort om P-pladser, handicapparkering, bus og tog til Herning. Link til rejseplan kan tilføjes senere.'),
        jsonb_build_object('title','Mad og drikke','body','Pladsholder: Hvor man kan købe måltider, snacks og kaffe — og om det er tilladt at medbringe mad i hallen.'),
        jsonb_build_object('title','Toiletter og tilgængelighed','body','Pladsholder: Her kommer vejledning om handicaptoiletter, elevatorer og hvor man finder rolige zoner ved behov.'),
        jsonb_build_object('title','Førstehjælp og tryghed','body','Pladsholder: Kontakt til arrangører, vagter og hvor førstehjælp findes under arrangementet.'),
        jsonb_build_object('title','Vejr og medbringe','body','Pladsholder: Forslag til tøj, sko og ting man kan have i tasken — samt hvor garderobe eller bagage kan stilles.'),
        jsonb_build_object('title','Kontakt under cuppen','body','Pladsholder: Telefon, e-mail eller informationsdisk — udfyldes med rigtige kontakter, når de foreligger.')
      ),
      'faq', jsonb_build_array(
        jsonb_build_object('q','Hvor finder jeg kampprogrammet?','a','Pladsholder: Beskriv hvor programmet vises — fx app, web, opslag i hallen eller på storskærm.'),
        jsonb_build_object('q','Må jeg tage billeder og film?','a','Pladsholder: Korte retningslinjer for privat brug og evt. deling på sociale medier.'),
        jsonb_build_object('q','Hvad gør jeg, hvis jeg mister min spiller?','a','Pladsholder: Mødested, kontaktpersoner og hvordan man melder sig til informationsdisken.'),
        jsonb_build_object('q','Er der wifi?','a','Pladsholder: Om der tilbydes gæste-wifi, og hvordan man logger på.'),
        jsonb_build_object('q','Kan jeg købe billetter på dagen?','a','Pladsholder: Billetinfo, priser og betalingsformer — tilpasses når salget er på plads.')
      )
    )
  ),
  (
    'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf'::uuid,
    'nyt-fra-lykkeliga',
    'Nyt fra LykkeLiga',
    'Seneste nyt, reportager og praktiske historier fra LykkeLiga og LykkeCup. Artiklerne nedenfor er pladsholdere — udskift tekst og billeder, når indholdet er klar.',
    '/musik.jpg',
    jsonb_build_object(
      'articles', jsonb_build_array(
        jsonb_build_object(
          'tag','Musik',
          'tagClass','bg-lc26-teal text-white shadow-sm',
          'date','12. april 2026',
          'dateIso','2026-04-12',
          'title','LykkeLiga udgiver 10 nye musikhits',
          'imageCaption','Spillere fra Vordingborg i koncentreret process med at lave lykkelig musik i efteråret 2025.',
          'paragraphs', jsonb_build_array(
            'Så kan du godt skrue op, for der er ny LykkeLiga-musik til din håndboldtræning. Sammen med fem LykkeLigaklubber fra hele landet har LykkeLiga netop udgivet 10 håndboldhits. Sange som «Vi vinder LykkeCup», «Sammen med Lars er vi Superstars» og «Scoresangen» skal gøre det endnu sjovere at spille i LykkeLiga.',
            'Find alle sangene i vores helt nye webapp: LykkeMusik'
          )
        ),
        jsonb_build_object(
          'tag','Turnering',
          'tagClass','bg-lc26-navy text-white shadow-sm',
          'date','10. april 2026',
          'dateIso','2026-04-10',
          'title','Sådan forbereder vi os på en tryg og fair LykkeCup',
          'paragraphs', jsonb_build_array(
            'Dommere, frivillige og klubber gennemgår de samme retningslinjer hvert år — med små justeringer, når erfaringerne fra sidste sæson viser, at noget kan gøres endnu bedre.',
            'Pladsholder: Indsæt konkrete punkter om fair play, pauser og hvordan vi tager hånd om spillere, der har brug for lidt ekstra støtte på dagen.',
            'Tredje afsnit kan bruges til citat fra turneringsleder eller link til de fulde regler på lykkeliga.dk.'
          )
        ),
        jsonb_build_object(
          'tag','Fællesskab',
          'tagClass','bg-emerald-800 text-white shadow-sm',
          'date','8. april 2026',
          'dateIso','2026-04-08',
          'title','«Vi vinder sammen» — når hele hallen hepper',
          'paragraphs', jsonb_build_array(
            'LykkeCup handler ikke kun om resultattavlen. Mange familier fortæller, at de husker højtaleren, highfives på gangene og de andre hold, der bliver ved med at klappe, når en kamp er afgjort.',
            'Denne artikel er skrevet som eksempel på en længere reportage. Erstat med rigtige citater og fotos, når I er klar.'
          )
        ),
        jsonb_build_object(
          'tag','Interview',
          'tagClass','bg-violet-800 text-white shadow-sm',
          'date','5. april 2026',
          'dateIso','2026-04-05',
          'title','Tre spørgsmål til årets værtsklub før dørene åbner',
          'paragraphs', jsonb_build_array(
            'Vi har bedt en kontaktperson fra værtsklubben om at dele sine forventninger til weekenden. Indtil interviewet er godkendt, står deres svar som pladsholdertekst her.',
            'Brug det andet afsnit til at uddybe, hvordan frivillige fordeles mellem kiosk, baner og velkomst — eller fjern afsnittet, hvis historien skal være kortere.'
          )
        ),
        jsonb_build_object(
          'tag','Arrangement',
          'tagClass','bg-amber-800 text-white shadow-sm',
          'date','1. april 2026',
          'dateIso','2026-04-01',
          'title','Åbningsceremoni og fælles foto — tider og mødested',
          'paragraphs', jsonb_build_array(
            'Alle hold inviteres til et kort fælles øjeblik, før den første kamp fløjtes. Her kommer præcis tid, sted og hvordan man melder sit hold til fotografen.',
            'Pladsholder: Opdater med endelig tid i programmet og evt. QR-kode til tilmelding.'
          )
        )
      )
    )
  )
on conflict (event_id, page_key) do nothing;
