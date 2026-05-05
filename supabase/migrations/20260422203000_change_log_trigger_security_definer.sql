-- Fix deploy/runtime RLS error on player_change_log inserts from update trigger.
-- Cause: trigger runs with caller rights; caller may not satisfy table RLS policy.
-- Solution: run trigger functions as definer.

alter function public.log_player_update_changes()
  security definer
  set search_path = public;

alter function public.log_coach_update_changes()
  security definer
  set search_path = public;
