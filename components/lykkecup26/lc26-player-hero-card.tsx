import { Lc26SavedPlayerControls } from "@/components/lykkecup26/lc26-saved-player-controls";
import { Lc26PlayerHeroWaveGraphic } from "@/components/lykkecup26/lc26-player-hero-wave-graphic";

/**
 * Player name card on `/lykkecup26/spiller/[id]`.
 *
 * **Variants**
 * - `"original"` — solid teal card (legacy look)
 * - `"ocean-mint"` — subtle CSS teal gradient
 * - `"wave"` — Illustrator wave (`public/wave.svg`, #00B69C / #00BFA5)
 *
 * **Revert to Original:** set `LC26_PLAYER_HERO_VARIANT` below to `"original"`.
 */
export const LC26_PLAYER_HERO_VARIANT = "wave" as const;

export type Lc26PlayerHeroVariant = "original" | "ocean-mint" | "wave";

type Props = {
  playerName: string;
  homeClub: string | null;
  currentPlayerId: string;
};

const TEXT_STYLES = {
  kicker: "text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90",
  title: "mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]",
  subtitle: "mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-white/90",
  club: "mt-1 text-base leading-snug text-white/85",
} as const;

const VARIANT_SHELL: Record<Lc26PlayerHeroVariant, string> = {
  original:
    "mb-10 rounded-2xl border border-lc26-teal/75 bg-lc26-teal p-5 shadow-[0_14px_34px_-18px_rgb(0_161_130/0.9)] sm:p-6",
  "ocean-mint":
    "mb-10 rounded-2xl border border-white/12 bg-[linear-gradient(135deg,#0c7a7b_0%,#055B5C_52%,#044f50_100%)] p-5 shadow-[0_14px_34px_-18px_rgb(5_91_92/0.5)] sm:p-6",
  wave: "mb-10 relative overflow-hidden rounded-2xl border border-white/15 shadow-[0_14px_34px_-18px_rgb(0_182_165/0.55)]",
};

export function Lc26PlayerHeroCard({ playerName, homeClub, currentPlayerId }: Props) {
  const variant = LC26_PLAYER_HERO_VARIANT;
  const isWave = variant === "wave";

  const body = (
    <>
      <p className={TEXT_STYLES.kicker}>LykkeCup 26</p>
      <h1 className={TEXT_STYLES.title}>{playerName}</h1>
      <p className={TEXT_STYLES.subtitle}>Håndboldstjerne</p>
      {homeClub ? <p className={TEXT_STYLES.club}>{homeClub}</p> : null}
      <div className="mt-6">
        <Lc26SavedPlayerControls
          kind="player"
          entityId={currentPlayerId}
          entityName={playerName}
          tone="inverse"
          accent="teal"
        />
      </div>
    </>
  );

  if (isWave) {
    return (
      <div className={VARIANT_SHELL.wave}>
        <Lc26PlayerHeroWaveGraphic />
        <div className="relative z-10 p-5 sm:p-6">{body}</div>
      </div>
    );
  }

  return <div className={VARIANT_SHELL[variant]}>{body}</div>;
}
