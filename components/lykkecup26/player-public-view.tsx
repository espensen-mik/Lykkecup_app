import { ArrowLeft, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { Lc26PlayerHeroCard } from "@/components/lykkecup26/lc26-player-hero-card";
import { formatDaTimeOnly } from "@/lib/datetime";
import { formatLevelShortLabel } from "@/lib/holddannelse";
import type { Lc26PlayerPageData, Lc26PublicMatch } from "@/lib/lykkecup26-public";

type Props = {
  data: Lc26PlayerPageData;
  currentPlayerId: string;
};

const sectionTitle = "text-lg font-semibold tracking-[-0.02em] text-lc26-navy";

function matchLocationLabel(match: Lc26PublicMatch): string | null {
  const court = match.courtName?.trim();
  const venue = match.venueName?.trim();
  if (court && venue) return `${court}, ${venue}`;
  if (court) return court;
  if (venue) return venue;
  return null;
}

function MatchScheduleCard({ match }: { match: Lc26PublicMatch }) {
  const timeLabel = match.startTime ? formatDaTimeOnly(match.startTime) : null;
  const locationLabel = matchLocationLabel(match);

  return (
    <li className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-100/80">
      <div className="absolute inset-y-0 left-0 w-1 bg-lc26-teal" aria-hidden />

      <div className="px-4 py-4 pl-5 sm:px-5 sm:py-[1.125rem] sm:pl-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-lc26-navy/40">Kamp mod</p>
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
}

export function PlayerPublicView({ data, currentPlayerId }: Props) {
  const { player, team, teammates, coaches, matches, error } = data;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-red-200/90 bg-red-50/95 px-5 py-4 text-sm text-red-950">
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
      <Lc26PlayerHeroCard
        playerName={player.name}
        homeClub={player.home_club?.trim() || null}
        currentPlayerId={currentPlayerId}
      />

      {!team ? (
        <div className="rounded-2xl border border-lc26-teal/20 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-base font-medium leading-snug text-lc26-navy">Du er ikke tilknyttet et hold endnu</p>
          <p className="mx-auto mt-2 max-w-[22rem] text-sm leading-relaxed text-lc26-navy/50">
            Når dit hold er registreret, vises det automatisk her — med holdkammerater, trænere og kampe.
          </p>
        </div>
      ) : (
        <>
          <section className="mb-10">
            <h2 className={sectionTitle}>Dit hold til LykkeCup 26</h2>
            <div className="mt-4 rounded-2xl border border-lc26-navy/90 bg-lc26-navy px-5 py-5 shadow-[0_14px_40px_-14px_rgb(22_51_88/0.65)] ring-1 ring-white/10 sm:px-6 sm:py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Hold</p>
              <p className="mt-2 text-balance text-2xl font-semibold tracking-[-0.02em] text-white sm:text-[1.65rem]">
                {team.name}
              </p>
              {team.level?.trim() ? (
                <p className="mt-3 border-t border-white/15 pt-3 text-sm leading-snug text-white/75">{formatLevelShortLabel(team.level)}</p>
              ) : null}
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-base font-semibold tracking-[-0.02em] text-lc26-navy">Holdkammerater</h3>
            {teammates.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-lc26-teal/25 bg-stone-50/80 px-5 py-8 text-center">
                <p className="text-sm font-medium text-lc26-navy/70">Ingen holdkammerater endnu</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-lc26-navy/45">
                  Når holdet er fuldt, vises alle spillere her.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {teammates.map((t) => {
                  const isSelf = t.id === currentPlayerId;
                  return (
                    <li
                      key={t.id}
                      className={`flex flex-wrap items-baseline justify-between gap-2 rounded-xl border px-4 py-3.5 ${
                        isSelf
                          ? "border-lc26-teal/40 bg-lc26-teal/[0.06]"
                          : "border-stone-200/90 bg-white shadow-sm"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-lc26-navy">
                          {t.name}
                          {isSelf ? (
                            <span className="ml-2 rounded-full bg-lc26-teal/15 px-2 py-0.5 text-xs font-semibold text-lc26-teal">
                              Dig
                            </span>
                          ) : null}
                        </span>
                        <p className="mt-1 text-sm text-lc26-navy/50">
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
            <h3 className="text-base font-semibold tracking-[-0.02em] text-lc26-navy">Trænere</h3>
            {coaches.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-lc26-navy/25 bg-lc26-navy/[0.04] px-5 py-8 text-center">
                <p className="text-sm font-medium text-lc26-navy/70">Ingen trænere registreret endnu</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-lc26-navy/45">
                  Navne på trænere vises her, når de er tilføjet til holdet.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {coaches.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-lc26-navy/15 bg-lc26-navy/[0.055] px-4 py-3.5 text-lc26-navy shadow-[inset_0_1px_0_0_rgb(255_255_255/0.35)]"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-lc26-navy/40">Træner</p>
                    <span className="mt-0.5 block font-medium">{c.name}</span>
                    {c.home_club?.trim() ? (
                      <span className="mt-1 block text-sm text-lc26-navy/52">{c.home_club.trim()}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="mb-8">
        <h2 className={sectionTitle}>Dit kampprogram</h2>
        <p className="mt-1 text-sm text-lc26-navy/50">Dine kampe med tid og bane</p>
        {!team ? (
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-lc26-navy/75">Kommer snart</p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-lc26-navy/45">
              Når du er på et hold, vises dine kampe her med tid og bane.
            </p>
          </div>
        ) : matches.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-lc26-teal/20 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-[15px] font-medium text-lc26-navy">Ingen kampe endnu</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-lc26-navy/48">
              Når kampene er lagt ind, ser du modstander, klokkeslæt og bane her.
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {matches.map((m) => (
              <MatchScheduleCard key={m.id} match={m} />
            ))}
          </ul>
        )}
      </section>

      <div className="pt-6 text-center">
        <Link
          href="/lykkecup26"
          className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-lc26-teal transition hover:bg-lc26-teal/10 active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          Tilbage til forsiden
        </Link>
      </div>
    </div>
  );
}
