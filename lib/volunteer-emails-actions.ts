"use server";

import { render } from "@react-email/components";
import { revalidatePath } from "next/cache";
import { VolunteerEmail } from "@/lib/emails/volunteer-email";
import { volunteerMailConfig } from "@/lib/resend-server";
import {
  MAX_MAIL_RECIPIENTS,
  isMailableAddress,
  mailAudienceLabel,
  mergeValuesFor,
  parseMailAudience,
  resolveMailAudience,
} from "@/lib/volunteer-mail-audience";
import { applyMergeFields, mailBodyToPlainText, parseMailBody } from "@/lib/volunteer-mail-format";
import { PENDING_STATUSES, type MailRecipientStatus } from "@/lib/volunteer-mail-history";
import { fetchVolunteersBundle, volunteerFullName } from "@/lib/volunteers";
import { editableContext } from "@/lib/volunteers-server";

export type MailActionResult = { ok: true; message: string } | { ok: false; message: string };

const PATH = "/frivillige";
const BATCH_SIZE = 100;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.lykkecup.dk").replace(/\/$/, "");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendVolunteerEmailAction(input: {
  requestId: string;
  audience: unknown;
  subject: string;
  body: string;
}): Promise<MailActionResult> {
  const ctx = await editableContext();
  if (ctx.error !== undefined) return { ok: false, message: ctx.error };

  const config = volunteerMailConfig();
  if (!config.ok) return { ok: false, message: config.message };

  const requestId = String(input.requestId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, message: "Ugyldig forespørgsel. Genindlæs siden og prøv igen." };
  const audience = parseMailAudience(input.audience);
  if (!audience) return { ok: false, message: "Vælg hvem mailen skal sendes til." };
  const subject = String(input.subject ?? "")
    .trim()
    .slice(0, 200);
  const body = String(input.body ?? "")
    .trim()
    .slice(0, 20000);
  if (!subject) return { ok: false, message: "Mailen skal have et emne." };
  if (!body) return { ok: false, message: "Mailen skal have en tekst." };

  const data = await fetchVolunteersBundle(ctx.supabase, ctx.eventId);
  if (data.error) return { ok: false, message: `Kunne ikke hente frivillige: ${data.error}` };

  const recipients = resolveMailAudience(audience, data).filter((v) => isMailableAddress(v.email));
  if (recipients.length === 0) return { ok: false, message: "Der er ingen modtagere med en gyldig e-mail i dit valg." };
  if (recipients.length > MAX_MAIL_RECIPIENTS) {
    return { ok: false, message: `Højst ${MAX_MAIL_RECIPIENTS} modtagere pr. udsendelse. Del udsendelsen op.` };
  }

  const { error: emailError } = await ctx.supabase.from("volunteer_emails").insert({
    id: requestId,
    event_id: ctx.eventId,
    subject,
    body,
    audience,
    audience_label: mailAudienceLabel(audience, data).slice(0, 300),
    sent_by: /^[0-9a-f-]{36}$/i.test(ctx.user.id) ? ctx.user.id : null,
    sent_by_name: ctx.user.fullName || ctx.user.email,
    recipient_count: recipients.length,
    status: "sending",
  });
  if (emailError) {
    if (emailError.code === "23505") return { ok: false, message: "Mailen er allerede sendt." };
    return { ok: false, message: emailError.message };
  }

  const rows = recipients.map((v) => ({
    id: crypto.randomUUID(),
    email_id: requestId,
    event_id: ctx.eventId,
    volunteer_id: v.id,
    name: volunteerFullName(v).slice(0, 220),
    email: v.email.trim().toLowerCase(),
    status: "queued" as MailRecipientStatus,
    resend_id: null as string | null,
    error: null as string | null,
  }));
  const { error: recipientsError } = await ctx.supabase.from("volunteer_email_recipients").insert(rows);
  if (recipientsError) {
    await ctx.supabase.from("volunteer_emails").update({ status: "failed" }).eq("id", requestId);
    return { ok: false, message: recipientsError.message };
  }

  let sent = 0;
  let failed = 0;
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const chunkRows = rows.slice(start, start + BATCH_SIZE);
    const chunkVolunteers = recipients.slice(start, start + BATCH_SIZE);

    const payload = await Promise.all(
      chunkVolunteers.map(async (v, i) => {
        const values = mergeValuesFor(v, data);
        const blocks = parseMailBody(applyMergeFields(body, values));
        const personalSubject = applyMergeFields(subject, values);
        const element = VolunteerEmail({ blocks, preview: personalSubject, siteUrl: SITE_URL, eventName: ctx.event.name });
        return {
          from: config.from,
          to: chunkRows[i].email,
          replyTo: config.replyTo,
          subject: personalSubject,
          html: await render(element),
          text: mailBodyToPlainText(blocks),
          tags: [
            { name: "kind", value: "volunteer" },
            { name: "email_id", value: requestId },
          ],
        };
      }),
    );

    const { data: result, error } = await config.resend.batch.send(payload, {
      idempotencyKey: `volunteer-${requestId}-${start / BATCH_SIZE}`,
    });

    const updated = chunkRows.map((row, i) => {
      const id = result?.data?.[i]?.id;
      if (error || !id) {
        failed += 1;
        return { ...row, status: "failed" as MailRecipientStatus, error: (error?.message ?? "Ukendt fejl fra Resend").slice(0, 1000) };
      }
      sent += 1;
      return { ...row, status: "sent" as MailRecipientStatus, resend_id: id };
    });
    await ctx.supabase.from("volunteer_email_recipients").upsert(updated, { onConflict: "id" });

    if (start + BATCH_SIZE < rows.length) await sleep(600);
  }

  const status = failed === 0 ? "sent" : sent === 0 ? "failed" : "partial";
  await ctx.supabase.from("volunteer_emails").update({ status }).eq("id", requestId);
  revalidatePath(PATH);

  if (status === "failed") return { ok: false, message: "Mailen kunne ikke sendes. Se detaljer i historikken." };
  return {
    ok: true,
    message:
      status === "sent"
        ? `Mailen er sendt til ${sent} ${sent === 1 ? "frivillig" : "frivillige"}.`
        : `Mailen er sendt til ${sent}, men ${failed} fejlede. Se detaljer i historikken.`,
  };
}

const KNOWN_STATUSES = new Set<MailRecipientStatus>([
  "queued",
  "sent",
  "delivered",
  "delivery_delayed",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "suppressed",
  "failed",
]);

/** Henter seneste status fra Resend for modtagere, hvis status stadig kan ændre sig. */
export async function refreshVolunteerEmailStatusAction(emailId: string): Promise<MailActionResult> {
  const ctx = await editableContext();
  if (ctx.error !== undefined) return { ok: false, message: ctx.error };
  const config = volunteerMailConfig();
  if (!config.ok) return { ok: false, message: config.message };

  const { data: email } = await ctx.supabase
    .from("volunteer_emails")
    .select("id, created_at")
    .eq("id", emailId)
    .eq("event_id", ctx.eventId)
    .maybeSingle();
  if (!email) return { ok: false, message: "Udsendelsen findes ikke." };

  const { data: pending, error } = await ctx.supabase
    .from("volunteer_email_recipients")
    .select("id, resend_id, status")
    .eq("email_id", emailId)
    .in("status", PENDING_STATUSES)
    .not("resend_id", "is", null);
  if (error) return { ok: false, message: error.message };
  if (!pending?.length) return { ok: true, message: "Status er allerede opdateret." };

  const wanted = new Map(pending.map((r) => [r.resend_id as string, r]));
  const found = new Map<string, MailRecipientStatus>();
  const sentAt = new Date(email.created_at).getTime() - 60_000;
  let after: string | undefined;

  for (let page = 0; page < 15 && found.size < wanted.size; page += 1) {
    const { data: list, error: listError } = await config.resend.emails.list(after ? { limit: 100, after } : { limit: 100 });
    if (listError?.name === "restricted_api_key") {
      return {
        ok: false,
        message: "Resend-nøglen må kun sende mails. Opret en nøgle med 'Full access' i Resend for at kunne hente leveringsstatus.",
      };
    }
    if (listError || !list) return { ok: false, message: listError?.message ?? "Kunne ikke hente status fra Resend." };
    for (const item of list.data) {
      if (wanted.has(item.id) && KNOWN_STATUSES.has(item.last_event as MailRecipientStatus)) {
        found.set(item.id, item.last_event as MailRecipientStatus);
      }
    }
    const last = list.data.at(-1);
    if (!list.has_more || !last || new Date(last.created_at).getTime() < sentAt) break;
    after = last.id;
    await sleep(550);
  }

  let changed = 0;
  for (const [resendId, status] of found) {
    const row = wanted.get(resendId);
    if (!row || row.status === status) continue;
    const { error: updateError } = await ctx.supabase.from("volunteer_email_recipients").update({ status }).eq("id", row.id);
    if (!updateError) changed += 1;
  }

  revalidatePath(PATH);
  return { ok: true, message: changed ? `${changed} modtagere fik opdateret status.` : "Ingen ændringer endnu." };
}
