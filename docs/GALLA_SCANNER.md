# LykkeCup Galla QR Scanner

Skjult check-in-side: **`/hemmeliglykkescanner`**

## Forudsætninger

1. Kør migration: `supabase/migrations/20260602120000_galla_tickets.sql`
2. Kør migration: `supabase/migrations/20260603120000_galla_scanner_anon_check_in.sql` (anon check-in)
3. Importér CSV til `galla_tickets` (se nedenfor)
4. Del kun **`/hemmeliglykkescanner`** (og evt. adgangskode) med entrance-staff — **login er ikke påkrævet**
5. Valgfrit: sæt `NEXT_PUBLIC_GALLA_SCANNER_ACCESS_CODE` i Vercel/.env.local for ekstra adgangskode-gate

## CSV-import i Supabase

### Metode A — Staging (anbefales ved boolean-fejl)

Tomme `checked_in`-celler giver ofte: `invalid input syntax for type boolean: ""`  
— også når cellerne ser tomme ud. **Løsning: importér til staging (kun text).**

1. Kør migration: `20260602130000_galla_tickets_staging_import.sql`
2. **Table Editor → `galla_tickets_staging` → Import CSV** (map alle kolonner — tom `checked_in` er OK)
3. **SQL Editor** → kør:

```sql
SELECT public.galla_import_staging_to_tickets();
```

4. Tjek resultat (`inserted_or_updated`) og at `galla_tickets` har ~1655 rækker

### Metode B — Direkte til `galla_tickets`

1. Gå til **Supabase → Table Editor → `galla_tickets`**
2. **Insert → Import data from CSV**
3. Map kolonner:

   | CSV | Tabel |
   |-----|--------|
   | attendee_id | attendee_id |
   | security_code | security_code |
   | unique_id | unique_id |
   | ticket_type | ticket_type |
   | ticket_product_id | ticket_product_id |
   | name | name |
   | email | email |
   | order_id | order_id |
   | order_status | order_status |
   | checked_in | checked_in |

4. **`checked_in` — vigtigt (almindelig import-fejl):**
   - **Tomme celler** i CSV bliver til `""` og giver fejlen:  
     `invalid input syntax for type boolean: ""`
   - At «slette indholdet» i kolonnen hjælper **ikke** — kolonnen findes stadig og mappes som `""`.
   - **Løsning:** Brug **Metode A (staging)** ovenfor, eller **slet hele `checked_in`-kolonnen** fra CSV-filen (header + data) før direkte import.
   - Ved direkte import: **fjern mapping** af `checked_in` (ikke bare tomme celler).
   - Har du allerede rækker med `1` i CSV (allerede checket ind), sæt dem til `true` i arket, eller kør efter import:
     ```sql
     -- Kun hvis WordPress-eksport brugte 1 = checket ind (tilpas efter behov)
     UPDATE public.galla_tickets SET checked_in = true WHERE checked_in IS NULL AND ...;
     ```
5. `attendee_id` skal være unik og matche `ticket_id` i QR-URL

### Import fejler med boolean?

| CSV-værdi | Brug i import |
|-----------|----------------|
| (tom) | **Ikke map** kolonnen → default `false`, eller skriv `false` |
| `0` | `false` |
| `1` | `true` |
| `true` / `false` | som er |

## QR-format

URL fra WordPress/Event Tickets, fx:

`https://lykkeliga.dk/?event_qr_code=1&ticket_id=26161&event_id=16899&security_code=49f518124b&path=...`

## Lokal test

```bash
npm run dev
```

1. Åbn `/hemmeliglykkescanner` på mobil (eller Chrome device mode) — **uden login**
2. Tillad kamera
3. Scan en test-QR fra CSV-export

## Deploy

1. `git push` → Vercel deploy
2. Kør migrationer på produktion-Supabase (CLI eller SQL Editor), inkl. anon check-in
3. Importér produktions-CSV
4. Sæt evt. `NEXT_PUBLIC_GALLA_SCANNER_ACCESS_CODE` i Vercel env
5. Del kun URL + adgangskode med entrance-staff

## Sikkerhed

- Ingen service role i browser
- Check-in kun via RPC `galla_check_in_ticket` (SECURITY DEFINER; `anon` + `authenticated`)
- Ruten er offentlig i `proxy.ts`; adgang styres via hemmelig URL og evt. `NEXT_PUBLIC_GALLA_SCANNER_ACCESS_CODE`
- QR skal indeholde gyldigt `ticket_id` + `security_code` + `event_id=16899`
