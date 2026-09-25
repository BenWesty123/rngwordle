/**
 * RNGWorlde scoring is a product of multipliers.
 *
 * Tile pile: standard English Scrabble values. That is the base.
 * Length: ×1 at 9 letters, the average (and median) length in the bundled list.
 * Each step shorter doubles (8→×2, 7→×4, 6→×8, …, 2→×128).
 * Each step longer adds one (10→×2, 11→×3, 12→×4, …).
 * Every other factor multiplies only when it hits. The multiplier is
 * round(3 × log10(list size / matches)), and at least ×2.
 * Y is never a vowel. Ascenders are b d f h k l t. Descenders are g j p q y.
 * Origin and sound-word tags come from Webster's 1913 dictionary, not from
 * every word in the list. A miss means that etymology is silent, not that
 * the origin is impossible.
 */

import wordFacts from "@/data/word-facts.json";

const WORD_FACT_TAGS = wordFacts.words as Record<string, string[]>;

export const LENGTH_CENTER = 9;
export const LIST_SIZE = 172823;

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

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const RARE = new Set(["j", "q", "x", "z"]);
const ASCENDERS = new Set(["b", "d", "f", "h", "k", "l", "t"]);
const DESCENDERS = new Set(["g", "j", "p", "q", "y"]);
const VOWEL_ORDER = "aeiou";
const QUIET_PREFIXES = ["kn", "gn", "wr", "ps", "rh"] as const;

/** How many bundled words have each property. Precompute checks these counts. */
export const FACTOR_MATCHES = {
  mirror: 101,
  contraband: 16286,
  twins: 41209,
  "a-cappella": 5,
  "bone-dry": 121,
  "alphabet-soup": 411,
  "vowel-sweep": 2462,
  "vowel-rich": 5979,
  "a-to-u": 28,
  "next-door": 16304,
  ing: 12564,
  ish: 554,
  ist: 1197,
  "i-before-e": 2169,
  "lone-q": 29,
  "quiet-letters": 1088,
  "flat-type": 6069,
  rewind: 844,
  ditto: 59,
  "from-greek": 1227,
  "from-italian": 369,
  "from-dutch": 119,
  "from-norse": 86,
  "from-arabic": 102,
  "sound-word": 49,
  "from-persian": 48,
  "from-hindi": 42,
  "from-sanskrit": 31,
  "from-hebrew": 24,
  "from-east-asia": 13,
} as const;

export type FactorId = keyof typeof FACTOR_MATCHES;

export function rarityMultiplier(matches: number, wordCount = LIST_SIZE): number {
  if (matches <= 0 || wordCount <= 0) return 2;
  return Math.max(2, Math.round(3 * Math.log10(wordCount / matches)));
}

export const FACTOR_MULTIPLIERS: Record<FactorId, number> = Object.fromEntries(
  (Object.keys(FACTOR_MATCHES) as FactorId[]).map((id) => [id, rarityMultiplier(FACTOR_MATCHES[id])]),
) as Record<FactorId, number>;

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

export function lengthMultiplier(length: number): number {
  if (length === LENGTH_CENTER) return 1;
  const distance = Math.abs(length - LENGTH_CENTER);
  if (length < LENGTH_CENTER) return 2 ** distance;
  return 1 + distance;
}

export function formatRowValue(row: LedgerRow): string {
  if (row.id === "tiles") return String(row.points);
  if (row.points === null) return "—";
  return `×${row.points}`;
}

export function scoreWord(word: string): ScoredWord {
  const normalized = word.toLowerCase();
  if (!/^[a-z]+$/.test(normalized)) {
    throw new Error(`Cannot score "${word}"`);
  }

  const twinFlags = twinPositions(normalized);
  const tiles: Tile[] = [...normalized].map((letter, index) => ({
    letter,
    value: TILE_VALUES[letter] ?? 0,
    rare: RARE.has(letter),
    twin: twinFlags[index] ?? false,
  }));
  const tileSum = tiles.reduce((sum, tile) => sum + tile.value, 0);
  const length = normalized.length;
  const lengthFactor = lengthMultiplier(length);

  const rareTiles = [...normalized].filter((letter) => RARE.has(letter));
  const runs = twinRuns(normalized);
  const palindrome = length >= 3 && normalized === [...normalized].reverse().join("");
  const allVowels = [...normalized].every((letter) => VOWELS.has(letter));
  const noVowels = [...normalized].every((letter) => !VOWELS.has(letter));
  const alphabetical = length >= 4 && isNonDecreasing(normalized);
  const vowelSweep = VOWEL_ORDER.split("").every((vowel) => normalized.includes(vowel));
  const vowels = vowelCount(normalized);
  const consonants = length - vowels;
  const vowelRich = vowels > consonants;
  const aToU = hasVowelOrder(normalized);
  const nextDoor = Math.abs(normalized.charCodeAt(0) - normalized.charCodeAt(length - 1)) === 1;
  const ing = length > 3 && normalized.endsWith("ing");
  const ish = length > 3 && normalized.endsWith("ish");
  const ist = length > 3 && normalized.endsWith("ist");
  const spellingBreak = iBeforeEBreak(normalized);
  const loneQ = hasLoneQ(normalized);
  const quiet = quietPatterns(normalized);
  const flat = isFlat(normalized);

  let running = tileSum;
  const afterLength = running * lengthFactor;

  const rows: LedgerRow[] = [
    {
      id: "tiles",
      name: "Tile pile",
      detail: "Standard English Scrabble values. This is the base.",
      points: tileSum,
      scored: true,
    },
    {
      id: "length",
      name: `Length ×${lengthFactor}`,
      detail: lengthDetail(length, lengthFactor, running, afterLength),
      points: lengthFactor,
      scored: lengthFactor > 1,
    },
  ];
  running = afterLength;

  const factors: Array<{
    id: FactorId;
    name: string;
    hit: boolean;
    hitDetail: string;
    missDetail: string;
  }> = [
    {
      id: "mirror",
      name: "Mirror",
      hit: palindrome,
      hitDetail: "Same word forwards and backwards.",
      missDetail:
        length < 3 ? "Needs at least 3 letters to count as a mirror." : "Not the same word backwards.",
    },
    {
      id: "rewind",
      name: "Rewind",
      hit: hasFact(normalized, "rewind"),
      hitDetail: `Backwards, it spells ${[...normalized].reverse().join("")}.`,
      missDetail: palindrome
        ? "Backwards, it is the same word. That is Mirror."
        : "Backwards, it is not a different word in this dictionary.",
    },
    {
      id: "contraband",
      name: "Contraband",
      hit: rareTiles.length > 0,
      hitDetail: `${rareTiles.length} rare ${rareTiles.length === 1 ? "tile" : "tiles"} (${rareTiles.map((letter) => letter.toUpperCase()).join(", ")}).`,
      missDetail: "No J, Q, X, or Z.",
    },
    {
      id: "twins",
      name: "Twins",
      hit: runs.length > 0,
      hitDetail: `${runs.join(", ")}.`,
      missDetail: "No letter sits next to itself.",
    },
    {
      id: "ditto",
      name: "Ditto",
      hit: isTautonym(normalized),
      hitDetail: `The second half repeats the first (${normalized.slice(0, length / 2)}).`,
      missDetail: "The two halves are not the same.",
    },
    {
      id: "a-cappella",
      name: "A cappella",
      hit: allVowels,
      hitDetail: "Every letter is A, E, I, O, or U. Y does not sing.",
      missDetail: noVowels ? "There is no vowel to sing with." : "A consonant is in the choir.",
    },
    {
      id: "bone-dry",
      name: "Bone dry",
      hit: noVowels,
      hitDetail: "No A, E, I, O, or U. Y stays a consonant.",
      missDetail: allVowels ? "The word is nothing but vowels." : "A vowel got in.",
    },
    {
      id: "alphabet-soup",
      name: "Alphabet soup",
      hit: alphabetical,
      hitDetail: "Each letter is the same as or later than the one before it.",
      missDetail:
        length < 4
          ? "Needs at least 4 letters, in non-decreasing order."
          : "The letters step backwards somewhere.",
    },
    {
      id: "vowel-sweep",
      name: "Vowel sweep",
      hit: vowelSweep,
      hitDetail: "A, E, I, O, and U all show up.",
      missDetail: `Missing ${VOWEL_ORDER.split("")
        .filter((vowel) => !normalized.includes(vowel))
        .join(", ")}.`,
    },
    {
      id: "vowel-rich",
      name: "Vowel rich",
      hit: vowelRich,
      hitDetail: `${vowels} ${vowels === 1 ? "vowel" : "vowels"}, ${consonants} ${consonants === 1 ? "consonant" : "consonants"}.`,
      missDetail:
        vowels === consonants
          ? "Vowels and consonants are tied."
          : "Consonants outnumber the vowels.",
    },
    {
      id: "a-to-u",
      name: "A to U",
      hit: aToU,
      hitDetail: "A, then E, then I, then O, then U, in that order.",
      missDetail: "A, E, I, O, and U do not line up in alphabetical order.",
    },
    {
      id: "next-door",
      name: "Next door",
      hit: nextDoor,
      hitDetail: `${normalized[0]!.toUpperCase()} and ${normalized[length - 1]!.toUpperCase()} are neighbours in the alphabet.`,
      missDetail: "The first and last letters are not neighbours.",
    },
    {
      id: "ing",
      name: "Ing",
      hit: ing,
      hitDetail: "Ends in -ing.",
      missDetail: "Does not end in -ing.",
    },
    {
      id: "ish",
      name: "Ish",
      hit: ish,
      hitDetail: "Ends in -ish.",
      missDetail: "Does not end in -ish.",
    },
    {
      id: "ist",
      name: "Ist",
      hit: ist,
      hitDetail: "Ends in -ist.",
      missDetail: "Does not end in -ist.",
    },
    {
      id: "i-before-e",
      name: "I before E",
      hit: spellingBreak !== null,
      hitDetail: spellingBreak ?? "",
      missDetail: "The i-before-e rule holds, or never comes up.",
    },
    {
      id: "lone-q",
      name: "Lone Q",
      hit: loneQ,
      hitDetail: "A Q with no U after it.",
      missDetail: "Every Q, if any, is followed by U.",
    },
    {
      id: "quiet-letters",
      name: "Quiet letters",
      hit: quiet.length > 0,
      hitDetail: `Silent-letter spelling: ${quiet.join(", ")}.`,
      missDetail: "No KN, GN, WR, PS, or RH at the start, and it does not end in MB.",
    },
    {
      id: "flat-type",
      name: "Flat type",
      hit: flat,
      hitDetail: "No ascenders (b d f h k l t) and no descenders (g j p q y).",
      missDetail: "A letter climbs above the line or drops below it.",
    },
    ...originFactors(normalized),
    {
      id: "sound-word",
      name: "Sound word",
      hit: hasFact(normalized, "sound"),
      hitDetail: "Webster 1913 marks the word as imitative.",
      missDetail: "Webster 1913 does not mark it as a sound-word.",
    },
  ];

  for (const factor of factors) {
    const multiplier = FACTOR_MULTIPLIERS[factor.id];
    if (!factor.hit) {
      rows.push({
        id: factor.id,
        name: factor.name,
        detail: factor.missDetail,
        points: null,
        scored: false,
      });
      continue;
    }
    const next = running * multiplier;
    rows.push({
      id: factor.id,
      name: `${factor.name} ×${multiplier}`,
      detail: `${factor.hitDetail} ${running.toLocaleString("en-US")} × ${multiplier} = ${next.toLocaleString("en-US")}.`,
      points: multiplier,
      scored: true,
    });
    running = next;
  }

  return {
    word: normalized,
    tiles,
    tileSum,
    length,
    lengthMultiplier: lengthFactor,
    rows,
    total: running,
  };
}

function hasFact(word: string, tag: string): boolean {
  if (!Object.hasOwn(WORD_FACT_TAGS, word)) return false;
  return WORD_FACT_TAGS[word]?.includes(tag) ?? false;
}

function originFactors(word: string): Array<{
  id: FactorId;
  name: string;
  hit: boolean;
  hitDetail: string;
  missDetail: string;
}> {
  const east = [
    hasFact(word, "chinese") ? "Chinese" : null,
    hasFact(word, "japanese") ? "Japanese" : null,
  ].filter((name): name is string => name !== null);
  const origins: Array<{ id: FactorId; name: string; tag: string; language: string }> = [
    { id: "from-greek", name: "From Greek", tag: "greek", language: "Greek" },
    { id: "from-italian", name: "From Italian", tag: "italian", language: "Italian" },
    { id: "from-dutch", name: "From Dutch", tag: "dutch", language: "Dutch" },
    { id: "from-norse", name: "From Norse", tag: "norse", language: "Norse" },
    { id: "from-arabic", name: "From Arabic", tag: "arabic", language: "Arabic" },
    { id: "from-persian", name: "From Persian", tag: "persian", language: "Persian" },
    { id: "from-hindi", name: "From Hindi", tag: "hindi", language: "Hindi" },
    { id: "from-sanskrit", name: "From Sanskrit", tag: "sanskrit", language: "Sanskrit" },
    { id: "from-hebrew", name: "From Hebrew", tag: "hebrew", language: "Hebrew" },
  ];
  return [
    ...origins.map((origin) => ({
      id: origin.id,
      name: origin.name,
      hit: hasFact(word, origin.tag),
      hitDetail: `Webster 1913 traces it to ${origin.language}.`,
      missDetail: `No ${origin.language} trace in the 1913 Webster etymology on file.`,
    })),
    {
      id: "from-east-asia",
      name: "From East Asia",
      hit: east.length > 0,
      hitDetail: `Webster 1913 traces it to ${east.join(" and ")}.`,
      missDetail: "No Chinese or Japanese trace in the 1913 Webster etymology on file.",
    },
  ];
}

function isTautonym(word: string): boolean {
  if (word.length < 4 || word.length % 2 !== 0) return false;
  const half = word.length / 2;
  return word.slice(0, half) === word.slice(half);
}

function lengthDetail(length: number, multiplier: number, before: number, after: number): string {
  const math = `${before.toLocaleString("en-US")} × ${multiplier} = ${after.toLocaleString("en-US")}.`;
  if (length === LENGTH_CENTER) {
    return `${length} letters is the average in this dictionary, so length stays at ×1. ${math}`;
  }
  const distance = Math.abs(length - LENGTH_CENTER);
  const direction = length < LENGTH_CENTER ? "shorter" : "longer";
  const step = distance === 1 ? "step" : "steps";
  return `${length} letters, ${distance} ${step} ${direction} than ${LENGTH_CENTER}. ${math}`;
}

function twinRuns(word: string): string[] {
  const runs: string[] = [];
  let index = 0;
  while (index < word.length) {
    let end = index + 1;
    while (end < word.length && word[end] === word[index]) end += 1;
    if (end - index >= 2) runs.push(word.slice(index, end));
    index = end;
  }
  return runs;
}

function twinPositions(word: string): boolean[] {
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

function vowelCount(word: string): number {
  let count = 0;
  for (const letter of word) if (VOWELS.has(letter)) count += 1;
  return count;
}

function hasVowelOrder(word: string): boolean {
  let cursor = 0;
  for (const letter of word) {
    if (letter === VOWEL_ORDER[cursor]) {
      cursor += 1;
      if (cursor === VOWEL_ORDER.length) return true;
    }
  }
  return false;
}

function iBeforeEBreak(word: string): string | null {
  for (let index = 0; index < word.length - 1; index += 1) {
    const pair = word.slice(index, index + 2);
    const previous = index > 0 ? word[index - 1] : "";
    if (pair === "ei" && previous !== "c") {
      return previous
        ? `EI shows up, and the letter before it is ${previous.toUpperCase()}, not C.`
        : "EI starts the word, with no C in front.";
    }
    if (pair === "ie" && previous === "c") {
      return "IE sits immediately after C.";
    }
  }
  return null;
}

function hasLoneQ(word: string): boolean {
  for (let index = 0; index < word.length; index += 1) {
    if (word[index] === "q" && word[index + 1] !== "u") return true;
  }
  return false;
}

function quietPatterns(word: string): string[] {
  const hits: string[] = [];
  for (const prefix of QUIET_PREFIXES) {
    if (word.startsWith(prefix)) hits.push(prefix.toUpperCase());
  }
  if (word.endsWith("mb")) hits.push("MB");
  return hits;
}

function isFlat(word: string): boolean {
  for (const letter of word) {
    if (ASCENDERS.has(letter) || DESCENDERS.has(letter)) return false;
  }
  return true;
}

function isNonDecreasing(word: string): boolean {
  for (let index = 1; index < word.length; index += 1) {
    if (word[index]! < word[index - 1]!) return false;
  }
  return true;
}
