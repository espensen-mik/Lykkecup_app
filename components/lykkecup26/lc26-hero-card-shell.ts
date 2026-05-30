import type { Lc26SavedKind } from "@/lib/lc26-saved-player";

/**
 * Hero card on profile pages + Mit LykkeCup saved cards.
 *
 * **Revert to Original:** set to `"original"`.
 */
export type Lc26ProfileHeroVariant = "original" | "ocean-mint" | "wave";

export const LC26_PROFILE_HERO_VARIANT: Lc26ProfileHeroVariant = "wave";

export type Lc26HeroAccent = "teal" | "navy";

export function heroWaveShellClass(accent: Lc26HeroAccent, extra = ""): string {
  const base =
    accent === "teal"
      ? "relative overflow-hidden rounded-2xl border border-white/15 shadow-[0_14px_34px_-18px_rgb(0_182_165/0.55)]"
      : "relative overflow-hidden rounded-2xl border border-white/12 shadow-[0_14px_34px_-18px_rgb(22_51_88/0.55)]";
  return extra ? `${base} ${extra}` : base;
}

export function heroOriginalShellClass(accent: Lc26HeroAccent, extra = ""): string {
  const base =
    accent === "teal"
      ? "rounded-2xl border border-lc26-teal/75 bg-lc26-teal shadow-[0_14px_34px_-18px_rgb(0_161_130/0.9)]"
      : "rounded-2xl border border-lc26-navy/75 bg-lc26-navy shadow-[0_14px_34px_-18px_rgb(22_51_88/0.9)]";
  return extra ? `${base} ${extra}` : base;
}

export function heroOceanMintShellClass(extra = ""): string {
  const base =
    "rounded-2xl border border-white/12 bg-[linear-gradient(135deg,#0c7a7b_0%,#055B5C_52%,#044f50_100%)] shadow-[0_14px_34px_-18px_rgb(5_91_92/0.5)]";
  return extra ? `${base} ${extra}` : base;
}

export function heroGoldPageShellClass(extra = ""): string {
  const base =
    "rounded-2xl border border-lc26-gold/60 bg-gradient-to-br from-lc26-gold to-lc26-gold-dark shadow-[0_14px_34px_-18px_rgb(211_175_55/0.75)]";
  return extra ? `${base} ${extra}` : base;
}

export function shouldUseHeroWave(kind: Lc26SavedKind, variant: Lc26ProfileHeroVariant = LC26_PROFILE_HERO_VARIANT): boolean {
  return variant === "wave" && kind !== "page";
}

export function heroAccentForKind(kind: Lc26SavedKind): Lc26HeroAccent {
  return kind === "coach" ? "navy" : "teal";
}

export function savedProfileRoleLabel(kind: Lc26SavedKind): string {
  if (kind === "page") return "VIP-program";
  if (kind === "coach") return "Cheftræner";
  return "Håndboldstjerne";
}

export function savedProfileSectionKicker(kind: Lc26SavedKind, context: "home" | "mit"): string {
  if (context === "home") return "Mit LykkeCup";
  if (kind === "page") return "Mit gemte program";
  if (kind === "coach") return "Min trænerprofil";
  return "Min spillerprofil";
}

export function resolveProfileHeroVariant(accent: Lc26HeroAccent): Lc26ProfileHeroVariant {
  return LC26_PROFILE_HERO_VARIANT === "ocean-mint" && accent === "navy"
    ? "original"
    : LC26_PROFILE_HERO_VARIANT;
}
