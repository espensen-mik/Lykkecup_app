"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StyledSelect } from "@/components/ui/styled-select";
import { formatDaDateTime } from "@/lib/datetime";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";
import type { ClubFeedbackRow } from "@/types/club-feedback";

type PlayerRow = {
  id: string;
  name: string;
  home_club: string | null;
  age: number | null;
  level: string | null;
};

function uniqueClubsFromPlayers(players: PlayerRow[]): string[] {
  const seen = new Set<string>();
  for (const p of players) {
    const t = p.home_club?.trim();
    if (t) seen.add(t);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "da", { sensitivity: "base" }));
}

function playersForClub(players: PlayerRow[], club: string): PlayerRow[] {
  return players
    .filter((p) => (p.home_club?.trim() ?? "") === club)
    .sort((a, b) => a.name.localeCompare(b.name, "da", { sensitivity: "base" }));
}

function feedbackForClub(rows: ClubFeedbackRow[], club: string): ClubFeedbackRow[] {
  return rows
    .filter((r) => (r.home_club?.trim() ?? "") === club)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export default function CoachFeedbackPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [feedbackByEvent, setFeedbackByEvent] = useState<ClubFeedbackRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);

  const [selectedClub, setSelectedClub] = useState<string>("");
  const [authorName, setAuthorName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const clubs = useMemo(() => uniqueClubsFromPlayers(players), [players]);
  const filteredPlayers = useMemo(
    () => (selectedClub ? playersForClub(players, selectedClub) : []),
    [players, selectedClub],
  );
  const comments = useMemo(
    () => (selectedClub ? feedbackForClub(feedbackByEvent, selectedClub) : []),
    [feedbackByEvent, selectedClub],
  );

  const loadFeedbackForEvent = useCallback(async () => {
    const { data, error } = await supabase
      .from("club_feedback")
      .select("id, event_id, home_club, author_name, comment_text, created_at")
      .eq("event_id", LYKKECUP_EVENT_ID)
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError((prev) => prev ?? error.message);
      return;
    }
    setFeedbackByEvent((data ?? []) as ClubFeedbackRow[]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoadingBootstrap(true);
      setLoadError(null);

      const { data, error } = await supabase
        .from("players")
        .select("id, name, home_club, age, level")
        .eq("event_id", LYKKECUP_EVENT_ID);

      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
        setPlayers([]);
      } else {
        setPlayers((data ?? []) as PlayerRow[]);
      }

      await loadFeedbackForEvent();
      if (!cancelled) setLoadingBootstrap(false);
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadFeedbackForEvent]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSuccessMsg(null);

    const club = selectedClub.trim();
    const name = authorName.trim();
    const text = commentText.trim();

    if (!club) {
      setSubmitError("Vælg en klub først.");
      return;
    }
    if (!text) {
      setSubmitError("Skriv en kommentar før du sender.");
      return;
    }
    if (!name) {
      setSubmitError("Udfyld dit navn.");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase
      .from("club_feedback")
      .insert({
        event_id: LYKKECUP_EVENT_ID,
        home_club: club,
        author_name: name,
        comment_text: text,
      })
      .select("id, event_id, home_club, author_name, comment_text, created_at")
      .single();

    setSubmitting(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }

    setCommentText("");
    setSuccessMsg("Tak — din kommentar er gemt.");
    window.setTimeout(() => setSuccessMsg(null), 5000);

    if (data) {
      setFeedbackByEvent((prev) => [data as ClubFeedbackRow, ...prev]);
    } else {
      await loadFeedbackForEvent();
    }
  }

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4 py-10 pb-8 sm:px-6 sm:py-14">
      <header className="mb-10 sm:mb-12">
        {/* Mobil: fuld bredde header-billede (1920×800) */}
        <div className="relative left-1/2 mb-8 w-screen max-w-[100vw] -translate-x-1/2 lg:hidden">
          <div className="relative aspect-[1920/800] w-full overflow-hidden bg-gray-200">
            <img
              src="/lykkecup_app_header.jpg"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>
        </div>

        {/* Desktop: LykkeCup-logo centreret øverst — tydelig størrelse, uden ramme */}
        <div className="mb-8 hidden justify-center px-2 lg:mb-10 lg:flex">
          <img
            src="/LykkeCUP26_blue.svg"
            alt="LykkeCup 2026"
            className="h-auto w-full max-w-[min(100%,17rem)] object-contain object-center sm:max-w-[19rem] lg:max-w-[22rem] xl:max-w-[26rem]"
          />
        </div>

        <div className="border-b border-gray-200/80 pb-8 text-center lg:border-0 lg:pb-0 lg:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-[1.65rem]">
            Kommentarer fra trænere
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-gray-600 lg:mx-0">
            Nu nærmer tiden sig for LykkeCup 2026. For at sikre den bedste oplevelse for alle har du nu mulighed
            for at skrive kommentarer til dit hold og dine spillere før vi laver turneringsplanen.
          </p>
        </div>
      </header>

      {loadError ? (
        <div
          className="mb-8 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}

      <section className="mb-8 rounded-2xl border border-gray-200/95 bg-white p-5 shadow-sm sm:p-6">
        <label htmlFor="club-select" className="block text-sm font-medium text-gray-800">
          Klub
        </label>
        <StyledSelect
          id="club-select"
          wrapperClassName="mt-2"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[15px] text-gray-900 shadow-sm outline-none ring-teal-500/20 transition focus:border-teal-500 focus:ring-4 disabled:opacity-60"
          value={selectedClub}
          onChange={(e) => setSelectedClub(e.target.value)}
          disabled={loadingBootstrap}
        >
          <option value="">{loadingBootstrap ? "Indlæser klubber …" : "Vælg klub"}</option>
          {clubs.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </StyledSelect>
        {!loadingBootstrap && clubs.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Der er ingen klubber registreret for dette arrangement.</p>
        ) : null}
      </section>

      {selectedClub ? (
        <>
          <section className="mb-8 rounded-2xl border border-gray-200/95 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-gray-900">Tilmeldte spillere</h2>
            {filteredPlayers.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">Ingen spillere fundet for denne klub.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200/90 shadow-sm">
                <table className="w-full min-w-[280px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2.5 font-medium text-gray-700">Navn</th>
                      <th className="px-3 py-2.5 font-medium text-gray-700">Alder</th>
                      <th className="px-3 py-2.5 font-medium text-gray-700">Niveau</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((p, index) => (
                      <tr
                        key={p.id}
                        className={
                          (index % 2 === 0 ? "bg-white" : "bg-emerald-50/70") +
                          (index < filteredPlayers.length - 1 ? " border-b border-gray-100/90" : "")
                        }
                      >
                        <td className="px-3 py-2.5 font-medium text-gray-900">{p.name}</td>
                        <td className="px-3 py-2.5 text-gray-600">
                          {p.age != null && !Number.isNaN(p.age) ? p.age : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600">{p.level?.trim() || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mb-8 rounded-2xl border border-gray-200/95 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-gray-900">Tidligere kommentarer</h2>
            {comments.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-6 text-center text-sm text-gray-500">
                Der er endnu ingen kommentarer fra jeres klub. Skriv den første nedenfor.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {comments.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-gray-100 bg-gray-50/40 px-4 py-3.5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">{c.author_name}</span>
                      <time
                        className="text-xs text-gray-500 tabular-nums"
                        dateTime={c.created_at}
                      >
                        {formatDaDateTime(c.created_at)}
                      </time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                      {c.comment_text}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200/95 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-gray-900">Skriv en kommentar</h2>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="author" className="block text-sm font-medium text-gray-800">
                  Dit navn
                </label>
                <input
                  id="author"
                  type="text"
                  autoComplete="name"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[15px] shadow-sm outline-none ring-teal-500/20 focus:border-teal-500 focus:ring-4"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div>
                <label htmlFor="comment" className="block text-sm font-medium text-gray-800">
                  Kommentar
                </label>
                <textarea
                  id="comment"
                  rows={5}
                  className="mt-1.5 w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-[15px] leading-relaxed shadow-sm outline-none ring-teal-500/20 focus:border-teal-500 focus:ring-4"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {submitError ? (
                <p className="text-sm text-red-700" role="alert">
                  {submitError}
                </p>
              ) : null}
              {successMsg ? (
                <p className="text-sm font-medium text-teal-800" role="status">
                  {successMsg}
                </p>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[160px]"
                disabled={submitting || !selectedClub}
              >
                {submitting ? "Sender …" : "Send kommentar"}
              </button>
            </form>
          </section>
        </>
      ) : null}

      <footer className="mt-auto border-t border-gray-200/90 pt-10 pb-6 dark:border-gray-700">
        <div className="flex justify-center">
          <img
            src="/lykkeliga-logo.svg"
            alt="Lykkeliga"
            className="h-5 w-auto max-w-[6.5rem] object-contain opacity-90 sm:h-6 sm:max-w-[7rem]"
          />
        </div>
      </footer>
    </main>
  );
}
