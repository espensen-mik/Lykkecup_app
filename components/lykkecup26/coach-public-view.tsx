import Link from "next/link";
import { Lc26SavedPlayerControls } from "@/components/lykkecup26/lc26-saved-player-controls";
import type { Lc26CoachPageData } from "@/lib/lykkecup26-public";

type Props = {
  data: Lc26CoachPageData;
  currentCoachId: string;
};

export function CoachPublicView({ data, currentCoachId }: Props) {
  const { coach, teams, error } = data;

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

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lc26-teal">LykkeCup 26</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] text-lc26-navy sm:text-[2rem]">
          {coach.name}
        </h1>
        <p className="mt-2 text-base leading-snug text-lc26-navy/55">{coach.home_club?.trim() || "Træner"}</p>
      </div>

      <Lc26SavedPlayerControls kind="coach" entityId={currentCoachId} entityName={coach.name} />

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
              <li key={team.id} className="rounded-xl border border-stone-200/90 bg-white px-4 py-3.5 shadow-sm">
                <p className="font-semibold text-lc26-navy">{team.name}</p>
                {team.level?.trim() ? <p className="mt-1 text-sm text-lc26-navy/50">{team.level.trim()}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pt-4 text-center">
        <Link
          href="/lykkecup26"
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-lc26-teal transition hover:bg-lc26-teal/10"
        >
          ← Tilbage til forsiden
        </Link>
      </div>
    </div>
  );
}
