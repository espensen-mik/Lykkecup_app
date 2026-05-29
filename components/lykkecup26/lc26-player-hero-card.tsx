import { Lc26SavedPlayerControls } from "@/components/lykkecup26/lc26-saved-player-controls";

/**
 * Player name card on `/lykkecup26/spiller/[id]`.
 *
 * **Variants**
 * - `"original"` — solid teal card (legacy look)
 * - `"ocean-mint"` — subtle teal gradient (lighter top-left → `#055B5C` bottom-right)
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
      "mb-10 rounded-2xl border border-white/12 bg-[linear-gradient(135deg,#0c7a7b_0%,#055B5C_52%,#044f50_100%)] p-5 shadow-[0_14px_34px_-18px_rgb(5_91_92/0.5)] sm:p-6",
    kicker: "text-[11px] font-semibold uppercase tracking-[0.14em] text-white/88",
    title: "mt-2 text-balance text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]",
    subtitle: "mt-2 text-sm font-semibold uppercase tracking-[0.08em] text-white/90",
    club: "mt-1 text-base leading-snug text-white/85",
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
