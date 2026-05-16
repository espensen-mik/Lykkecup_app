import { ArrowLeft, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { Lc26SavedPlayerControls } from "@/components/lykkecup26/lc26-saved-player-controls";
import { formatDaTimeOnly } from "@/lib/datetime";
import type { Lc26PlayerPageData, Lc26PublicMatch } from "@/lib/lykkecup26-public";

type Props = {
  data: Lc26PlayerPageData;
  currentPlayerId: string;
};

const sectionTitle = "text-lg font-semibold tracking-[-0.02em] text-lc26-navy";

function matchLocationParts(match: Lc26PublicMatch): { primary: string; secondary: string | null } {
  const court = match.courtName?.trim();
  const venue = match.venueName?.trim();
  if (court && venue) return { primary: court, secondary: venue };
  if (court) return { primary: court, secondary: null };
  if (venue) return { primary: venue, secondary: null };
  return { primary: "", secondary: null };
}

function MatchScheduleCard({ match }: { match: Lc26PublicMatch }) {
  const timeLabel = match.startTime ? formatDaTimeOnly(match.startTime) : null;
  const { primary: locationPrimary, secondary: locationSecondary } = matchLocationParts(match);
  const hasLocation = Boolean(locationPrimary);

  return (
    <li className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_6px_28px_-14px_rgb(22_51_88/0.22)]">
      <div className="border-b border-stone-100 px-4 py-3.5 sm:px-5 sm:py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-lc26-navy/45">Modstander</p>
        <p className="mt-0.5 text-balance text-lg font-semibold leading-snug tracking-[-0.02em] text-lc26-navy sm:text-xl">
          {match.opponentTeamName}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-stone-200/90">
        <div className="flex min-h-[5.5rem] flex-col justify-between bg-gradient-to-b from-lc26-teal/[0.14] to-lc26-teal/[0.06] px-3.5 py-3.5 sm:min-h-[6rem] sm:px-4 sm:py-4">
          <div className="flex items-center gap-1.5 text-lc26-teal">
            <Clock className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Hvornår</span>
          </div>
          {timeLabel ? (
            <p className="mt-2 text-[1.75rem] font-bold leading-none tracking-tight text-lc26-navy tabular-nums sm:text-[2rem]">
              kl. {timeLabel}
            </p>
          ) : (
            <p className="mt-2 text-sm font-medium leading-snug text-lc26-navy/55">Tid kommer senere</p>
          )}
        </div>

        <div className="flex min-h-[5.5rem] flex-col justify-between bg-stone-50/80 px-3.5 py-3.5 sm:min-h-[6rem] sm:px-4 sm:py-4">
          <div className="flex items-center gap-1.5 text-lc26-navy/55">
            <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Hvor</span>
          </div>
          {hasLocation ? (
            <div>
              <p className="mt-2 text-balance text-lg font-bold leading-tight tracking-[-0.02em] text-lc26-navy sm:text-xl">
                {locationPrimary}
              </p>
              {locationSecondary ? (
                <p className="mt-0.5 text-sm font-medium leading-snug text-lc26-navy/58">{locationSecondary}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm font-medium leading-snug text-lc26-navy/55">Bane kommer senere</p>
          )}
        </div>
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
      <div className="mb-10 rounded-2xl border border-lc26-teal/75 bg-lc26-teal p-5 shadow-[0_14px_34px_-18px_rgb(0_161_130/0.9)] sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">LykkeCup 26</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]">{player.name}</h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-white/90">Håndboldstjerne</p>
        {player.home_club?.trim() ? <p className="mt-1 text-base leading-snug text-white/85">{player.home_club.trim()}</p> : null}
        <div className="mt-6">
          <Lc26SavedPlayerControls
            kind="player"
            entityId={currentPlayerId}
            entityName={player.name}
            tone="inverse"
            accent="teal"
          />
        </div>
      </div>

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
                <p className="mt-3 border-t border-white/15 pt-3 text-sm leading-snug text-white/75">{team.level.trim()}</p>
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
              <ul className="mt-4 space-y-4">
            {matches.map((m) => (
              <MatchScheduleCard key={m.id} match={m} />
            ))}
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
          <ul className="mt-4 space-y-4">
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
