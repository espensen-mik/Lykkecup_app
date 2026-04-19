import { supabase } from "@/lib/supabase";
import { LYKKECUP26_EVENT_ID } from "@/lib/lykkecup26-public";

/** Dispatches når ulæst-listen ændrer sig (localStorage). */
export const LC26_INBOX_CHANGED = "lc26-inbox-changed";

export const LC26_MESSAGE_AVATAR_BUCKET = "lc26_message_avatars";

/** År, måned (1–12), dag — bruges til indbakke-tekster (før/på/efter cup-dag). */
export const LC26_INBOX_CUP = { year: 2026, month: 6, day: 14 } as const;

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

export function lc26InboxCupDayStart(): Date {
  const { year, month, day } = LC26_INBOX_CUP;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function lc26InboxCupDayEnd(): Date {
  const { year, month, day } = LC26_INBOX_CUP;
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function stripClock(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** -1 før cup-dag, 0 på cup-dag, 1 efter cup-dag (kun dato, ikke klokkeslæt). */
export function lc26InboxCupDayPhase(now: Date): -1 | 0 | 1 {
  const cup = stripClock(lc26InboxCupDayStart());
  const n = stripClock(now);
  if (n < cup) return -1;
  if (n > cup) return 1;
  return 0;
}

/** Om beskeden er synlig (læsbar) givet nuværende tidspunkt. */
export function lc26InboxIsUnlocked(def: Lc26InboxMessageDef, now: Date): boolean {
  const phase = lc26InboxCupDayPhase(now);
  if (phase < 0) return false;
  if (phase > 0) return true;
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
