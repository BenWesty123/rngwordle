import type { TierId } from "@/lib/tiers";

/** Tier colours shared by the game and the leaderboard. */
export const TIER_STYLE: Record<TierId, { badge: string; glow: string }> = {
  trash: {
    badge: "border-stone-400/30 bg-stone-400/10 text-stone-300",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(168,162,158,0.16),transparent_58%)]",
  },
  common: {
    badge: "border-zinc-300/25 bg-zinc-300/10 text-zinc-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(212,212,216,0.12),transparent_58%)]",
  },
  uncommon: {
    badge: "border-emerald-300/35 bg-emerald-300/10 text-emerald-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(110,231,183,0.16),transparent_58%)]",
  },
  rare: {
    badge: "border-sky-300/40 bg-sky-300/10 text-sky-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(125,211,252,0.18),transparent_58%)]",
  },
  epic: {
    badge: "border-violet-300/40 bg-violet-300/10 text-violet-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(196,181,253,0.2),transparent_60%)]",
  },
  mythic: {
    badge: "border-amber-200/50 bg-amber-200/15 text-amber-100",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(252,211,77,0.26),transparent_62%)]",
  },
};
