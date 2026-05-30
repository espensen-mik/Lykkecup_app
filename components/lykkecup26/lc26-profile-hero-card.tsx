import { Lc26HeroWaveGraphic } from "@/components/lykkecup26/lc26-hero-wave-graphic";
import {
  heroOceanMintShellClass,
  heroOriginalShellClass,
  heroWaveShellClass,
  LC26_PROFILE_HERO_VARIANT,
  resolveProfileHeroVariant,
  type Lc26ProfileHeroVariant,
} from "@/components/lykkecup26/lc26-hero-card-shell";
import { Lc26SavedPlayerControls } from "@/components/lykkecup26/lc26-saved-player-controls";

export { LC26_PROFILE_HERO_VARIANT, type Lc26ProfileHeroVariant } from "@/components/lykkecup26/lc26-hero-card-shell";

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

export function Lc26ProfileHeroCard({
  title,
  subtitle,
  detail,
  saveKind,
  entityId,
  entityName,
  accent,
}: Props) {
  const resolvedVariant = resolveProfileHeroVariant(accent);

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
    const waveScheme = accent === "teal" ? "teal" : "navy";
    return (
      <div className={heroWaveShellClass(accent, "mb-10")}>
        <Lc26HeroWaveGraphic scheme={waveScheme} />
        <div className="relative z-10 p-5 sm:p-6">{body}</div>
      </div>
    );
  }

  if (resolvedVariant === "ocean-mint") {
    return <div className={`${heroOceanMintShellClass()} mb-10 p-5 sm:p-6`}>{body}</div>;
  }

  return <div className={`${heroOriginalShellClass(accent, "mb-10")} p-5 sm:p-6`}>{body}</div>;
}
