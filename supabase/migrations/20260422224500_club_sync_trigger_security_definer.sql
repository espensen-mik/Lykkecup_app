-- Fix: public coach-feedback (anon) can fail on RLS in lykkecup26_clubs
-- because sync_club_reference() upserts into that table.
-- Run trigger as definer so inserts/updates happen with function owner rights.

alter function public.sync_club_reference()
  security definer
  set search_path = public;
