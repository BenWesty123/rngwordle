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

export function beatenFraction(
  score: number,
  scores: readonly number[],
  below: readonly number[],
  wordCount: number,
): number {
  if (wordCount <= 0 || scores.length === 0) return 0;
  let lo = 0;
  let hi = scores.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((scores[mid] ?? 0) < score) lo = mid + 1;
    else hi = mid;
  }
  if (lo >= below.length) return 1;
  return (below[lo] ?? 0) / wordCount;
}

export function tierForBeaten(beaten: number): TierBand {
  for (const band of TIER_BANDS) {
    if (beaten >= band.minBeaten) return band;
  }
  return TIER_BANDS[TIER_BANDS.length - 1]!;
}
