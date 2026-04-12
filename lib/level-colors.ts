import { levelSlugForPalette } from "@/lib/holddannelse";

export type LevelVisual = {
  /** Række / række-link: venstrekant + diskret baggrund */
  row: string;
  rowHover: string;
  rowFocus: string;
  /** Lille mærkat til niveau-tekst */
  badge: string;
};

const DEFAULT_VISUAL: LevelVisual = {
  row: "border-l-[3px] border-gray-300 bg-gray-50/70 dark:border-gray-600 dark:bg-gray-800/40",
  rowHover: "hover:bg-gray-100/95 dark:hover:bg-gray-800/65",
  rowFocus: "focus:bg-gray-100/95 dark:focus:bg-gray-800/65",
  badge:
    "rounded-md bg-gray-200/80 px-2 py-0.5 text-[0.6875rem] font-medium text-gray-800 dark:bg-gray-700/80 dark:text-gray-100",
};

/** Samme palet på tværs af Spillere og Klubber — dæmpede toner. */
const BY_SLUG: Record<string, LevelVisual> = {
  coolstars: {
    row: "border-l-[3px] border-sky-400 bg-sky-50/85 dark:border-sky-500 dark:bg-sky-950/35",
    rowHover: "hover:bg-sky-100/90 dark:hover:bg-sky-950/50",
    rowFocus: "focus:bg-sky-100/90 dark:focus:bg-sky-950/50",
    badge:
      "rounded-md bg-sky-100/90 px-2 py-0.5 text-[0.6875rem] font-medium text-sky-950 dark:bg-sky-900/45 dark:text-sky-100",
  },
  superstars: {
    row: "border-l-[3px] border-indigo-400 bg-indigo-50/85 dark:border-indigo-400 dark:bg-indigo-950/35",
    rowHover: "hover:bg-indigo-100/90 dark:hover:bg-indigo-950/50",
    rowFocus: "focus:bg-indigo-100/90 dark:focus:bg-indigo-950/50",
    badge:
      "rounded-md bg-indigo-100/90 px-2 py-0.5 text-[0.6875rem] font-medium text-indigo-950 dark:bg-indigo-900/45 dark:text-indigo-100",
  },
  powerstars: {
    row: "border-l-[3px] border-amber-400 bg-amber-50/85 dark:border-amber-500 dark:bg-amber-950/30",
    rowHover: "hover:bg-amber-100/90 dark:hover:bg-amber-950/45",
    rowFocus: "focus:bg-amber-100/90 dark:focus:bg-amber-950/45",
    badge:
      "rounded-md bg-amber-100/90 px-2 py-0.5 text-[0.6875rem] font-medium text-amber-950 dark:bg-amber-900/45 dark:text-amber-100",
  },
  turbostars: {
    row: "border-l-[3px] border-rose-400 bg-rose-50/85 dark:border-rose-500 dark:bg-rose-950/30",
    rowHover: "hover:bg-rose-100/90 dark:hover:bg-rose-950/45",
    rowFocus: "focus:bg-rose-100/90 dark:focus:bg-rose-950/45",
    badge:
      "rounded-md bg-rose-100/90 px-2 py-0.5 text-[0.6875rem] font-medium text-rose-950 dark:bg-rose-900/45 dark:text-rose-100",
  },
  jazz: {
    row: "border-l-[3px] border-fuchsia-400 bg-fuchsia-50/80 dark:border-fuchsia-500 dark:bg-fuchsia-950/30",
    rowHover: "hover:bg-fuchsia-100/90 dark:hover:bg-fuchsia-950/45",
    rowFocus: "focus:bg-fuchsia-100/90 dark:focus:bg-fuchsia-950/45",
    badge:
      "rounded-md bg-fuchsia-100/90 px-2 py-0.5 text-[0.6875rem] font-medium text-fuchsia-950 dark:bg-fuchsia-900/45 dark:text-fuchsia-100",
  },
  funk: {
    row: "border-l-[3px] border-emerald-400 bg-emerald-50/85 dark:border-emerald-500 dark:bg-emerald-950/30",
    rowHover: "hover:bg-emerald-100/90 dark:hover:bg-emerald-950/45",
    rowFocus: "focus:bg-emerald-100/90 dark:focus:bg-emerald-950/45",
    badge:
      "rounded-md bg-emerald-100/90 px-2 py-0.5 text-[0.6875rem] font-medium text-emerald-950 dark:bg-emerald-900/45 dark:text-emerald-100",
  },
  rock: {
    row: "border-l-[3px] border-violet-500 bg-violet-50/80 dark:border-violet-400 dark:bg-violet-950/30",
    rowHover: "hover:bg-violet-100/90 dark:hover:bg-violet-950/45",
    rowFocus: "focus:bg-violet-100/90 dark:focus:bg-violet-950/45",
    badge:
      "rounded-md bg-violet-100/90 px-2 py-0.5 text-[0.6875rem] font-medium text-violet-950 dark:bg-violet-900/45 dark:text-violet-100",
  },
  ukendt: {
    row: "border-l-[3px] border-slate-300 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-900/35",
    rowHover: "hover:bg-slate-100/90 dark:hover:bg-slate-900/50",
    rowFocus: "focus:bg-slate-100/90 dark:focus:bg-slate-900/50",
    badge:
      "rounded-md bg-slate-200/80 px-2 py-0.5 text-[0.6875rem] font-medium text-slate-800 dark:bg-slate-700/80 dark:text-slate-100",
  },
};

export function getLevelVisualClasses(level: string | null | undefined): LevelVisual {
  const slug = levelSlugForPalette(level);
  return BY_SLUG[slug] ?? DEFAULT_VISUAL;
}
