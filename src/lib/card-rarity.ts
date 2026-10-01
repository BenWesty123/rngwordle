/** Card rarity bands, shared by the score reveal and the card collection. */

export type CardRarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

export const RARITY_ORDER: CardRarity[] = ["Legendary", "Epic", "Rare", "Uncommon", "Common"];

/** Bands follow the scoring curve: a base rarity of 2, 3, 5, 8 raised to the power 1.5. */
export function cardRarity(points: number): CardRarity {
  if (points <= 3) return "Common";
  if (points <= 5) return "Uncommon";
  if (points <= 11) return "Rare";
  if (points <= 23) return "Epic";
  return "Legendary";
}

export const RARITY_BADGE = {
  Common: "border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:border-zinc-300/40 dark:bg-zinc-300/10 dark:text-zinc-100",
  Uncommon: "border-emerald-600/45 bg-emerald-600/10 text-emerald-800 dark:border-emerald-300/45 dark:bg-emerald-300/15 dark:text-emerald-100",
  Rare: "border-sky-600/45 bg-sky-600/10 text-sky-800 dark:border-sky-300/50 dark:bg-sky-300/15 dark:text-sky-100",
  Epic: "border-violet-600/45 bg-violet-600/10 text-violet-800 dark:border-violet-300/50 dark:bg-violet-300/15 dark:text-violet-100",
  Legendary: "border-amber-600/55 bg-amber-500/15 text-amber-800 dark:border-amber-200/60 dark:bg-amber-200/15 dark:text-amber-100",
} as const;

export const RARITY_STAMP = {
  Common: "border-zinc-500/70 text-zinc-700 dark:border-zinc-300/70 dark:text-zinc-100",
  Uncommon: "border-emerald-600/80 text-emerald-700 dark:border-emerald-300/80 dark:text-emerald-200",
  Rare: "border-sky-600/80 text-sky-700 dark:border-sky-300/80 dark:text-sky-200",
  Epic: "border-violet-600/80 text-violet-700 dark:border-violet-300/80 dark:text-violet-200",
  Legendary: "border-amber-600/90 text-amber-700 dark:border-amber-200/90 dark:text-amber-100",
} as const;

/** Card outline in the collection, one step softer than the stamp. */
export const RARITY_BORDER = {
  Common: "border-zinc-500/45 dark:border-zinc-300/40",
  Uncommon: "border-emerald-600/55 dark:border-emerald-300/50",
  Rare: "border-sky-600/55 dark:border-sky-300/55",
  Epic: "border-violet-600/55 dark:border-violet-300/55",
  Legendary: "border-amber-600/65 dark:border-amber-200/65",
} as const;
