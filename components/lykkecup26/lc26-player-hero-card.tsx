import { Lc26SavedPlayerControls } from "@/components/lykkecup26/lc26-saved-player-controls";

/**
 * Player name card on `/lykkecup26/spiller/[id]`.
 *
 * **Variants**
 * - `"original"` — solid teal card (legacy look)
 * - `"ocean-mint"` — horizontal gradient `#014871` → `#A0EBCF`
 *
 * **Revert to Original:** set `LC26_PLAYER_HERO_VARIANT` below to `"original"`.
 */
export const LC26_PLAYER_HERO_VARIANT = "ocean-mint" as const;

export type Lc26PlayerHeroVariant = "original" | "ocean-mint";

type Props = {
  playerName: string;
  homeClub: string | null;
  currentPlayerId: string;
};

const VARIANT_STYLES: Record<
  Lc26PlayerHeroVariant,
  { shell: string; kicker: string; title: string; subtitle: string; club: string }
> = {
  original: {
    shell:
      "mb-10 rounded-2xl border border-lc26-teal/75 bg-lc26-teal p-5 shadow-[0_14px_34px_-18px_rgb(0_161_130/0.9)] sm:p-6",
    kicker: "text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90",
    title: "mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]",
    subtitle: "mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-white/90",
    club: "mt-1 text-base leading-snug text-white/85",
  },
  "ocean-mint": {
    shell:
      "mb-10 rounded-2xl border border-white/25 bg-[linear-gradient(90deg,#014871_0%,#A0EBCF_100%)] p-5 shadow-[0_18px_42px_-16px_rgb(1_72_113/0.55)] ring-1 ring-white/20 sm:p-6",
    kicker:
      "text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90 [text-shadow:0_1px_2px_rgb(1_72_113/0.35)]",
    title:
      "mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] text-white [text-shadow:0_1px_3px_rgb(1_72_113/0.4)] sm:text-[2rem]",
    subtitle:
      "mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-white/95 [text-shadow:0_1px_2px_rgb(1_72_113/0.3)]",
    club: "mt-1 text-base leading-snug text-white/90 [text-shadow:0_1px_2px_rgb(1_72_113/0.25)]",
  },
};

export function Lc26PlayerHeroCard({ playerName, homeClub, currentPlayerId }: Props) {
  const styles = VARIANT_STYLES[LC26_PLAYER_HERO_VARIANT];

  return (
    <div className={styles.shell}>
      <p className={styles.kicker}>LykkeCup 26</p>
      <h1 className={styles.title}>{playerName}</h1>
      <p className={styles.subtitle}>Håndboldstjerne</p>
      {homeClub ? <p className={styles.club}>{homeClub}</p> : null}
      <div className="mt-6">
        <Lc26SavedPlayerControls
          kind="player"
          entityId={currentPlayerId}
          entityName={playerName}
          tone="inverse"
          accent="teal"
        />
      </div>
    </div>
  );
}
