import { Resend } from "resend";

export type VolunteerMailConfig =
  | { ok: true; resend: Resend; from: string; replyTo: string | undefined }
  | { ok: false; message: string };

let client: Resend | null = null;

/** Læser Resend-opsætningen fra serverens miljøvariabler. Må kun kaldes på serveren. */
export function volunteerMailConfig(): VolunteerMailConfig {
  if (typeof window !== "undefined") throw new Error("volunteerMailConfig må kun bruges på serveren.");
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.VOLUNTEER_MAIL_FROM?.trim();
  const replyTo = process.env.VOLUNTEER_MAIL_REPLY_TO?.trim() || undefined;
  if (!apiKey || !from) {
    return { ok: false, message: "Mailafsendelse er ikke sat op endnu (RESEND_API_KEY og VOLUNTEER_MAIL_FROM mangler)." };
  }
  client ??= new Resend(apiKey);
  return { ok: true, resend: client, from, replyTo };
}
