import {
  LC26_PROFILE_HERO_VARIANT,
  Lc26ProfileHeroCard,
  type Lc26ProfileHeroVariant,
} from "@/components/lykkecup26/lc26-profile-hero-card";

/** @deprecated Use `LC26_PROFILE_HERO_VARIANT` — kept for «go back to Original» notes. */
export const LC26_PLAYER_HERO_VARIANT = LC26_PROFILE_HERO_VARIANT;

export type Lc26PlayerHeroVariant = Lc26ProfileHeroVariant;

type Props = {
  playerName: string;
  homeClub: string | null;
  currentPlayerId: string;
};

export function Lc26PlayerHeroCard({ playerName, homeClub, currentPlayerId }: Props) {
  return (
    <Lc26ProfileHeroCard
      title={playerName}
      subtitle="Håndboldstjerne"
      detail={homeClub}
      saveKind="player"
      entityId={currentPlayerId}
      entityName={playerName}
      accent="teal"
    />
  );
}
