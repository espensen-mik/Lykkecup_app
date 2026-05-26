-- VIP-program «Lykke & Lagkage» (skjult link, ikke i burger-menu).
alter table public.lc26_page_content
  drop constraint if exists lc26_page_content_page_key_check;

alter table public.lc26_page_content
  add constraint lc26_page_content_page_key_check
    check (page_key in ('program', 'find-rundt', 'praktisk-info', 'nyt-fra-lykkeliga', 'lykke-og-lagkage'));

insert into public.lc26_page_content (event_id, page_key, title, intro, hero_image_url, content)
values (
  'ae74ce1e-9793-48cd-bb1d-c4a248eaf4bf',
  'lykke-og-lagkage',
  'Lykke & Lagkage',
  'Kære gæst til LykkeCup. Velkommen til en særlig dag med håndbold i verdensklasse, musik og Danmarks lykkeligste VIP-event. Her finder du dit personlige program for dagen.',
  '/Lykkeoglagkage.jpg',
  jsonb_build_object(
    'caption', '',
    'schedule', jsonb_build_array(
      jsonb_build_object(
        'time', '9.15',
        'title', 'Indløb og åbningsceremoni',
        'location', 'SKY Lounge · BOXEN',
        'note', 'Oplev den rørende og livsglade indmarch i Boxen, når 950 lykkelige håndboldspillere gør deres entré'
      ),
      jsonb_build_object(
        'time', '10.10',
        'title', 'Håndboldkampe starter',
        'location', 'BOXEN & Hal L',
        'note', 'Så er der håndbold i verdensklasse. Alle kampe har en varighed på 9 minutter'
      ),
      jsonb_build_object(
        'time', '10.20',
        'title', 'Opvisningskamp',
        'location', 'Hal L, Bane 7',
        'note', 'Der er masser af stjerner, når der spilles opvisningskamp i Hal L.'
      ),
      jsonb_build_object(
        'time', '11.00',
        'title', 'Lykke & Lagkage',
        'location', 'SKY Lounge · BOXEN',
        'note', 'Lykke & Lagkage er Danmarks lykkeligste VIP-event, hvor gæster af LykkeLiga får årets status på lykken.',
        'highlight', true
      ),
      jsonb_build_object(
        'time', '12.00',
        'title', 'Guidet rundvisning',
        'location', 'BOXEN & Hal L',
        'note', 'I selskab med medarbejdere og bestyrelse fra LykkeLiga tager vi jer med på rundtur i MCH, hvor I kan snuse til lykken.'
      )
    )
  )
)
on conflict (event_id, page_key) do nothing;
