import { Lc26HeroWaveGraphic } from "@/components/lykkecup26/lc26-hero-wave-graphic";
import { Lc26SavedPlayerControls } from "@/components/lykkecup26/lc26-saved-player-controls";

/**
 * Hero card on `/lykkecup26/spiller/[id]` and `/lykkecup26/coach/[id]`.
 *
 * **Variants**
 * - `"original"` — solid teal (player) or navy (coach)
 * - `"ocean-mint"` — subtle CSS teal gradient (player only; coach falls back to navy original)
 * - `"wave"` — Illustrator wave in two navy tones
 *
 * **Revert to Original:** set `LC26_PROFILE_HERO_VARIANT` below to `"original"`.
 */
export type Lc26ProfileHeroVariant = "original" | "ocean-mint" | "wave";

export const LC26_PROFILE_HERO_VARIANT: Lc26ProfileHeroVariant = "wave";

type Props = {
  title: string;
  subtitle: string;
  /** Shown under subtitle; omitted when empty (e.g. player without club). */
  detail?: string | null;
  saveKind: "player" | "coach";
  entityId: string;
  entityName: string;
  accent: "teal" | "navy";
};

const TEXT_STYLES = {
  kicker: "text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90",
  title: "mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]",
  subtitle: "mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-white/90",
  detail: "mt-1 text-base leading-snug text-white/85",
} as const;

function originalShell(accent: "teal" | "navy"): string {
  if (accent === "teal") {
    return "mb-10 rounded-2xl border border-lc26-teal/75 bg-lc26-teal p-5 shadow-[0_14px_34px_-18px_rgb(0_161_130/0.9)] sm:p-6";
  }
  return "mb-10 rounded-2xl border border-lc26-navy/75 bg-lc26-navy p-5 shadow-[0_14px_34px_-18px_rgb(22_51_88/0.9)] sm:p-6";
}

const WAVE_SHELL =
  "mb-10 relative overflow-hidden rounded-2xl border border-white/12 shadow-[0_14px_34px_-18px_rgb(22_51_88/0.55)]";

const OCEAN_MINT_SHELL =
  "mb-10 rounded-2xl border border-white/12 bg-[linear-gradient(135deg,#0c7a7b_0%,#055B5C_52%,#044f50_100%)] p-5 shadow-[0_14px_34px_-18px_rgb(5_91_92/0.5)] sm:p-6";

export function Lc26ProfileHeroCard({
  title,
  subtitle,
  detail,
  saveKind,
  entityId,
  entityName,
  accent,
}: Props) {
  const resolvedVariant: Lc26ProfileHeroVariant =
    LC26_PROFILE_HERO_VARIANT === "ocean-mint" && accent === "navy"
      ? "original"
      : LC26_PROFILE_HERO_VARIANT;

  const body = (
    <>
      <p className={TEXT_STYLES.kicker}>LykkeCup 26</p>
      <h1 className={TEXT_STYLES.title}>{title}</h1>
      <p className={TEXT_STYLES.subtitle}>{subtitle}</p>
      {detail?.trim() ? <p className={TEXT_STYLES.detail}>{detail.trim()}</p> : null}
      <div className="mt-6">
        <Lc26SavedPlayerControls
          kind={saveKind}
          entityId={entityId}
          entityName={entityName}
          tone="inverse"
          accent={accent}
        />
      </div>
    </>
  );

  if (resolvedVariant === "wave") {
    return (
      <div className={WAVE_SHELL}>
        <Lc26HeroWaveGraphic />
        <div className="relative z-10 p-5 sm:p-6">{body}</div>
      </div>
    );
  }

  if (resolvedVariant === "ocean-mint") {
    return <div className={OCEAN_MINT_SHELL}>{body}</div>;
  }

  return <div className={originalShell(accent)}>{body}</div>;
}
