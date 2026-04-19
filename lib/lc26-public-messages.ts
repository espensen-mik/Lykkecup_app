import { supabase } from "@/lib/supabase";
import { LYKKECUP26_EVENT_ID } from "@/lib/lykkecup26-public";

/** Dispatches når ulæst-listen ændrer sig (localStorage). */
export const LC26_INBOX_CHANGED = "lc26-inbox-changed";

export const LC26_MESSAGE_AVATAR_BUCKET = "lc26_message_avatars";

export type Lc26PublicMessageRow = {
  id: string;
  event_id: string;
  sender_name: string;
  subject: string;
  body: string;
  avatar_url: string | null;
  available_at: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

/** Form brugt af LykkeCup 26-indbakke (offentlig + toast). */
export type Lc26InboxMessageDef = {
  id: string;
  fromName: string;
  subject: string;
  body: string;
  avatarSrc?: string | null;
  /** ISO timestamptz — hvornår beskeden «låses op». */
  availableAt: string;
};

export function mapDbRowToInboxDef(row: Lc26PublicMessageRow): Lc26InboxMessageDef {
  return {
    id: row.id,
    fromName: row.sender_name,
    subject: row.subject,
    body: row.body,
    avatarSrc: row.avatar_url ?? undefined,
    availableAt: row.available_at,
  };
}

export function lc26InboxUnlockDate(def: Lc26InboxMessageDef): Date {
  return new Date(def.availableAt);
}

/** Om beskeden er synlig (læsbar): kun ud fra planlagt tidspunkt — uafhængigt af cup-dato. */
export function lc26InboxIsUnlocked(def: Lc26InboxMessageDef, now: Date): boolean {
  return now.getTime() >= lc26InboxUnlockDate(def).getTime();
}

const SELECT_PUBLIC =
  "id, event_id, sender_name, subject, body, avatar_url, available_at, sort_order" as const;

export async function fetchLc26PublicMessages(
  eventId: string = LYKKECUP26_EVENT_ID,
): Promise<{ data: Lc26InboxMessageDef[]; error: string | null }> {
  const { data, error } = await supabase
    .from("lc26_public_messages")
    .select(SELECT_PUBLIC)
    .eq("event_id", eventId)
    .order("available_at", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) return { data: [], error: error.message };
  const rows = (data ?? []) as Lc26PublicMessageRow[];
  return { data: rows.map(mapDbRowToInboxDef), error: null };
}

export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
