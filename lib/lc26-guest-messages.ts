import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { LYKKECUP26_EVENT_ID } from "@/lib/lykkecup26-public";

export type Lc26GuestMessageRow = {
  id: string;
  event_id: string;
  display_name: string;
  role_hint: string;
  body: string;
  created_at: string;
};

const GUEST_SELECT = "id, event_id, display_name, role_hint, body, created_at" as const;

export async function insertLc26GuestMessage(input: {
  displayName: string;
  roleHint: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const display_name = input.displayName.trim();
  const role_hint = input.roleHint.trim();
  const body = input.body.trim();
  if (!display_name) return { ok: false, error: "Udfyld navn." };
  if (!body) return { ok: false, error: "Skriv en besked." };
  if (display_name.length > 200) return { ok: false, error: "Navnet er for langt." };
  if (role_hint.length > 200) return { ok: false, error: "Feltet «Hvem er du?» er for langt." };
  if (body.length > 8000) return { ok: false, error: "Beskeden er for lang." };

  const { error } = await supabase.from("lc26_guest_messages").insert({
    event_id: LYKKECUP26_EVENT_ID,
    display_name,
    role_hint,
    body,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function fetchLc26GuestMessagesAdmin(client: SupabaseClient): Promise<{ data: Lc26GuestMessageRow[]; error: string | null }> {
  const { data, error } = await client
    .from("lc26_guest_messages")
    .select(GUEST_SELECT)
    .eq("event_id", LYKKECUP26_EVENT_ID)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Lc26GuestMessageRow[], error: null };
}
