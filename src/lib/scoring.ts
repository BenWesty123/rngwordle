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
 * Origin tags come from English Wiktionary borrowed, inherited, and derived
 * templates. An inflected form inherits the lemma's origin languages.
 * A miss means Wiktionary has no usable origin for that language.
 * Sound-word tags still come from Webster's 1913 dictionary.
 */

import enableWordsText from "@/data/enable-words.json";
import wordFacts from "@/data/word-facts.json";

const ENABLE_WORDS = new Set((enableWordsText as string).split("\n").filter((word) => word.length > 0));

const ANAGRAM_GROUPS = new Map<string, string[]>();
for (const word of ENABLE_WORDS) {
  const key = [...word].sort().join("");
  const group = ANAGRAM_GROUPS.get(key);
  if (group) group.push(word);
  else ANAGRAM_GROUPS.set(key, [word]);
}

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
  "double-twins": 223,
  "triple-twins": 4,
  "no-repeats": 34816,
  "even-company": 92,
  inside: 167370,
  anagram: 28648,
  "a-cappella": 5,
  "bone-dry": 121,
  "alphabet-soup": 411,
  "backwards-alphabet": 432,
  "vowel-sweep": 2462,
  "vowel-rich": 5979,
  "one-vowel-wonder": 2856,
  "perfect-balance": 17684,
  alternator: 11453,
  "consonant-chain": 151998,
  "vowel-chain": 63104,
  "a-to-u": 28,
  "next-door": 16304,
  bookends: 415,
  ing: 12564,
  ish: 554,
  ist: 1197,
  "i-before-e": 2169,
  "lone-q": 29,
  "quiet-letters": 1088,
  "flat-type": 6069,
  rewind: 844,
  ditto: 59,
  "from-latin": 30078,
  "from-french": 24550,
  "from-old-english": 12877,
  "from-greek": 7238,
  "from-proto-indo-european": 10667,
  "from-proto-germanic": 10509,
  "from-proto-west-germanic": 7831,
  "from-german": 3003,
  "from-italian": 2147,
  "from-norse": 2861,
  "from-dutch": 2403,
  "from-spanish": 1581,
  "from-arabic": 923,
  "sound-word": 49,
  "from-east-asia": 811,
  "from-frankish": 1267,
  "from-low-german": 1041,
  "from-irish": 760,
  "from-hindi": 492,
  "from-hebrew": 499,
  "from-portuguese": 493,
  "from-sanskrit": 427,
  "from-persian": 439,
  "from-scots": 513,
  "from-russian": 309,
  "from-yiddish": 323,
  "from-proto-celtic": 387,
  "from-ottoman-turkish": 254,
  "from-scottish-gaelic": 305,
  "from-proto-italic": 371,
  "from-gaulish": 279,
  "from-swedish": 214,
  "from-afrikaans": 100,
} as const;

export type FactorId = keyof typeof FACTOR_MATCHES;

export function rarityMultiplier(matches: number, wordCount = LIST_SIZE): number {
  if (matches <= 0 || wordCount <= 0) return 2;
  return Math.max(2, Math.round(3 * Math.log10(wordCount / matches)));
}

export const FACTOR_MULTIPLIERS: Record<FactorId, number> = Object.fromEntries(
  (Object.keys(FACTOR_MATCHES) as FactorId[]).map((id) => [
    id,
    id === "anagram" ? 4 : rarityMultiplier(FACTOR_MATCHES[id]),
  ]),
) as Record<FactorId, number>;

/**
 * Multiplier for a consonant run of this length. Built from how many ENABLE
 * words have a run at least this long, then raised where two lengths tied.
 * A run of 1 does not score.
 */
export const CONSONANT_CHAIN_MULTIPLIERS: Record<number, number> = {
  2: 2,
  3: 3,
  4: 4,
  5: 6,
  6: 8,
  7: 11,
  8: 12,
  9: 13,
};

/** Same ladder for vowel runs. No ties on the ENABLE list. */
export const VOWEL_CHAIN_MULTIPLIERS: Record<number, number> = {
  2: 2,
  3: 6,
  4: 10,
  5: 14,
};

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
  const doubleTwins = pairedTwins(normalized, 2);
  const tripleTwins = pairedTwins(normalized, 3);
  const palindrome = length >= 3 && normalized === [...normalized].reverse().join("");
  const allVowels = [...normalized].every((letter) => VOWELS.has(letter));
  const noVowels = [...normalized].every((letter) => !VOWELS.has(letter));
  const alphabetical = length >= 4 && isNonDecreasing(normalized);
  const backwardsAlphabet = length >= 2 && isNonIncreasing(normalized);
  const vowelSweep = VOWEL_ORDER.split("").every((vowel) => normalized.includes(vowel));
  const vowels = vowelCount(normalized);
  const consonants = length - vowels;
  const vowelRich = vowels > consonants;
  const oneVowel = oneVowelWonder(normalized);
  const aToU = hasVowelOrder(normalized);
  const nextDoor = Math.abs(normalized.charCodeAt(0) - normalized.charCodeAt(length - 1)) === 1;
  const ing = length > 3 && normalized.endsWith("ing");
  const ish = length > 3 && normalized.endsWith("ish");
  const ist = length > 3 && normalized.endsWith("ist");
  const spellingBreak = iBeforeEBreak(normalized);
  const loneQ = hasLoneQ(normalized);
  const quiet = quietPatterns(normalized);
  const flat = isFlat(normalized);
  const alternator = alternates(normalized);
  const consonantChain = longestRun(normalized, false);
  const vowelChain = longestRun(normalized, true);

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
      highlight: lengthFactor > 1 ? everyIndex(length) : undefined,
      reason: lengthFactor > 1 ? lengthReason(length) : undefined,
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
      id: "double-twins",
      name: "Double twins",
      hit: doubleTwins !== null,
      hitDetail: doubleTwins?.detail ?? "",
      missDetail: "No two letter pairs sit against each other.",
    },
    {
      id: "triple-twins",
      name: "Triple twins",
      hit: tripleTwins !== null,
      hitDetail: tripleTwins?.detail ?? "",
      missDetail: "No three letter pairs sit in a row.",
    },
    {
      id: "no-repeats",
      name: "No repeats",
      hit: new Set(normalized).size === length,
      hitDetail: "Every letter appears once.",
      missDetail: "A letter is used more than once.",
    },
    {
      id: "even-company",
      name: "Even company",
      hit: evenCompany(normalized),
      hitDetail: `${[...new Set(normalized)].join(", ")} each appear twice.`,
      missDetail: "A letter appears once, or more than twice.",
    },
    {
      id: "inside",
      name: "Inside",
      hit: insideHits(normalized).length > 0,
      hitDetail: "",
      missDetail: "No dictionary word of 3 or more letters sits inside.",
    },
    {
      id: "anagram",
      name: "Anagram",
      hit: anagramsOf(normalized).length > 0,
      hitDetail: "",
      missDetail: "No other dictionary word uses these exact letters.",
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
      id: "backwards-alphabet",
      name: "Backwards alphabet",
      hit: backwardsAlphabet,
      hitDetail: "Each letter is the same as or earlier than the one before it.",
      missDetail:
        length < 2
          ? "A one-letter word cannot run backwards through the alphabet."
          : "A letter comes later in the alphabet than the one before it.",
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
      id: "one-vowel-wonder",
      name: "One vowel wonder",
      hit: oneVowel.hit,
      hitDetail: `Every vowel is ${oneVowel.vowel.toUpperCase()} (${oneVowel.count} of them).`,
      missDetail: "Needs at least 3 vowels, and they all have to be the same one. Y does not count.",
    },
    {
      id: "perfect-balance",
      name: "Perfect balance",
      hit: vowels > 0 && vowels === consonants,
      hitDetail: `${vowels} vowels and ${consonants} consonants.`,
      missDetail:
        vowels === 0
          ? "No A, E, I, O, or U. Y counts as a consonant."
          : length % 2 === 1
            ? "An odd number of letters cannot split evenly."
            : "Vowels and consonants are not an even split.",
    },
    {
      id: "alternator",
      name: "Alternator",
      hit: alternator,
      hitDetail: "Vowels and consonants take turns. Y counts as a consonant.",
      missDetail:
        length < 2
          ? "A one-letter word cannot alternate."
          : "Two vowels or two consonants sit next to each other.",
    },
    {
      id: "consonant-chain",
      name: "Consonant chain",
      hit: consonantChain !== null,
      hitDetail: consonantChain ? chainReason(normalized, consonantChain, "consonants") : "",
      missDetail: "No consonant run longer than one letter. Y counts as a consonant.",
    },
    {
      id: "vowel-chain",
      name: "Vowel chain",
      hit: vowelChain !== null,
      hitDetail: vowelChain ? chainReason(normalized, vowelChain, "vowels") : "",
      missDetail: "No vowel run longer than one letter.",
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
      id: "bookends",
      name: "Bookends",
      hit: bookends(normalized),
      hitDetail: `Starts and ends with ${normalized.slice(0, 2)}.`,
      missDetail:
        length < 4
          ? "Needs at least 4 letters, so the two ends do not overlap."
          : "The first two letters are not the same as the last two.",
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
    if (factor.id === "inside") {
      const hits = insideSlices(normalized);
      if (hits.length === 0) {
        rows.push({
          id: factor.id,
          name: factor.name,
          detail: factor.missDetail,
          points: null,
          scored: false,
        });
        continue;
      }
      for (const hit of hits) {
        const next = running * multiplier;
        rows.push({
          id: factor.id,
          name: `${factor.name} ×${multiplier}`,
          detail: `${hit.text} sits inside. ${running.toLocaleString("en-US")} × ${multiplier} = ${next.toLocaleString("en-US")}.`,
          points: multiplier,
          scored: true,
          match: hit.text,
          highlight: everyIndex(hit.text.length).map((index) => index + hit.start),
          reason: `${hit.text} sits inside.`,
        });
        running = next;
      }
      continue;
    }
    if (factor.id === "anagram") {
      const hits = anagramsOf(normalized);
      if (hits.length === 0) {
        rows.push({
          id: factor.id,
          name: factor.name,
          detail: factor.missDetail,
          points: null,
          scored: false,
        });
        continue;
      }
      for (const hit of hits) {
        const next = running * multiplier;
        rows.push({
          id: factor.id,
          name: `${factor.name} ×${multiplier}`,
          detail: `${hit}. ${running.toLocaleString("en-US")} × ${multiplier} = ${next.toLocaleString("en-US")}.`,
          points: multiplier,
          scored: true,
          match: hit,
          highlight: everyIndex(normalized.length),
          reason: hit,
        });
        running = next;
      }
      continue;
    }
    if (factor.id === "consonant-chain" || factor.id === "vowel-chain") {
      const run = factor.id === "consonant-chain" ? consonantChain : vowelChain;
      if (!run) {
        rows.push({
          id: factor.id,
          name: factor.name,
          detail: factor.missDetail,
          points: null,
          scored: false,
        });
        continue;
      }
      const chainPoints = chainMultiplier(
        factor.id === "consonant-chain" ? CONSONANT_CHAIN_MULTIPLIERS : VOWEL_CHAIN_MULTIPLIERS,
        run.length,
      );
      const next = running * chainPoints;
      const reason = chainReason(
        normalized,
        run,
        factor.id === "consonant-chain" ? "consonants" : "vowels",
      );
      rows.push({
        id: factor.id,
        name: `${factor.name} ×${chainPoints}`,
        detail: `${reason} ${running.toLocaleString("en-US")} × ${chainPoints} = ${next.toLocaleString("en-US")}.`,
        points: chainPoints,
        scored: true,
        match: normalized.slice(run.start, run.end),
        highlight: Array.from({ length: run.length }, (_, offset) => run.start + offset),
        reason,
      });
      running = next;
      continue;
    }
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
      highlight: factorHighlight(factor.id, normalized),
      reason: factor.hitDetail.trim(),
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
    { id: "from-latin", name: "From Latin", tag: "latin", language: "Latin" },
    { id: "from-french", name: "From French", tag: "french", language: "French" },
    { id: "from-old-english", name: "From Old English", tag: "old-english", language: "Old English" },
    { id: "from-greek", name: "From Greek", tag: "greek", language: "Greek" },
    { id: "from-proto-indo-european", name: "From Proto-Indo-European", tag: "proto-indo-european", language: "Proto-Indo-European" },
    { id: "from-proto-germanic", name: "From Proto-Germanic", tag: "proto-germanic", language: "Proto-Germanic" },
    { id: "from-proto-west-germanic", name: "From Proto-West Germanic", tag: "proto-west-germanic", language: "Proto-West Germanic" },
    { id: "from-german", name: "From German", tag: "german", language: "German" },
    { id: "from-italian", name: "From Italian", tag: "italian", language: "Italian" },
    { id: "from-norse", name: "From Norse", tag: "norse", language: "Norse" },
    { id: "from-dutch", name: "From Dutch", tag: "dutch", language: "Dutch" },
    { id: "from-spanish", name: "From Spanish", tag: "spanish", language: "Spanish" },
    { id: "from-arabic", name: "From Arabic", tag: "arabic", language: "Arabic" },
    { id: "from-frankish", name: "From Frankish", tag: "frankish", language: "Frankish" },
    { id: "from-low-german", name: "From Low German", tag: "low-german", language: "Low German" },
    { id: "from-irish", name: "From Irish", tag: "irish", language: "Irish" },
    { id: "from-hindi", name: "From Hindi", tag: "hindi", language: "Hindi" },
    { id: "from-hebrew", name: "From Hebrew", tag: "hebrew", language: "Hebrew" },
    { id: "from-portuguese", name: "From Portuguese", tag: "portuguese", language: "Portuguese" },
    { id: "from-sanskrit", name: "From Sanskrit", tag: "sanskrit", language: "Sanskrit" },
    { id: "from-persian", name: "From Persian", tag: "persian", language: "Persian" },
    { id: "from-scots", name: "From Scots", tag: "scots", language: "Scots" },
    { id: "from-russian", name: "From Russian", tag: "russian", language: "Russian" },
    { id: "from-yiddish", name: "From Yiddish", tag: "yiddish", language: "Yiddish" },
    { id: "from-proto-celtic", name: "From Proto-Celtic", tag: "proto-celtic", language: "Proto-Celtic" },
    { id: "from-ottoman-turkish", name: "From Ottoman Turkish", tag: "ottoman-turkish", language: "Ottoman Turkish" },
    { id: "from-scottish-gaelic", name: "From Scottish Gaelic", tag: "scottish-gaelic", language: "Scottish Gaelic" },
    { id: "from-proto-italic", name: "From Proto-Italic", tag: "proto-italic", language: "Proto-Italic" },
    { id: "from-gaulish", name: "From Gaulish", tag: "gaulish", language: "Gaulish" },
    { id: "from-swedish", name: "From Swedish", tag: "swedish", language: "Swedish" },
    { id: "from-afrikaans", name: "From Afrikaans", tag: "afrikaans", language: "Afrikaans" },
  ];
  return [
    ...origins.map((origin) => ({
      id: origin.id,
      name: origin.name,
      hit: hasFact(word, origin.tag),
      hitDetail: `Wiktionary traces it to ${origin.language}.`,
      missDetail: `Wiktionary has no usable ${origin.language} origin for this word.`,
    })),
    {
      id: "from-east-asia",
      name: "From East Asia",
      hit: east.length > 0,
      hitDetail: `Wiktionary traces it to ${east.join(" and ")}.`,
      missDetail: "Wiktionary has no usable Chinese or Japanese origin for this word.",
    },
  ];
}

export function anagramsOf(word: string): string[] {
  const group = ANAGRAM_GROUPS.get([...word].sort().join("")) ?? [];
  return group.filter((other) => other !== word);
}

export function insideHits(word: string): string[] {
  return insideSlices(word).map((hit) => hit.text);
}

function insideSlices(word: string): Array<{ text: string; start: number }> {
  const hits: Array<{ text: string; start: number }> = [];
  for (let start = 0; start < word.length; start += 1) {
    for (let end = word.length; end >= start + 3; end -= 1) {
      if (start === 0 && end === word.length) continue;
      const text = word.slice(start, end);
      if (ENABLE_WORDS.has(text)) hits.push({ text, start });
    }
  }
  return hits;
}

function everyIndex(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}

function factorHighlight(id: FactorId, word: string): number[] {
  if (id === "twins") {
    return twinPositions(word).flatMap((flag, index) => (flag ? [index] : []));
  }
  if (id === "double-twins" || id === "triple-twins") {
    return pairedTwins(word, id === "triple-twins" ? 3 : 2)?.indexes ?? everyIndex(word.length);
  }
  if (id === "contraband") {
    return [...word].flatMap((letter, index) => (RARE.has(letter) ? [index] : []));
  }
  if (id === "next-door") return word.length < 2 ? [0] : [0, word.length - 1];
  if (id === "bookends") return [0, 1, word.length - 2, word.length - 1];
  if (id === "ing" || id === "ish" || id === "ist") return [word.length - 3, word.length - 2, word.length - 1];
  if (id === "lone-q") {
    return [...word].flatMap((letter, index) => (letter === "q" && word[index + 1] !== "u" ? [index] : []));
  }
  if (id === "quiet-letters") return quietIndices(word);
  if (id === "i-before-e") return iBeforeEIndices(word);
  if (id === "vowel-sweep" || id === "one-vowel-wonder") {
    return [...word].flatMap((letter, index) => (VOWELS.has(letter) ? [index] : []));
  }
  if (id === "a-to-u") return aToUIndices(word);
  if (id === "consonant-chain" || id === "vowel-chain") {
    const run = longestRun(word, id === "vowel-chain");
    if (!run) return everyIndex(word.length);
    return Array.from({ length: run.length }, (_, offset) => run.start + offset);
  }
  return everyIndex(word.length);
}

function quietIndices(word: string): number[] {
  const marks = new Set<number>();
  for (const prefix of QUIET_PREFIXES) {
    if (!word.startsWith(prefix)) continue;
    for (let index = 0; index < prefix.length; index += 1) marks.add(index);
  }
  if (word.endsWith("mb")) {
    marks.add(word.length - 2);
    marks.add(word.length - 1);
  }
  return [...marks].sort((left, right) => left - right);
}

function iBeforeEIndices(word: string): number[] {
  for (let index = 0; index < word.length - 1; index += 1) {
    const pair = word.slice(index, index + 2);
    const previous = index > 0 ? word[index - 1] : "";
    if (pair === "ei" && previous !== "c") return [index, index + 1];
    if (pair === "ie" && previous === "c") return [index - 1, index, index + 1];
  }
  return everyIndex(word.length);
}

function aToUIndices(word: string): number[] {
  const marks: number[] = [];
  let cursor = 0;
  for (let index = 0; index < word.length; index += 1) {
    if (word[index] !== VOWEL_ORDER[cursor]) continue;
    marks.push(index);
    cursor += 1;
    if (cursor === VOWEL_ORDER.length) break;
  }
  return marks;
}

function isTautonym(word: string): boolean {
  if (word.length < 4 || word.length % 2 !== 0) return false;
  const half = word.length / 2;
  return word.slice(0, half) === word.slice(half);
}

function lengthReason(length: number): string {
  if (length === LENGTH_CENTER) {
    return `${length} letters is the average in this dictionary, so length stays at ×1.`;
  }
  const distance = Math.abs(length - LENGTH_CENTER);
  const direction = length < LENGTH_CENTER ? "shorter" : "longer";
  const step = distance === 1 ? "step" : "steps";
  return `${length} letters, ${distance} ${step} ${direction} than ${LENGTH_CENTER}.`;
}

function lengthDetail(length: number, multiplier: number, before: number, after: number): string {
  const math = `${before.toLocaleString("en-US")} × ${multiplier} = ${after.toLocaleString("en-US")}.`;
  return `${lengthReason(length)} ${math}`;
}

type TwinStretch = { start: number; end: number; pairs: number };

/** Runs of exactly two identical letters. A longer run, such as aaa, is not a pair. */
function exactPairRuns(word: string): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  let index = 0;
  while (index < word.length) {
    let end = index + 1;
    while (end < word.length && word[end] === word[index]) end += 1;
    if (end - index === 2) runs.push({ start: index, end });
    index = end;
  }
  return runs;
}

function adjacentPairStretches(word: string): TwinStretch[] {
  const stretches: TwinStretch[] = [];
  let current: TwinStretch | null = null;
  for (const run of exactPairRuns(word)) {
    if (current && run.start === current.end) {
      current.end = run.end;
      current.pairs += 1;
      continue;
    }
    if (current) stretches.push(current);
    current = { start: run.start, end: run.end, pairs: 1 };
  }
  if (current) stretches.push(current);
  return stretches;
}

function pairedTwins(
  word: string,
  minimumPairs: number,
): { detail: string; indexes: number[] } | null {
  const stretches = adjacentPairStretches(word).filter((stretch) => stretch.pairs >= minimumPairs);
  if (stretches.length === 0) return null;
  const detail = stretches
    .map((stretch) => `${word.slice(stretch.start, stretch.end)} is ${stretch.pairs} pairs in a row`)
    .join(". ");
  const indexes = stretches.flatMap((stretch) =>
    Array.from({ length: stretch.end - stretch.start }, (_, offset) => stretch.start + offset),
  );
  return { detail: `${detail}.`, indexes };
}

function bookends(word: string): boolean {
  return word.length >= 4 && word.slice(0, 2) === word.slice(-2);
}

function evenCompany(word: string): boolean {
  const counts = new Map<string, number>();
  for (const letter of word) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  if (counts.size === 0) return false;
  for (const count of counts.values()) if (count !== 2) return false;
  return true;
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

function oneVowelWonder(word: string): { hit: boolean; vowel: string; count: number } {
  let vowel = "";
  let count = 0;
  for (const letter of word) {
    if (!VOWELS.has(letter)) continue;
    if (vowel && letter !== vowel) return { hit: false, vowel: "", count: 0 };
    vowel = letter;
    count += 1;
  }
  return { hit: count >= 3, vowel, count };
}

function alternates(word: string): boolean {
  if (word.length < 2) return false;
  for (let index = 1; index < word.length; index += 1) {
    const previous = VOWELS.has(word[index - 1]!);
    const current = VOWELS.has(word[index]!);
    if (previous === current) return false;
  }
  return true;
}

type LetterRun = { start: number; end: number; length: number };

/** First longest run of vowels, or of consonants when `vowel` is false. A run of 1 misses. */
function longestRun(word: string, vowel: boolean): LetterRun | null {
  let best: LetterRun | null = null;
  let start = -1;
  for (let index = 0; index <= word.length; index += 1) {
    const matches = index < word.length && VOWELS.has(word[index]!) === vowel;
    if (matches) {
      if (start < 0) start = index;
      continue;
    }
    if (start >= 0) {
      const length = index - start;
      if (length >= 2 && (best === null || length > best.length)) {
        best = { start, end: index, length };
      }
    }
    start = -1;
  }
  return best;
}

function chainReason(word: string, run: LetterRun, kind: "consonants" | "vowels"): string {
  return `${word.slice(run.start, run.end)} is ${run.length} ${kind} in a row.`;
}

function chainMultiplier(table: Record<number, number>, length: number): number {
  const known = table[length];
  if (known !== undefined) return known;
  const lengths = Object.keys(table)
    .map(Number)
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const longest = lengths.at(-1);
  if (longest === undefined || length <= longest) return 2;
  return table[longest]! + (length - longest);
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

function isNonIncreasing(word: string): boolean {
  for (let index = 1; index < word.length; index += 1) {
    if (word[index]! > word[index - 1]!) return false;
  }
  return true;
}
