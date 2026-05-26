"use client";

import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { GenerationProgress } from "@/components/ui/generation-progress";
import { KampprogramScheduleFollowUp } from "@/components/scheduling/scheduling-summary-banner";
import {
  clearAllTournamentMatchesAction,
  generateAllPoolMatchesForLevelAction,
} from "@/lib/turnering-actions";

type Props = {
  levelKeys: readonly string[];
  totalMatchCount: number;
};

type ProgressState = {
  step: number;
  total: number;
  label: string;
  detail?: string;
};

export function PlanOverviewActions({ levelKeys, totalMatchCount }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [lastUnscheduled, setLastUnscheduled] = useState(0);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [postScheduleChecks, setPostScheduleChecks] = useState<{
    courtConflicts: number;
    teamRestWarnings: number;
    teamsSpanningPeriods: number;
  } | null>(null);

  const runGenerate = useCallback(
    async (regenerate: boolean) => {
      if (levelKeys.length === 0) return;

      setBusy(true);
      setConfirmRegenerate(false);
      setActionMsg(null);
      setPostScheduleChecks(null);

      let totalMatches = 0;
      let scheduled = 0;
      let unscheduled = 0;
      const errors: string[] = [];
      const skippedLevels: string[] = [];
      let levelsProcessed = 0;
      let postScheduleChecksResult: typeof postScheduleChecks = null;

      try {
        if (regenerate) {
          setProgress({
            step: 0,
            total: levelKeys.length,
            label: "Sletter eksisterende kampe…",
            detail: "Forbereder regenerering af hele turneringen",
          });
          const clearResult = await clearAllTournamentMatchesAction();
          if (!clearResult.ok) {
            setActionMsg(clearResult.message);
            return;
          }
        }

        for (let i = 0; i < levelKeys.length; i += 1) {
          const levelKey = levelKeys[i]!;
          const step = i + 1;
          setProgress({
            step,
            total: levelKeys.length,
            label: `Genererer ${levelKey}…`,
            detail: `Niveau ${step} af ${levelKeys.length}`,
          });

          const result = await generateAllPoolMatchesForLevelAction(levelKey, false);
          const levelMatches = result.matchCount ?? 0;
          const levelScheduled = result.scheduled ?? 0;

          if (levelMatches > 0 || levelScheduled > 0) {
            levelsProcessed += 1;
          }
          totalMatches += levelMatches;
          scheduled += levelScheduled;
          unscheduled += Math.max(0, levelMatches - levelScheduled);

          if (!result.ok && result.message) {
            if (result.message.includes("alle puljer har allerede kampe")) {
              skippedLevels.push(levelKey);
            } else {
              errors.push(`${levelKey}: ${result.message}`);
            }
          }
          if (result.postScheduleChecks && step === levelKeys.length) {
            postScheduleChecksResult = result.postScheduleChecks;
          }
        }

        setProgress({
          step: levelKeys.length,
          total: levelKeys.length,
          label: "Færdig",
          detail: `${levelsProcessed} niveau(er) behandlet`,
        });

        if (totalMatches === 0 && errors.length === 0 && skippedLevels.length === levelKeys.length) {
          setActionMsg(
            "Alle niveauer har allerede kampe. Brug knappen igen for at regenerere hele turneringen.",
          );
          return;
        }

        if (totalMatches === 0 && errors.length > 0) {
          setActionMsg(errors.join(" "));
          return;
        }

        const partial = unscheduled > 0 ? ` ${unscheduled} kampe mangler bane/tid.` : "";
        const skipNote =
          skippedLevels.length > 0 ? ` Sprang over (havde kampe): ${skippedLevels.join(", ")}.` : "";
        const errNote = errors.length > 0 ? ` Fejl: ${errors.join(" ")}` : "";

        setActionMsg(
          `Hele turneringen: ${totalMatches} kampe på ${levelsProcessed} niveau(er) — ${scheduled} med bane og tid.${partial}${skipNote}${errNote}${
            unscheduled > 0 ? " Se detaljer på det enkelte niveau." : ""
          }`,
        );
        setLastUnscheduled(unscheduled);
        setPostScheduleChecks(postScheduleChecksResult);

        if (totalMatches > 0 || scheduled > 0) {
          router.refresh();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Ukendt fejl";
        setActionMsg(`Kunne ikke generere kampe for hele turneringen: ${message}`);
      } finally {
        setBusy(false);
        setProgress(null);
      }
    },
    [levelKeys, router],
  );

  const onClickGenerate = useCallback(() => {
    if (totalMatchCount > 0) {
      setConfirmRegenerate(true);
      return;
    }
    void runGenerate(false);
  }, [runGenerate, totalMatchCount]);

  if (levelKeys.length === 0) return null;

  const progressPercent =
    progress && progress.total > 0 ? (progress.step / progress.total) * 100 : 0;

  return (
    <section className="rounded-xl border border-lc-border bg-white p-4 shadow-lc-card dark:border-gray-700 dark:bg-gray-900/35 dark:shadow-none">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Kampgenerering (hele turneringen)</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          Opretter kampe for alle puljer på alle niveauer i én kørsel og planlægger derefter niveau for niveau, så
          hold-pause og banebelastning fra tidligere niveauer medtages. Puljer med mindst 2 hold inkluderes; tomme puljer
          springes over.
        </p>
      </div>

      {busy && progress ? (
        <GenerationProgress
          className="mt-4"
          value={progressPercent}
          label={progress.label}
          detail={progress.detail}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {confirmRegenerate ? (
          <>
            <p className="w-full text-sm text-amber-800 dark:text-amber-200">
              Erstat alle {totalMatchCount} eksisterende kampe i turneringen med nye kampe og tider?
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runGenerate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
              Ja, regenerer hele turneringen
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmRegenerate(false)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
            >
              Annuller
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onClickGenerate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d9488] disabled:opacity-50"
            title={
              totalMatchCount > 0
                ? "Sletter og opretter kampe for alle niveauer på ny"
                : "Opretter kampe for alle niveauer med bane og tid"
            }
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {totalMatchCount > 0
              ? "Regenerer alle kampe på alle niveauer"
              : "Generer alle kampe på alle niveauer"}
          </button>
        )}
      </div>

      {actionMsg ? (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200">
          <p>{actionMsg}</p>
          <KampprogramScheduleFollowUp unscheduledCount={lastUnscheduled} />
          {postScheduleChecks && (postScheduleChecks.courtConflicts > 0 || postScheduleChecks.teamRestWarnings > 0 || postScheduleChecks.teamsSpanningPeriods > 0) ? (
            <div className="mt-2 border-t border-amber-200 pt-2 dark:border-amber-800">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Efter planlægning:</p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
                {postScheduleChecks.courtConflicts > 0 ? (
                  <li>{postScheduleChecks.courtConflicts} bane-konflikt{postScheduleChecks.courtConflicts === 1 ? "" : "er"} — se Kampstatus</li>
                ) : null}
                {postScheduleChecks.teamRestWarnings > 0 ? (
                  <li>{postScheduleChecks.teamRestWarnings} hold-pause-advarsel{postScheduleChecks.teamRestWarnings === 1 ? "" : "er"} — se Kampstatus</li>
                ) : null}
                {postScheduleChecks.teamsSpanningPeriods > 0 ? (
                  <li>{postScheduleChecks.teamsSpanningPeriods} hold spænder over Formiddag og Eftermiddag</li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
