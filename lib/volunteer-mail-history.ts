import type { SupabaseClient } from "@supabase/supabase-js";

export type MailRecipientStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "suppressed"
  | "failed";

export type VolunteerEmailRecipient = {
  id: string;
  email_id: string;
  volunteer_id: string | null;
  name: string;
  email: string;
  resend_id: string | null;
  status: MailRecipientStatus;
  error: string | null;
};

export type VolunteerEmailRecord = {
  id: string;
  subject: string;
  body: string;
  audience_label: string;
  sent_by_name: string | null;
  recipient_count: number;
  status: "sending" | "sent" | "partial" | "failed";
  created_at: string;
  recipients: VolunteerEmailRecipient[];
};

export const DELIVERED_STATUSES: MailRecipientStatus[] = ["delivered", "opened", "clicked"];
export const FAILED_STATUSES: MailRecipientStatus[] = ["bounced", "complained", "suppressed", "failed"];
/** Statusser, som stadig kan ændre sig hos Resend. */
export const PENDING_STATUSES: MailRecipientStatus[] = ["queued", "sent", "delivery_delayed"];

export const RECIPIENT_STATUS_LABEL: Record<MailRecipientStatus, string> = {
  queued: "I kø",
  sent: "Sendt",
  delivered: "Leveret",
  delivery_delayed: "Forsinket",
  opened: "Åbnet",
  clicked: "Klikket",
  bounced: "Afvist",
  complained: "Markeret som spam",
  suppressed: "Blokeret",
  failed: "Fejlet",
};

export async function fetchVolunteerEmailHistory(
  client: SupabaseClient,
  eventId: string,
): Promise<{ emails: VolunteerEmailRecord[]; error: string | null }> {
  const { data, error } = await client
    .from("volunteer_emails")
    .select(
      "id, subject, body, audience_label, sent_by_name, recipient_count, status, created_at, recipients:volunteer_email_recipients(id, email_id, volunteer_id, name, email, resend_id, status, error)",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { emails: [], error: error.message };
  return { emails: (data ?? []) as VolunteerEmailRecord[], error: null };
}
