import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { formatDaDateTime } from "@/lib/datetime";
import type { Lc26PlayerPageData } from "@/lib/lykkecup26-public";

type Props = {
  data: Lc26PlayerPageData;
  currentPlayerId: string;
};

export function PlayerPublicView({ data, currentPlayerId }: Props) {
  const { player, team, teammates, coaches, matches, error } = data;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-red-200 bg-red-50/90 px-5 py-4 text-sm text-red-900">
          Noget gik galt ved indlæsning. Prøv igen senere.
        </div>
      </div>
    );
  }

  if (!player) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700/90">LykkeCup 26</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] text-stone-900 sm:text-[2rem]">
          {player.name}
        </h1>
        {player.home_club?.trim() ? (
          <p className="mt-2 text-base leading-snug text-stone-600">{player.home_club.trim()}</p>
        ) : null}
      </div>

      {!team ? (
        <div className="rounded-3xl border border-amber-200/85 bg-amber-50/55 px-6 py-8 text-center shadow-[0_8px_28px_-12px_rgb(180_83_9/0.2)]">
          <p className="text-base font-medium leading-snug text-amber-950">Du er ikke tilknyttet et hold endnu.</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/85">
            Når dit hold er registreret, vises det automatisk her.
          </p>
        </div>
      ) : (
        <>
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-stone-900">Dit hold til LykkeCup 26</h2>
            <div className="mt-4 rounded-3xl border border-stone-200/90 bg-white p-6 shadow-[0_12px_40px_-16px_rgba(15,118,110,0.15)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Hold</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-teal-900">{team.name}</p>
              {team.level?.trim() ? (
                <p className="mt-1 text-sm text-stone-600">{team.level.trim()}</p>
              ) : null}
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-base font-semibold text-stone-900">Holdkammerater</h3>
            {teammates.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">Ingen spillere fundet på holdet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {teammates.map((t) => {
                  const isSelf = t.id === currentPlayerId;
                  return (
                    <li
                      key={t.id}
                      className={`flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border px-4 py-3.5 ${
                        isSelf
                          ? "border-teal-300/60 bg-teal-50/60"
                          : "border-stone-200/90 bg-white shadow-sm"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-stone-900">
                          {t.name}
                          {isSelf ? (
                            <span className="ml-2 rounded-full bg-teal-600/15 px-2 py-0.5 text-xs font-semibold text-teal-900">
                              Dig
                            </span>
                          ) : null}
                        </span>
                        <p className="mt-1 text-sm text-stone-600">
                          {t.home_club?.trim() || "—"} ·{" "}
                          {t.age != null && !Number.isNaN(t.age) ? `${t.age} år` : "Alder —"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mb-10">
            <h3 className="text-base font-semibold text-stone-900">Trænere</h3>
            {coaches.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-stone-200 bg-stone-50/80 px-5 py-6 text-center text-sm text-stone-600">
                Ingen trænere registreret på holdet endnu.
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {coaches.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-stone-200/90 bg-white px-4 py-3 text-stone-900 shadow-sm"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.home_club?.trim() ? (
                      <span className="mt-0.5 block text-sm text-stone-600">{c.home_club.trim()}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-900">Dit kampprogram</h2>
        {!team ? (
          <p className="mt-3 text-sm text-stone-500">Når du er på et hold, vises dine kampe her.</p>
        ) : matches.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-stone-200/80 bg-gradient-to-b from-white to-stone-50/80 px-6 py-12 text-center shadow-sm">
            <p className="text-[15px] font-medium text-stone-700">Ingen kampe endnu</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
              Når kampene er lagt ind, ser du modstander, tid og bane her.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {matches.map((m) => (
              <li
                key={m.id}
                className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm sm:p-5"
              >
                <p className="font-semibold text-stone-900">mod {m.opponentTeamName}</p>
                <div className="mt-2 space-y-1 text-sm text-stone-600">
                  {m.startTime ? (
                    <p>
                      <span className="text-stone-500">Tid: </span>
                      {formatDaDateTime(m.startTime)}
                    </p>
                  ) : (
                    <p className="text-stone-500">Tid kommer senere</p>
                  )}
                  {(m.venueName || m.courtName) && (
                    <p>
                      <span className="text-stone-500">Sted: </span>
                      {[m.venueName, m.courtName].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pt-6 text-center">
        <Link
          href="/lykkecup26"
          className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-teal-900 transition hover:bg-teal-500/10 active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          Tilbage til forsiden
        </Link>
      </div>
    </div>
  );
}
