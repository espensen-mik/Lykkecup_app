import { GALLA_EVENT_ID } from "@/lib/galla-scanner-config";
import { supabase } from "@/lib/supabase";

export type GallaCheckInStatus = "approved" | "already_checked_in" | "invalid";

export type GallaCheckInResult = {
  status: GallaCheckInStatus;
  message: string;
  reason?: string;
  attendee_id?: number;
  name?: string | null;
  ticket_type?: string | null;
  checked_in_at?: string | null;
};

export type GallaTicketStats = {
  total: number;
  checkedIn: number;
  remaining: number;
};

export type GallaTicketRow = {
  attendee_id: number;
  security_code: string;
  unique_id: string | null;
  ticket_type: string | null;
  name: string;
  email: string | null;
  order_status: string;
  checked_in: boolean;
  checked_in_at: string | null;
};

const INVALID_REASON_DA: Record<string, string> = {
  not_found: "Ticket not found",
  wrong_security_code: "Wrong security code",
  wrong_event_id: "Wrong event ID",
  not_completed: "Order is not completed",
  parse_error: "QR code could not be parsed",
};

export function invalidReasonLabel(reason: string | undefined): string {
  if (!reason) return "Ugyldig billet";
  return INVALID_REASON_DA[reason] ?? reason;
}

export async function fetchGallaTicketStats(): Promise<GallaTicketStats> {
  const [totalRes, checkedRes] = await Promise.all([
    supabase.from("galla_tickets").select("*", { count: "exact", head: true }),
    supabase.from("galla_tickets").select("*", { count: "exact", head: true }).eq("checked_in", true),
  ]);

  if (totalRes.error) throw new Error(totalRes.error.message);
  if (checkedRes.error) throw new Error(checkedRes.error.message);

  const total = totalRes.count ?? 0;
  const checkedIn = checkedRes.count ?? 0;
  return { total, checkedIn, remaining: Math.max(0, total - checkedIn) };
}

export async function gallaCheckInTicket(params: {
  attendeeId: number;
  securityCode: string;
  checkedInBy: string;
}): Promise<GallaCheckInResult> {
  const { data, error } = await supabase.rpc("galla_check_in_ticket", {
    p_attendee_id: params.attendeeId,
    p_security_code: params.securityCode,
    p_event_id: GALLA_EVENT_ID,
    p_checked_in_by: params.checkedInBy,
  });

  if (error) {
    return {
      status: "invalid",
      message: "Ugyldig billet",
      reason: "rpc_error",
    };
  }

  const row = (data ?? {}) as Record<string, unknown>;
  const status = row.status as GallaCheckInStatus;
  if (status !== "approved" && status !== "already_checked_in" && status !== "invalid") {
    return { status: "invalid", message: "Ugyldig billet", reason: "unknown" };
  }

  return {
    status,
    message: typeof row.message === "string" ? row.message : "Ugyldig billet",
    reason: typeof row.reason === "string" ? row.reason : undefined,
    attendee_id: typeof row.attendee_id === "number" ? row.attendee_id : undefined,
    name: typeof row.name === "string" ? row.name : null,
    ticket_type: typeof row.ticket_type === "string" ? row.ticket_type : null,
    checked_in_at: typeof row.checked_in_at === "string" ? row.checked_in_at : null,
  };
}

export async function searchGallaTickets(query: string): Promise<GallaTicketRow[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const safe = q.replace(/[,()]/g, " ").trim();
  const pattern = `%${safe}%`;

  let request = supabase
    .from("galla_tickets")
    .select(
      "attendee_id, security_code, unique_id, ticket_type, name, email, order_status, checked_in, checked_in_at",
    )
    .order("name", { ascending: true })
    .limit(25);

  if (/^\d+$/.test(safe)) {
    const numericId = Number.parseInt(safe, 10);
    request = request.or(`attendee_id.eq.${numericId},unique_id.ilike.${pattern}`);
  } else {
    request = request.or(`name.ilike.${pattern},email.ilike.${pattern},unique_id.ilike.${pattern}`);
  }

  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return (data ?? []) as GallaTicketRow[];
}
