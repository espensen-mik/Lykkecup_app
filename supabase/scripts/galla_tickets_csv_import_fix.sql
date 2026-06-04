-- Kør EFTER CSV-import hvis checked_in blev mappet med tomme strenge (fejler ved import).
-- Normalt: importér UDEN at mappe checked_in — så er alle false som standard.

-- Eksempel: markér specifikke attendee_id som allerede checket ind (fra WordPress-eksport med "1")
-- UPDATE public.galla_tickets SET checked_in = true, checked_in_at = now() WHERE attendee_id IN (12345, 67890);
