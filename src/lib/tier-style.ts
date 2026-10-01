import type { TierId } from "@/lib/tiers";

/** Tier colours shared by the game and the leaderboard. Each has a Daylight and a Card Table (dark:) version. */
export const TIER_STYLE: Record<TierId, { badge: string; glow: string }> = {
  trash: {
    badge: "border-stone-500/35 bg-stone-500/10 text-stone-700 dark:border-stone-300/30 dark:bg-stone-300/10 dark:text-stone-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(120,113,108,0.12),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(214,211,209,0.12),transparent_58%)]",
  },
  common: {
    badge: "border-zinc-500/35 bg-zinc-500/10 text-zinc-700 dark:border-zinc-300/25 dark:bg-zinc-300/10 dark:text-zinc-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(113,113,122,0.1),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(212,212,216,0.12),transparent_58%)]",
  },
  uncommon: {
    badge: "border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:border-emerald-300/35 dark:bg-emerald-300/10 dark:text-emerald-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(5,150,105,0.14),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(110,231,183,0.16),transparent_58%)]",
  },
  rare: {
    badge: "border-sky-600/40 bg-sky-600/10 text-sky-800 dark:border-sky-300/40 dark:bg-sky-300/10 dark:text-sky-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(2,132,199,0.15),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(125,211,252,0.18),transparent_58%)]",
  },
  epic: {
    badge: "border-violet-600/40 bg-violet-600/10 text-violet-800 dark:border-violet-300/40 dark:bg-violet-300/10 dark:text-violet-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.16),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(196,181,253,0.2),transparent_60%)]",
  },
  mythic: {
    badge: "border-amber-600/50 bg-amber-500/15 text-amber-800 dark:border-amber-200/50 dark:bg-amber-200/15 dark:text-amber-100",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(217,119,6,0.2),transparent_62%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(252,211,77,0.26),transparent_62%)]",
  },
};
