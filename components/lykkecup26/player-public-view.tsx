import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Lc26SavedPlayerControls } from "@/components/lykkecup26/lc26-saved-player-controls";
import { formatDaDateTime } from "@/lib/datetime";
import type { Lc26PlayerPageData } from "@/lib/lykkecup26-public";

type Props = {
  data: Lc26PlayerPageData;
  currentPlayerId: string;
};

const sectionTitle = "text-lg font-semibold tracking-[-0.02em] text-lc26-navy";

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
            <div className="mt-4 rounded-2xl border border-stone-200/90 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lc26-teal">Hold</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-lc26-teal">{team.name}</p>
              {team.level?.trim() ? (
                <p className="mt-1 text-sm text-lc26-navy/55">{team.level.trim()}</p>
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
              <div className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50/80 px-5 py-8 text-center">
                <p className="text-sm font-medium text-lc26-navy/65">Ingen trænere registreret endnu</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-lc26-navy/42">
                  Navne på trænere vises her, når de er tilføjet til holdet.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {coaches.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-stone-200/90 bg-white px-4 py-3 text-lc26-navy shadow-sm"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.home_club?.trim() ? (
                      <span className="mt-0.5 block text-sm text-lc26-navy/50">{c.home_club.trim()}</span>
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
              Når kampene er lagt ind, ser du modstander, tid og bane her.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {matches.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm sm:p-5"
              >
                <p className="font-semibold text-lc26-navy">mod {m.opponentTeamName}</p>
                <div className="mt-2 space-y-1 text-sm text-lc26-navy/55">
                  {m.startTime ? (
                    <p>
                      <span className="text-lc26-navy/38">Tid: </span>
                      {formatDaDateTime(m.startTime)}
                    </p>
                  ) : (
                    <p className="text-lc26-navy/45">Tid kommer senere</p>
                  )}
                  {(m.venueName || m.courtName) && (
                    <p>
                      <span className="text-lc26-navy/38">Sted: </span>
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
          className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-lc26-teal transition hover:bg-lc26-teal/10 active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          Tilbage til forsiden
        </Link>
      </div>
    </div>
  );
}
