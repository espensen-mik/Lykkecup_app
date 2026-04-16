import { ArrowLeft, Calendar } from "lucide-react";
import Link from "next/link";
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
      <div className="mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lc26-teal">LykkeCup 26</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[2rem]">
          {player.name}
        </h1>
        {player.home_club?.trim() ? (
          <p className="mt-2 text-base leading-snug text-lc26-navy/58">{player.home_club.trim()}</p>
        ) : null}
      </div>

      {!team ? (
        <div className="rounded-[1.65rem] border border-lc26-teal/12 bg-gradient-to-b from-white/90 to-lc26-mint/30 px-6 py-9 text-center shadow-[0_14px_48px_-22px_rgb(22_51_88/0.14)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-lc26-mint/55 text-lc26-teal shadow-[inset_0_1px_0_0_rgb(255_255_255/0.6)]">
            <Calendar className="h-5 w-5" strokeWidth={1.65} aria-hidden />
          </div>
          <p className="text-base font-medium leading-snug text-lc26-navy">Du er ikke tilknyttet et hold endnu</p>
          <p className="mx-auto mt-2 max-w-[22rem] text-sm leading-relaxed text-lc26-navy/52">
            Når dit hold er registreret, vises det automatisk her — med holdkammerater, trænere og kampe.
          </p>
        </div>
      ) : (
        <>
          <section className="mb-10">
            <h2 className={sectionTitle}>Dit hold til LykkeCup 26</h2>
            <div className="mt-4 rounded-[1.65rem] border border-lc26-navy/[0.08] bg-white/90 p-6 shadow-[0_14px_48px_-22px_rgb(22_51_88/0.12)] backdrop-blur-[1px]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lc26-navy/42">Hold</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-lc26-teal">{team.name}</p>
              {team.level?.trim() ? (
                <p className="mt-1 text-sm text-lc26-navy/55">{team.level.trim()}</p>
              ) : null}
            </div>
          </section>

          <section className="mb-10">
            <h3 className="text-base font-semibold tracking-[-0.02em] text-lc26-navy">Holdkammerater</h3>
            {teammates.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-lc26-teal/22 bg-lc26-mint/20 px-5 py-8 text-center">
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
                      className={`flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border px-4 py-3.5 ${
                        isSelf
                          ? "border-lc26-teal/35 bg-lc26-mint/35 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.5)]"
                          : "border-lc26-navy/[0.08] bg-white/90 shadow-sm"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-lc26-navy">
                          {t.name}
                          {isSelf ? (
                            <span className="ml-2 rounded-full bg-lc26-teal/12 px-2 py-0.5 text-xs font-semibold text-lc26-teal">
                              Dig
                            </span>
                          ) : null}
                        </span>
                        <p className="mt-1 text-sm text-lc26-navy/52">
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
              <div className="mt-4 rounded-2xl border border-dashed border-lc26-navy/[0.12] bg-white/50 px-5 py-8 text-center">
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
                    className="rounded-2xl border border-lc26-navy/[0.08] bg-white/90 px-4 py-3 text-lc26-navy shadow-sm"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.home_club?.trim() ? (
                      <span className="mt-0.5 block text-sm text-lc26-navy/52">{c.home_club.trim()}</span>
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
          <div className="mt-4 rounded-[1.5rem] border border-lc26-navy/[0.07] bg-lc26-mint/22 px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-lc26-teal shadow-sm">
              <Calendar className="h-[18px] w-[18px]" strokeWidth={1.65} aria-hidden />
            </div>
            <p className="text-sm font-medium text-lc26-navy/72">Kommer snart</p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-lc26-navy/45">
              Når du er på et hold, vises dine kampe her med tid og bane.
            </p>
          </div>
        ) : matches.length === 0 ? (
          <div className="mt-4 rounded-[1.65rem] border border-lc26-teal/12 bg-gradient-to-b from-white/95 to-lc26-mint/28 px-6 py-12 text-center shadow-[0_12px_44px_-20px_rgb(22_51_88/0.12)]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-lc26-mint/50 text-lc26-teal">
              <Calendar className="h-6 w-6" strokeWidth={1.5} aria-hidden />
            </div>
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
                className="rounded-2xl border border-lc26-navy/[0.08] bg-white/92 p-4 shadow-sm sm:p-5"
              >
                <p className="font-semibold text-lc26-navy">mod {m.opponentTeamName}</p>
                <div className="mt-2 space-y-1 text-sm text-lc26-navy/58">
                  {m.startTime ? (
                    <p>
                      <span className="text-lc26-navy/40">Tid: </span>
                      {formatDaDateTime(m.startTime)}
                    </p>
                  ) : (
                    <p className="text-lc26-navy/45">Tid kommer senere</p>
                  )}
                  {(m.venueName || m.courtName) && (
                    <p>
                      <span className="text-lc26-navy/40">Sted: </span>
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
          className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-lc26-teal transition hover:bg-lc26-mint/40 active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          Tilbage til forsiden
        </Link>
      </div>
    </div>
  );
}
