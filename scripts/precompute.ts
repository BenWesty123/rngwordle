import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FACTOR_MATCHES, LENGTH_CENTER, scoreWord } from "../src/lib/scoring";
import { TIER_BANDS, beatenFraction, tierForBeaten } from "../src/lib/tiers";

const root = process.cwd();
const raw = readFileSync(join(root, "data/enable1.txt"), "utf8");
const words = [
  ...new Set(
    raw
      .split(/\r?\n/)
      .map((word) => word.trim().toLowerCase())
      .filter((word) => /^[a-z]{2,}$/.test(word)),
  ),
].sort();

const scored = words.map((word) => scoreWord(word));
const scores = scored.map((entry) => entry.total);
const tally = new Map<number, number>();
for (const score of scores) tally.set(score, (tally.get(score) ?? 0) + 1);
const uniqueScores = [...tally.keys()].sort((a, b) => a - b);
const belowCounts: number[] = [];
let seen = 0;
for (const score of uniqueScores) {
  belowCounts.push(seen);
  seen += tally.get(score) ?? 0;
}

function below(score: number): number {
  return Math.round(beatenFraction(score, uniqueScores, belowCounts, words.length) * words.length);
}

const tierCounts = new Map<string, number>();
for (const band of TIER_BANDS) tierCounts.set(band.id, 0);
for (const score of scores) {
  const beaten = below(score) / words.length;
  const tier = tierForBeaten(beaten);
  tierCounts.set(tier.id, (tierCounts.get(tier.id) ?? 0) + 1);
  if (Math.abs(beaten - below(score) / words.length) > 1e-12) {
    throw new Error(`Standing mismatch at score ${score}`);
  }
}

for (const band of TIER_BANDS) {
  const count = tierCounts.get(band.id) ?? 0;
  if (count === 0) throw new Error(`Tier ${band.id} contains no words`);
}

const byLength = new Map<number, number[]>();
for (const entry of scored) {
  const bucket = byLength.get(entry.length) ?? [];
  bucket.push(entry.total);
  byLength.set(entry.length, bucket);
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

const medianAt = (length: number) => median(byLength.get(length) ?? []);
const middle = medianAt(LENGTH_CENTER);
for (const length of [2, 3, 6, 12, 15, 20]) {
  const edge = medianAt(length);
  if (!(edge > middle)) {
    throw new Error(
      `Length ${length} median ${edge} does not beat length ${LENGTH_CENTER} median ${middle}`,
    );
  }
}

const factorHits = new Map<string, number>();
for (const entry of scored) {
  const seen = new Set<string>();
  for (const row of entry.rows) {
    if (!row.scored || row.id === "tiles" || row.id === "length" || seen.has(row.id)) continue;
    seen.add(row.id);
    factorHits.set(row.id, (factorHits.get(row.id) ?? 0) + 1);
  }
}
for (const [id, expected] of Object.entries(FACTOR_MATCHES)) {
  const actual = factorHits.get(id) ?? 0;
  if (actual !== expected) {
    throw new Error(`Factor ${id} matched ${actual} words, expected ${expected}`);
  }
}

mkdirSync(join(root, "public"), { recursive: true });
mkdirSync(join(root, "src/data"), { recursive: true });
writeFileSync(join(root, "public/words.txt"), `${words.join("\n")}\n`);
writeFileSync(
  join(root, "src/data/histogram.json"),
  `${JSON.stringify({ source: "enable1", wordCount: words.length, scores: uniqueScores, below: belowCounts })}\n`,
);

const ranked = scored
  .map((entry) => ({ word: entry.word, total: entry.total }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 12);

const samples = ["quiz", "kayak", "rhythm", "bookkeeper", "almost", "facetious", "sequoia", "jazz", "qi", "za", "cwm", "aa"];
const minScore = uniqueScores[0] ?? 0;
const maxScore = uniqueScores[uniqueScores.length - 1] ?? 0;
console.log(`words ${words.length}`);
console.log(`score min ${minScore} median ${median(scores)} max ${maxScore}`);
console.log(
  "tiers",
  TIER_BANDS.map((band) => `${band.label} ${tierCounts.get(band.id)}`).join(" · "),
);
console.log(
  "median by length",
  [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 21, 28]
    .filter((length) => byLength.has(length))
    .map((length) => `${length}:${medianAt(length)}`)
    .join(" "),
);
console.log("top", ranked.map((entry) => `${entry.word} ${entry.total}`).join(" · "));
console.log(
  "samples",
  samples
    .filter((word) => words.includes(word))
    .map((word) => {
      const entry = scoreWord(word);
      const beaten = below(entry.total) / words.length;
      return `${word} ${entry.total} ${tierForBeaten(beaten).label}`;
    })
    .join(" · "),
);
