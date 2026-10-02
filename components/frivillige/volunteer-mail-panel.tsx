"use client";

import { AlertTriangle, Bold, ChevronDown, Copy, Crown, Italic, Loader2, Mail, RefreshCw, Send, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { volunteerFieldClass } from "@/components/frivillige/volunteer-fields";
import { PickMultiSelect } from "@/components/ui/pick-multi-select";
import { refreshVolunteerEmailStatusAction, sendVolunteerEmailAction } from "@/lib/volunteer-emails-actions";
import {
  MAIL_AUDIENCE_TYPES,
  isMailableAddress,
  mergeValuesFor,
  resolveMailAudience,
  type MailAudience,
  type MailAudienceType,
} from "@/lib/volunteer-mail-audience";
import { MERGE_FIELDS, applyInlineMarker, applyMergeFields, parseMailBody, type Inline } from "@/lib/volunteer-mail-format";
import {
  DELIVERED_STATUSES,
  FAILED_STATUSES,
  RECIPIENT_STATUS_LABEL,
  type MailRecipientStatus,
  type VolunteerEmailRecord,
} from "@/lib/volunteer-mail-history";
import {
  taskTimeLabel,
  volunteerFullName,
  type Volunteer,
  type VolunteerTask,
  type VolunteerTaskAssignment,
  type VolunteerTeam,
} from "@/lib/volunteers";

type Props = {
  volunteers: Volunteer[];
  teams: VolunteerTeam[];
  tasks: VolunteerTask[];
  assignments: VolunteerTaskAssignment[];
  history: VolunteerEmailRecord[];
  historyError: string | null;
  readOnly: boolean;
  preset: MailAudience | null;
};

const dateFormatter = new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" });

function emphasisClass(part: { bold?: boolean; italic?: boolean }): string | undefined {
  const cls = [part.bold ? "font-bold" : "", part.italic ? "italic" : ""].filter(Boolean).join(" ");
  return cls || undefined;
}

function PreviewInline({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.type === "link" ? (
          <a key={i} href={p.href} target="_blank" rel="noreferrer" className={`text-[#138a55] underline ${emphasisClass(p) ?? ""}`}>
            {p.text}
          </a>
        ) : (
          <span key={i} className={emphasisClass(p)}>
            {p.text}
          </span>
        ),
      )}
    </>
  );
}

function statusTone(status: MailRecipientStatus): string {
  if (DELIVERED_STATUSES.includes(status)) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (FAILED_STATUSES.includes(status)) return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
}

export function VolunteerMailPanel({ volunteers, teams, tasks, assignments, history, historyError, readOnly, preset }: Props) {
  const router = useRouter();
  const [audienceType, setAudienceType] = useState<MailAudienceType>(preset?.type ?? "teams");
  const [ids, setIds] = useState<string[]>(preset?.ids ?? []);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showRecipients, setShowRecipients] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [historyMessage, setHistoryMessage] = useState<{ id: string; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const requestIdRef = useRef<string | null>(null);

  const data = useMemo(() => ({ volunteers, teams, tasks, assignments }), [volunteers, teams, tasks, assignments]);
  const audience: MailAudience = { type: audienceType, ids };
  const needsIds = audienceType === "teams" || audienceType === "volunteers" || audienceType === "tasks";
  const resolved = needsIds && ids.length === 0 ? [] : resolveMailAudience(audience, data);
  const recipients = resolved.filter((v) => isMailableAddress(v.email));
  const invalidCount = resolved.length - recipients.length;

  const previewVolunteer = recipients[0] ?? null;
  const previewValues = previewVolunteer
    ? mergeValuesFor(previewVolunteer, data)
    : { fornavn: "Mette", navn: "Mette Jensen", team: "Guldskranke", opgaver: "Guldskranke (Formiddag · 8.00–12.00)" };
  const previewBlocks = parseMailBody(applyMergeFields(body || "Skriv din tekst til venstre …", previewValues));
  const previewSubject = applyMergeFields(subject || "Emne", previewValues);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const leaderIds = useMemo(() => new Set(teams.map((t) => t.leader_volunteer_id).filter(Boolean)), [teams]);

  const idOptions =
    audienceType === "teams"
      ? teams.map((t) => ({ value: t.id, label: t.name, hint: `${volunteers.filter((v) => v.team_id === t.id).length} frivillige` }))
      : audienceType === "tasks"
        ? tasks.map((t) => ({
            value: t.id,
            label: t.name,
            hint: `${taskTimeLabel(t)} · ${assignments.filter((a) => a.task_id === t.id).length} på`,
            group: (t.team_id && teamById.get(t.team_id)?.name) || "Uden team",
          }))
        : volunteers.map((v) => ({
            value: v.id,
            label: volunteerFullName(v),
            hint: v.email,
            group: (v.team_id && teamById.get(v.team_id)?.name) || "Uden team",
            icon: leaderIds.has(v.id) ? <Crown className="h-3.5 w-3.5 text-amber-500" /> : undefined,
          }));

  function chooseType(type: MailAudienceType) {
    setAudienceType(type);
    setIds([]);
    setResult(null);
  }

  function insertToken(token: string) {
    const el = bodyRef.current;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function formatSelection(kind: "bold" | "italic") {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    const next = applyInlineMarker(body, start, end, kind);
    setBody(next.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }

  function send() {
    if (!subject.trim() || !body.trim()) {
      setResult({ ok: false, message: "Udfyld både emne og tekst." });
      return;
    }
    if (recipients.length === 0) {
      setResult({ ok: false, message: "Vælg mindst én modtager med en gyldig e-mail." });
      return;
    }
    const noun = recipients.length === 1 ? "frivillig" : "frivillige";
    if (!window.confirm(`Send "${subject.trim()}" til ${recipients.length} ${noun}?`)) return;

    requestIdRef.current ??= crypto.randomUUID();
    const requestId = requestIdRef.current;
    setResult(null);
    startTransition(async () => {
      const res = await sendVolunteerEmailAction({ requestId, audience, subject, body });
      setResult(res);
      if (res.ok) {
        requestIdRef.current = null;
        setSubject("");
        setBody("");
        router.refresh();
      } else if (!res.message.includes("allerede sendt")) {
        requestIdRef.current = null;
        router.refresh();
      }
    });
  }

  function refreshStatus(emailId: string) {
    setHistoryMessage(null);
    startTransition(async () => {
      const res = await refreshVolunteerEmailStatusAction(emailId);
      setHistoryMessage({ id: emailId, text: res.message });
      if (res.ok) router.refresh();
    });
  }

  function reuse(email: VolunteerEmailRecord) {
    setSubject(email.subject);
    setBody(email.body);
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const typeButton = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
      active
        ? "border-[#14b8a6] bg-[#14b8a6] text-white"
        : "border-lc-border text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
    }`;

  return (
    <div className="space-y-10">
      {readOnly ? null : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Modtagere</h3>
              <div className="flex flex-wrap gap-2">
                {MAIL_AUDIENCE_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => chooseType(t.value)} className={typeButton(audienceType === t.value)}>
                    {t.label}
                  </button>
                ))}
              </div>
              {needsIds ? (
                <PickMultiSelect
                  key={audienceType}
                  options={idOptions}
                  value={ids}
                  onChange={(next) => {
                    setIds(next);
                    setResult(null);
                  }}
                  placeholder={
                    audienceType === "teams" ? "Vælg teams …" : audienceType === "tasks" ? "Vælg opgaver …" : "Vælg frivillige …"
                  }
                  emptyText={
                    audienceType === "teams"
                      ? "Der er ingen teams endnu"
                      : audienceType === "tasks"
                        ? "Der er ingen opgaver endnu"
                        : "Der er ingen frivillige endnu"
                  }
                />
              ) : null}

              <div className="rounded-md border border-lc-border bg-gray-50/70 px-3.5 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800/40">
                <button
                  type="button"
                  onClick={() => setShowRecipients((s) => !s)}
                  disabled={recipients.length === 0}
                  className="flex w-full items-center justify-between gap-2 text-left disabled:cursor-default"
                >
                  <span className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200">
                    <Users className="h-4 w-4 text-[#14b8a6]" aria-hidden />
                    <span className="font-semibold tabular-nums">{recipients.length}</span>
                    {recipients.length === 1 ? "modtager" : "modtagere"}
                  </span>
                  {recipients.length > 0 ? (
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 transition-transform ${showRecipients ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  ) : null}
                </button>
                {invalidCount > 0 ? (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    {invalidCount} springes over pga. ugyldig e-mail
                  </p>
                ) : null}
                {showRecipients && recipients.length > 0 ? (
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t border-lc-border pt-2 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                    {recipients.map((v) => (
                      <li key={v.id} className="flex justify-between gap-3">
                        <span className="truncate">{volunteerFullName(v)}</span>
                        <span className="truncate text-gray-400">{v.email}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                Emne
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  placeholder="Fx Velkommen på Team {team}"
                  className={volunteerFieldClass}
                  disabled={pending}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tekst</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => formatSelection("bold")}
                        disabled={pending}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-lc-border text-gray-600 hover:border-[#14b8a6] hover:text-[#0f766e] disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:text-teal-300"
                        title="Fed"
                        aria-label="Fed"
                      >
                        <Bold className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => formatSelection("italic")}
                        disabled={pending}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-lc-border text-gray-600 hover:border-[#14b8a6] hover:text-[#0f766e] disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:text-teal-300"
                        title="Kursiv"
                        aria-label="Kursiv"
                      >
                        <Italic className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                    {MERGE_FIELDS.map((f) => (
                      <button
                        key={f.token}
                        type="button"
                        onClick={() => insertToken(f.token)}
                        disabled={pending}
                        className="rounded-full border border-lc-border px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-[#14b8a6] hover:text-[#0f766e] dark:border-gray-600 dark:text-gray-300 dark:hover:text-teal-300"
                        title={`Indsæt ${f.token}`}
                      >
                        + {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  maxLength={20000}
                  placeholder={
                    "Hej {fornavn}\n\nTusind tak fordi du vil være frivillig på Team {team}.\n\nDine opgaver: {opgaver}\n\nKærlig hilsen\nLykkeCup"
                  }
                  className={`${volunteerFieldClass} font-[inherit] leading-relaxed`}
                  disabled={pending}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tom linje giver nyt afsnit · <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">**fed**</code> ·{" "}
                  <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">*kursiv*</code> ·{" "}
                  <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">- punkt</code> ·{" "}
                  <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">[tekst](https://…)</code>
                </p>
              </div>
            </div>

            {result ? (
              <p
                className={`rounded-md border px-3 py-2 text-sm ${
                  result.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                }`}
                role="status"
              >
                {result.message}
              </p>
            ) : null}

            <button
              type="button"
              onClick={send}
              disabled={pending || recipients.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-[#14b8a6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              {pending ? "Sender …" : `Send til ${recipients.length} ${recipients.length === 1 ? "frivillig" : "frivillige"}`}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Forhåndsvisning</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {previewVolunteer ? `Som ${volunteerFullName(previewVolunteer)} ser den` : "Med eksempeldata"}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-lc-border bg-[#eef2f6] p-4 dark:border-gray-700">
              <p className="mb-3 truncate text-sm text-gray-700">
                <span className="text-gray-500">Emne: </span>
                <span className="font-semibold">{previewSubject}</span>
              </p>
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="bg-[#0f2442] px-6 py-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/email/lykkeliga-logo-white.png" alt="Lykkeliga" width={112} height={42} />
                  <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[#5ee0a4]">LykkeCup · Frivillig</p>
                </div>
                <div className="h-1 bg-[#22b573]" />
                <div className="space-y-4 px-6 py-6 text-[0.9375rem] leading-relaxed text-gray-800">
                  {previewBlocks.map((b, i) =>
                    b.type === "paragraph" ? (
                      <p key={i}>
                        {b.lines.map((line, j) => (
                          <span key={j}>
                            {j > 0 ? <br /> : null}
                            <PreviewInline parts={line} />
                          </span>
                        ))}
                      </p>
                    ) : (
                      <ul key={i} className="list-disc space-y-1 pl-5">
                        {b.items.map((item, j) => (
                          <li key={j}>
                            <PreviewInline parts={item} />
                          </li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
                <div className="mx-6 border-t border-gray-200 py-4 text-xs leading-relaxed text-gray-500">
                  Du får denne mail, fordi du er tilmeldt som frivillig. Har du spørgsmål, kan du bare svare på mailen.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sendte mails</h3>
        {historyError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            Kunne ikke hente historik: {historyError}
          </p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Der er ikke sendt nogen mails endnu.</p>
        ) : (
          <ul className="divide-y divide-lc-border rounded-lg border border-lc-border dark:divide-gray-700 dark:border-gray-700">
            {history.map((email) => {
              const delivered = email.recipients.filter((r) => DELIVERED_STATUSES.includes(r.status)).length;
              const failed = email.recipients.filter((r) => FAILED_STATUSES.includes(r.status)).length;
              const waiting = email.recipients.length - delivered - failed;
              const isOpen = openHistoryId === email.id;
              return (
                <li key={email.id} className="bg-white dark:bg-gray-900/20">
                  <button
                    type="button"
                    onClick={() => setOpenHistoryId(isOpen ? null : email.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#14b8a6]" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-900 dark:text-white">{email.subject}</span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {dateFormatter.format(new Date(email.created_at))} · {email.audience_label}
                          {email.sent_by_name ? ` · ${email.sent_by_name}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        {delivered} leveret
                      </span>
                      {waiting > 0 ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                          {waiting} afventer
                        </span>
                      ) : null}
                      {failed > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800 dark:bg-red-900/40 dark:text-red-200">
                          {failed} fejlet
                        </span>
                      ) : null}
                      <ChevronDown
                        className={`ml-1 h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="space-y-3 border-t border-lc-border px-4 py-4 dark:border-gray-700">
                      <div className="flex flex-wrap gap-2">
                        {readOnly ? null : (
                          <>
                            <button
                              type="button"
                              onClick={() => refreshStatus(email.id)}
                              disabled={pending || waiting === 0}
                              className="inline-flex items-center gap-1.5 rounded-md border border-lc-border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} aria-hidden />
                              Opdater status
                            </button>
                            <button
                              type="button"
                              onClick={() => reuse(email)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-lc-border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              <Copy className="h-3.5 w-3.5" aria-hidden />
                              Brug som skabelon
                            </button>
                          </>
                        )}
                        {historyMessage?.id === email.id ? (
                          <span className="self-center text-xs text-gray-500 dark:text-gray-400">{historyMessage.text}</span>
                        ) : null}
                      </div>
                      <details className="text-sm">
                        <summary className="cursor-pointer text-xs font-semibold text-gray-500 dark:text-gray-400">Vis tekst</summary>
                        <p className="mt-2 whitespace-pre-line rounded-md bg-gray-50 p-3 text-gray-700 dark:bg-gray-800/40 dark:text-gray-200">
                          {email.body}
                        </p>
                      </details>
                      <ul className="max-h-72 divide-y divide-lc-border overflow-y-auto text-sm dark:divide-gray-700">
                        {email.recipients
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name, "da"))
                          .map((r) => (
                            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                              <span className="min-w-0">
                                <span className="text-gray-800 dark:text-gray-200">{r.name}</span>{" "}
                                <span className="text-xs text-gray-400">{r.email}</span>
                                {r.error ? <span className="block text-xs text-red-600 dark:text-red-300">{r.error}</span> : null}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${statusTone(r.status)}`}>
                                {RECIPIENT_STATUS_LABEL[r.status] ?? r.status}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
