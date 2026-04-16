import type { Metadata } from "next";
import { PrintTeamsButton } from "@/components/print/print-teams-button";
import { fetchTeamsPrintData } from "@/lib/holddannelse";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Print — Hold",
  description: "Udskriv oversigt over hold, spillere og trænere",
};

type PageProps = {
  searchParams: Promise<{ level?: string }>;
};

export default async function PrintTeamsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const levelFilter = typeof sp.level === "string" && sp.level.trim() !== "" ? sp.level : null;

  const { groups, error } = await fetchTeamsPrintData(levelFilter);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 text-base text-black">
        <p>Kunne ikke indlæse data: {error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-[15px] leading-relaxed text-black">
      <PrintTeamsButton />

      <header className="mb-8 border-b border-black pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Hold</h1>
        <p className="print:hidden mt-2 text-sm text-neutral-600">
          {levelFilter ? `Niveau: ${levelFilter}` : "Alle niveauer"}
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="text-base">Ingen hold at vise.</p>
      ) : (
        groups.map((g) => (
          <section key={g.levelKey} className="mb-12 last:mb-0">
            <h2 className="mb-8 border-b-2 border-black pb-2 text-lg font-bold uppercase tracking-wide">
              {g.levelKey}
            </h2>
            <div className="space-y-0">
              {g.teams.map((entry) => (
                <article key={entry.team.id} className="print-team border-b border-neutral-300 py-6 last:border-b-0">
                  <h3 className="mb-4 text-xl font-semibold">{entry.team.name}</h3>

                  <div className="mb-5">
                    <p className="mb-2 text-sm font-semibold uppercase tracking-wide">Trænere</p>
                    {entry.coaches.length === 0 ? (
                      <p className="text-base">—</p>
                    ) : (
                      <ul className="list-none space-y-1 pl-0">
                        {entry.coaches.map((c, ci) => (
                          <li key={`${entry.team.id}-c-${ci}`} className="text-base">
                            — {c.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold uppercase tracking-wide">Spillere</p>
                    {entry.players.length === 0 ? (
                      <p className="text-base">—</p>
                    ) : (
                      <ol className="list-decimal space-y-1 pl-6 marker:text-base">
                        {entry.players.map((p, i) => (
                          <li key={`${entry.team.id}-p-${i}`} className="pl-1 text-base">
                            {p.name} ({p.club})
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
