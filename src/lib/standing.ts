import histogram from "@/data/histogram.json";
import { beatenFraction, tierForBeaten, type TierBand } from "@/lib/tiers";

export const WORD_COUNT = histogram.wordCount;

export function standingFor(score: number): { beaten: number; tier: TierBand; wordCount: number } {
  const beaten = beatenFraction(score, histogram.scores, histogram.below, histogram.wordCount);
  return { beaten, tier: tierForBeaten(beaten), wordCount: histogram.wordCount };
}
