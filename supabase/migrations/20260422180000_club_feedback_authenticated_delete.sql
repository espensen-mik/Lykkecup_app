-- KontrolCenter: slet kommentarer (rækker fjernes også fra coach-feedback-siden).
-- Kræver at rollen authenticated må slette; RLS er typisk slået fra på denne tabel i eksisterende projekter.
grant delete on table public.club_feedback to authenticated;
