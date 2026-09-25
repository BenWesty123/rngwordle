export const TIER_BANDS = [
  {
    id: "mythic",
    label: "Mythic",
    minBeaten: 0.99,
    blurb: "Top sliver of the dictionary. Ridiculous luck.",
  },
  {
    id: "epic",
    label: "Epic",
    minBeaten: 0.95,
    blurb: "A draw worth telling someone about.",
  },
  {
    id: "rare",
    label: "Rare",
    minBeaten: 0.85,
    blurb: "Better than the vast majority of the list.",
  },
  {
    id: "uncommon",
    label: "Uncommon",
    minBeaten: 0.65,
    blurb: "Above the ordinary pile.",
  },
  {
    id: "common",
    label: "Common",
    minBeaten: 0.35,
    blurb: "A familiar score. The list is full of these.",
  },
  {
    id: "trash",
    label: "Trash",
    minBeaten: 0,
    blurb: "Most words land here. No shame, little glory.",
  },
] as const;

export type TierId = (typeof TIER_BANDS)[number]["id"];
export type TierBand = (typeof TIER_BANDS)[number];

export function beatenFraction(score: number, counts: readonly number[], wordCount: number): number {
  if (wordCount <= 0) return 0;
  let below = 0;
  const end = Math.min(Math.max(score, 0), counts.length);
  for (let index = 0; index < end; index += 1) below += counts[index] ?? 0;
  return below / wordCount;
}

export function tierForBeaten(beaten: number): TierBand {
  for (const band of TIER_BANDS) {
    if (beaten >= band.minBeaten) return band;
  }
  return TIER_BANDS[TIER_BANDS.length - 1]!;
}
