import { ArrowLeft, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { Lc26ProfileHeroCard } from "@/components/lykkecup26/lc26-profile-hero-card";
import { formatDaTimeOnly } from "@/lib/datetime";
import { formatLevelShortLabel } from "@/lib/holddannelse";
import type { Lc26CoachPageData, Lc26CoachScheduledMatch } from "@/lib/lykkecup26-public";

type Props = {
  data: Lc26CoachPageData;
  currentCoachId: string;
};

export function CoachPublicView({ data, currentCoachId }: Props) {
  const { coach, teams, teamDetails, matches, error } = data;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-red-200/90 bg-red-50/95 px-5 py-4 text-sm text-red-950">
          Noget gik galt ved indlæsning. Prøv igen senere.
        </div>
      </div>
    );
  }

  if (!coach) return null;

  function matchLocationLabel(match: Lc26CoachScheduledMatch): string | null {
    const court = match.courtName?.trim();
    const venue = match.venueName?.trim();
    if (court && venue) return `${court}, ${venue}`;
    if (court) return court;
    if (venue) return venue;
    return null;
  }

  const teamDetailsById = new Map(teamDetails.map((t) => [t.teamId, t] as const));

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <Lc26ProfileHeroCard
        title={coach.name}
        subtitle="Cheftræner"
        detail={coach.home_club?.trim() || "Træner"}
        saveKind="coach"
        entityId={currentCoachId}
        entityName={coach.name}
        accent="navy"
      />

      <section className="mb-8">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-lc26-navy">Dine hold i LykkeCup 26</h2>
        {teams.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-[15px] font-medium text-lc26-navy">Ingen hold endnu</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-lc26-navy/48">
              Når du er tilknyttet et hold, vises det her.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {teams.map((team) => (
              <li
                key={team.id}
                className="rounded-2xl border border-lc26-navy/90 bg-lc26-navy px-5 py-4 shadow-[0_12px_36px_-14px_rgb(22_51_88/0.6)] ring-1 ring-white/10 sm:px-6 sm:py-5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">Hold</p>
                <p className="mt-1.5 text-balance text-xl font-semibold tracking-tight text-white sm:text-[1.35rem]">
                  {team.name}
                </p>
                {team.level?.trim() ? (
                  <p className="mt-2.5 border-t border-white/15 pt-2.5 text-sm leading-snug text-white/72">
                    {formatLevelShortLabel(team.level)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {teams.length > 0 ? (
        <section className="mb-10">
          <h3 className="text-base font-semibold tracking-[-0.02em] text-lc26-navy">Spillere og trænere på dine hold</h3>
          <div className="mt-4 space-y-5">
            {teams.map((team) => {
              const details = teamDetailsById.get(team.id);
              const players = details?.players ?? [];
              const coaches = details?.coaches ?? [];
              return (
                <article key={team.id} className="rounded-2xl border border-lc26-teal/20 bg-white p-4 shadow-sm sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lc26-teal">
                    {team.name}
                  </p>

                  <div className="mt-4">
                    <p className="text-sm font-semibold tracking-[-0.01em] text-lc26-navy">Spillere</p>
                    {players.length === 0 ? (
                      <p className="mt-2 text-sm text-lc26-navy/55">Ingen spillere registreret endnu.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {players.map((p) => (
                          <li key={p.id} className="rounded-xl border border-stone-200/90 bg-white px-4 py-3 shadow-sm">
                            <span className="font-medium text-lc26-navy">{p.name}</span>
                            <p className="mt-1 text-sm text-lc26-navy/50">
                              {p.home_club?.trim() || "—"} · {p.age != null && !Number.isNaN(p.age) ? `${p.age} år` : "Alder —"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-4 border-t border-stone-100 pt-4">
                    <p className="text-sm font-semibold tracking-[-0.01em] text-lc26-navy">Trænere</p>
                    {coaches.length === 0 ? (
                      <p className="mt-2 text-sm text-lc26-navy/55">Ingen trænere registreret endnu.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {coaches.map((c) => {
                          const isSelf = c.id === currentCoachId;
                          return (
                            <li
                              key={c.id}
                              className={`rounded-xl border px-4 py-3 ${
                                isSelf
                                  ? "border-lc26-teal/40 bg-lc26-teal/[0.06]"
                                  : "border-stone-200/90 bg-white shadow-sm"
                              }`}
                            >
                              <span className="font-medium text-lc26-navy">
                                {c.name}
                                {isSelf ? (
                                  <span className="ml-2 rounded-full bg-lc26-teal/15 px-2 py-0.5 text-xs font-semibold text-lc26-teal">
                                    Dig
                                  </span>
                                ) : null}
                              </span>
                              {c.home_club?.trim() ? (
                                <p className="mt-1 text-sm text-lc26-navy/50">{c.home_club.trim()}</p>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-lc26-navy">Dit kampprogram</h2>
        <p className="mt-1 text-sm text-lc26-navy/50">Kampe med tid og bane for dine hold</p>
        {teams.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-lc26-navy/75">Kommer snart</p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-lc26-navy/45">
              Når du bliver tilknyttet et hold, vises kampene her med tid og bane.
            </p>
          </div>
        ) : matches.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-lc26-teal/20 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-[15px] font-medium text-lc26-navy">Ingen kampe endnu</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-lc26-navy/48">
              Når kampene er lagt ind, ser du hold, modstander, klokkeslæt og bane her.
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {matches.map((match) => {
              const timeLabel = match.startTime ? formatDaTimeOnly(match.startTime) : null;
              const locationLabel = matchLocationLabel(match);
              return (
                <li key={match.id} className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-100/80">
                  <div className="absolute inset-y-0 left-0 w-1 bg-lc26-teal" aria-hidden />
                  <div className="px-4 py-4 pl-5 sm:px-5 sm:py-[1.125rem] sm:pl-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-lc26-navy/40">
                      {match.ownTeamName} mod
                    </p>
                    <p className="mt-1 text-balance text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em] text-lc26-navy sm:text-lg">
                      {match.opponentTeamName}
                    </p>

                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 sm:gap-4">
                      <div className="min-w-0">
                        <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-lc26-teal">
                          <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                          Hvornår
                        </dt>
                        <dd className="mt-1.5">
                          {timeLabel ? (
                            <span className="text-[1.125rem] font-bold leading-none tracking-tight text-lc26-navy tabular-nums sm:text-xl">
                              kl. {timeLabel}
                            </span>
                          ) : (
                            <span className="text-sm font-medium text-lc26-navy/50">Kommer senere</span>
                          )}
                        </dd>
                      </div>

                      <div className="min-w-0 border-l border-stone-100 pl-3 sm:pl-4">
                        <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-lc26-navy/45">
                          <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                          Hvor
                        </dt>
                        <dd className="mt-1.5">
                          {locationLabel ? (
                            <span className="block text-balance text-[1.0625rem] font-bold leading-snug tracking-[-0.01em] text-lc26-navy sm:text-lg">
                              {locationLabel}
                            </span>
                          ) : (
                            <span className="text-sm font-medium text-lc26-navy/50">Kommer senere</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="pt-4 text-center">
        <Link
          href="/lykkecup26"
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-lc26-teal transition hover:bg-lc26-teal/10"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          Tilbage til forsiden
        </Link>
      </div>
    </div>
  );
}
