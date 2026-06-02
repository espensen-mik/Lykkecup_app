"use client";

import { CircleUserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Lc26HeroWaveGraphic } from "@/components/lykkecup26/lc26-hero-wave-graphic";
import {
  heroAccentForKind,
  heroGoldPageShellClass,
  heroOceanMintShellClass,
  heroOriginalShellClass,
  heroWaveShellClass,
  LC26_PROFILE_HERO_VARIANT,
  resolveProfileHeroVariant,
  savedProfileRoleLabel,
  savedProfileSectionKicker,
  shouldUseHeroWave,
} from "@/components/lykkecup26/lc26-hero-card-shell";
import type { Lc26SavedProfile } from "@/lib/lc26-saved-player";

type Props = {
  profile: Lc26SavedProfile;
  /** Forside vs. /lykkecup26/mit */
  context: "home" | "mit";
  children: ReactNode;
  className?: string;
  showUserIcon?: boolean;
  headingId?: string;
};

function shellClassForProfile(profile: Lc26SavedProfile, context: "home" | "mit"): string {
  const margin = context === "home" ? "mb-8 sm:mb-10" : "mt-6";
  const variant = LC26_PROFILE_HERO_VARIANT;

  if (profile.kind === "page") {
    return heroGoldPageShellClass(margin);
  }

  const accent = heroAccentForKind(profile.kind);
  const resolved = resolveProfileHeroVariant(accent);

  if (shouldUseHeroWave(profile.kind, variant)) {
    return heroWaveShellClass(accent, margin);
  }
  if (resolved === "ocean-mint" && profile.kind === "player") {
    return heroOceanMintShellClass(margin);
  }
  return heroOriginalShellClass(accent, margin);
}

export function Lc26SavedProfileCard({
  profile,
  context,
  children,
  className = "",
  showUserIcon = false,
  headingId = "lc26-saved-heading",
}: Props) {
  const accent = heroAccentForKind(profile.kind);
  const useWave = shouldUseHeroWave(profile.kind);
  const titleClass = context === "home" ? "text-xl font-semibold tracking-tight" : "text-2xl font-semibold tracking-tight";
  const homeSizeClass = context === "home" ? "min-h-[14rem] sm:min-h-[15rem]" : "";

  return (
    <section
      className={`${shellClassForProfile(profile, context)} ${homeSizeClass} ${className}`.trim()}
      aria-labelledby={headingId}
    >
      {useWave ? <Lc26HeroWaveGraphic scheme={accent} /> : null}
      <div
        className={`relative z-10 flex flex-col p-5 sm:p-6 ${context === "home" ? "min-h-[inherit] justify-between" : ""}`.trim()}
      >
        <div>
          <p id={headingId} className="text-sm font-semibold uppercase tracking-[0.12em] text-white/90">
            {savedProfileSectionKicker(profile.kind, context)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {showUserIcon ? (
              <>
                <CircleUserRound className="h-5 w-5 shrink-0 text-white/90" strokeWidth={1.75} aria-hidden />
                <p className={`${titleClass} text-white`}>{profile.name}</p>
              </>
            ) : (
              <p className={`${titleClass} text-white`}>{profile.name}</p>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.08em] text-white/90">
            {savedProfileRoleLabel(profile.kind)}
          </p>
        </div>
        <div className={context === "home" ? "shrink-0" : "mt-6"}>{children}</div>
      </div>
    </section>
  );
}
