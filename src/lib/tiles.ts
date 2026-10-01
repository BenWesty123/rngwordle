/**
 * The light half of scoring: tile values and row formatting.
 * The browser imports this. It must never import the word data in scoring.ts.
 */

export const TILE_VALUES: Record<string, number> = {
  a: 1,
  b: 3,
  c: 3,
  d: 2,
  e: 1,
  f: 4,
  g: 2,
  h: 4,
  i: 1,
  j: 8,
  k: 5,
  l: 1,
  m: 3,
  n: 1,
  o: 1,
  p: 3,
  q: 10,
  r: 1,
  s: 1,
  t: 1,
  u: 1,
  v: 4,
  w: 4,
  x: 8,
  y: 4,
  z: 10,
};

export const RARE_LETTERS = new Set(["j", "q", "x", "z"]);

export type Tile = {
  letter: string;
  value: number;
  rare: boolean;
  twin: boolean;
};

export type LedgerRow = {
  id: string;
  name: string;
  detail: string;
  /**
   * Tile pile: the Scrabble sum.
   * Length and scoring factors: the multiplier.
   * A factor that missed: null.
   */
  points: number | null;
  scored: boolean;
  /** Dictionary word that triggered one Inside hit. */
  match?: string;
  /** Letter indexes that explain this hit. */
  highlight?: number[];
  /** Why this card lit up, without the running-total math. */
  reason?: string;
  /** The property holds, even if it does not score: too common, or a rarer card covers it. */
  matched?: boolean;
};

export type ScoredWord = {
  word: string;
  tiles: Tile[];
  tileSum: number;
  length: number;
  lengthMultiplier: number;
  rows: LedgerRow[];
  total: number;
};

/** Scrabble tiles for a lowercase a–z word. */
export function tilesFor(word: string): Tile[] {
  const twinFlags = twinPositions(word);
  return [...word].map((letter, index) => ({
    letter,
    value: TILE_VALUES[letter] ?? 0,
    rare: RARE_LETTERS.has(letter),
    twin: twinFlags[index] ?? false,
  }));
}

export function formatRowValue(row: LedgerRow): string {
  if (row.id === "tiles") return String(row.points);
  if (row.points === null) return "—";
  return `×${row.points}`;
}

export function twinPositions(word: string): boolean[] {
  const flags = Array.from({ length: word.length }, () => false);
  let index = 0;
  while (index < word.length) {
    let end = index + 1;
    while (end < word.length && word[end] === word[index]) end += 1;
    if (end - index >= 2) {
      for (let cursor = index; cursor < end; cursor += 1) flags[cursor] = true;
    }
    index = end;
  }
  return flags;
}
