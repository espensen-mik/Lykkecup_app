"use client";

import { useState } from "react";
import { insertLc26GuestMessage } from "@/lib/lc26-guest-messages";

const BRAND = "#df6763";

export function Lc26GuestMessageForm() {
  const [displayName, setDisplayName] = useState("");
  const [roleHint, setRoleHint] = useState("");
  const [body, setBody] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!acceptedTerms) {
      setFeedback({ type: "err", text: "Du skal acceptere betingelserne for at sende beskeden." });
      return;
    }
    setSending(true);
    const res = await insertLc26GuestMessage({
      displayName,
      roleHint,
      body,
    });
    setSending(false);
    if (!res.ok) {
      setFeedback({ type: "err", text: res.error });
      return;
    }
    setDisplayName("");
    setRoleHint("");
    setBody("");
    setAcceptedTerms(false);
    setFeedback({ type: "ok", text: "Tak — din besked er sendt til LykkeLiga." });
  }

  return (
    <section
      className="mt-8 border-t border-stone-200 pt-8 dark:border-gray-800"
      aria-labelledby="lc26-guest-form-title"
    >
      <h2 id="lc26-guest-form-title" className="text-lg font-bold tracking-tight text-lc26-navy dark:text-white">
        Send en besked til LykkeLiga
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-lc26-navy/60 dark:text-gray-400">
        Hvordan har du oplevet LykkeCup 2026? Send os en besked, hvor du fortæller om dit LykkeCup.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-lc26-navy/55 dark:text-gray-400">Navn</span>
          <input
            required
            maxLength={200}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-lc26-navy shadow-sm outline-none focus:border-[#df6763] focus:ring-1 focus:ring-[#df6763] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-lc26-navy/55 dark:text-gray-400">Hvem er du?</span>
          <input
            maxLength={200}
            value={roleHint}
            onChange={(e) => setRoleHint(e.target.value)}
            placeholder="Mor, Onkel, Gæst, Fan?"
            className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-lc26-navy shadow-sm outline-none placeholder:text-lc26-navy/35 focus:border-[#df6763] focus:ring-1 focus:ring-[#df6763] dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-lc26-navy/55 dark:text-gray-400">Din besked</span>
          <textarea
            required
            maxLength={8000}
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1.5 w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-lc26-navy shadow-sm outline-none focus:border-[#df6763] focus:ring-1 focus:ring-[#df6763] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/60">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 text-[#df6763] focus:ring-[#df6763]"
            />
            <span className="text-[0.8125rem] leading-snug text-lc26-navy/70 dark:text-gray-300">
              Når du sender denne besked accepterer du også, at vi må bruge dine ord til at prale på sociale medier.
            </span>
          </label>
        </div>

        {feedback ? (
          <p
            role={feedback.type === "err" ? "alert" : "status"}
            className={`text-sm ${feedback.type === "err" ? "text-red-600 dark:text-red-400" : "text-lc26-teal dark:text-teal-300"}`}
          >
            {feedback.text}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
          style={{ backgroundColor: BRAND, boxShadow: "0 8px 24px -12px rgb(223 103 99 / 0.55)" }}
        >
          {sending ? "Sender…" : "Send besked"}
        </button>
      </form>
    </section>
  );
}
