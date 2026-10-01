/**
 * RWGdle scoring is a product of multipliers.
 *
 * Tile pile: standard English Scrabble values. That is the base.
 * Length: ×1 at 9 letters, the average (and median) length in the bundled list.
 * Each step shorter doubles (8→×2, 7→×4, 6→×8, …, 2→×128).
 * Each step longer adds one (10→×2, 11→×3, 12→×4, …).
 * Every other factor multiplies only when it hits. The multiplier is
 * round(3 × log10(list size / matches)), then raised to the power 1.5. A property most words share scores ×1.
 * Y is never a vowel. Ascenders are b d f h k l t. Descenders are g j p q y.
 * Origin tags come from English Wiktionary borrowed, inherited, and derived
 * templates. An inflected form inherits the lemma's origin languages.
 * A miss means Wiktionary has no usable origin for that language.
 * Sound-word tags still come from Webster's 1913 dictionary.
 */

import alphabetTwinGroups from "@/data/alphabet-twins.json";
import enableWordsText from "@/data/enable-words.json";
import shrinkingChains from "@/data/shrinking-chains.json";
import wordFacts from "@/data/word-facts.json";
import { RARE_LETTERS, tilesFor, twinPositions, type LedgerRow, type ScoredWord } from "@/lib/tiles";

export { formatRowValue, TILE_VALUES, type LedgerRow, type ScoredWord, type Tile } from "@/lib/tiles";

const ENABLE_WORDS = new Set((enableWordsText as string).split("\n").filter((word) => word.length > 0));
const SHRINKING_CHAINS = Object.assign(Object.create(null), shrinkingChains) as Record<string, string>;
const ALPHABET_TWINS = nullPrototypeGroups(alphabetTwinGroups as Record<string, Record<string, string[]>>);

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

const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const RARE = RARE_LETTERS;
const ASCENDERS = new Set(["b", "d", "f", "h", "k", "l", "t"]);
const DESCENDERS = new Set(["g", "j", "p", "q", "y"]);
const ROMAN_LETTERS = new Set(["i", "v", "x", "l", "c", "d", "m"]);
const VOWEL_ORDER = "aeiou";
const QUIET_PREFIXES = ["kn", "gn", "wr", "ps", "rh"] as const;

/** How many bundled words have each property. Precompute checks these counts. */
export const FACTOR_MATCHES = {
  mirror: 101,
  "hidden-mirror": 3148,
  contraband: 16286,
  twins: 41209,
  "double-twins": 223,
  "triple-twins": 4,
  "no-repeats": 34816,
  "even-company": 92,
  "perfectly-shared": 34909,
  inside: 167370,
  "letter-sandwich": 7298,
  "shrinking-word": 9924,
  "inside-out": 1061,
  "swap-shop": 2815,
  "alphabet-step": 16735,
  "lonely-word": 35181,
  "double-or-nothing": 5429,
  "woven-together": 1490,
  "building-blocks": 4186,
  "alphabet-twins": 127151,
  "front-or-back": 5031,
  anagram: 28648,
  "a-cappella": 5,
  "bone-dry": 121,
  "alphabet-soup": 411,
  "backwards-alphabet": 432,
  "letter-collector": 145,
  "alphabet-staircase": 1502,
  "roman-word": 28,
  "periodic-spelling": 28923,
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
  "calculator-word": 544,
  "upside-down": 8,
  typewriter: 571,
  "home-row": 184,
  "left-handed": 3381,
  "right-handed": 426,
  "hand-to-hand": 1626,
  "sheet-music": 121,
  "hidden-number": 3557,
  "hidden-animal": 13436,
  popular: 14466,
  bingo: 23109,
  "u-to-a": 6,
  "a-to-z": 2,
  "morse-mirror": 680,
  "keyboard-walk": 50,
  "looking-glass": 21,
  "all-dots": 28,
} as const;

export type FactorId = keyof typeof FACTOR_MATCHES;

/**
 * Inside and Anagram are a flat ×2 per hit. Every other card's base value is
 * raised to this power, which sets their weight against those two.
 */
export const RARITY_POWER = 1.5;

/** round(raw), then raised to RARITY_POWER. A base of ×1 stays ×1 and does not score. */
function rarityCurve(raw: number): number {
  const base = Math.max(1, Math.round(raw));
  return base === 1 ? 1 : Math.round(base ** RARITY_POWER);
}

/**
 * round(3 × log10(list size / matches)) ^ 1.5. A property that about a third
 * of words have, or more, comes out at ×1 and does not score.
 */
export function rarityMultiplier(matches: number, wordCount = LIST_SIZE): number {
  if (matches <= 0 || wordCount <= 0) return 2;
  return rarityCurve(3 * Math.log10(wordCount / matches));
}

export const FACTOR_MULTIPLIERS: Record<FactorId, number> = Object.fromEntries(
  (Object.keys(FACTOR_MATCHES) as FactorId[]).map((id) => [id, rarityMultiplier(FACTOR_MATCHES[id])]),
) as Record<FactorId, number>;

/**
 * Inside and Anagram pay a card for every hit, so more hidden words or more
 * anagrams always score higher. Each hit multiplies by this.
 */
export const PER_HIT_MULTIPLIERS = {
  inside: 2,
  anagram: 2,
} as const satisfies Partial<Record<FactorId, number>>;

export type PerHitFactorId = keyof typeof PER_HIT_MULTIPLIERS;

/**
 * The other factors that can hit more than once. Each entry is how many words
 * have at least k hits, for k = 1, 2, 3, … The factor is one card, priced by
 * how rare that many hits is.
 */
export const STACK_MATCHES = {
  "alphabet-step": [16735, 2950, 542, 93, 9, 1],
  "swap-shop": [2815, 90, 1],
  "double-or-nothing": [5429, 130, 1],
} as const satisfies Partial<Record<FactorId, readonly number[]>>;

export type StackedFactorId = keyof typeof STACK_MATCHES;

export function stackMultiplier(id: StackedFactorId, hits: number): number {
  if (hits <= 0) return 1;
  const table = STACK_MATCHES[id];
  return rarityMultiplier(table[Math.min(hits, table.length) - 1]!);
}

/** Fewest hits that score at all. */
export function stackThreshold(id: StackedFactorId): number {
  const table = STACK_MATCHES[id];
  for (let hits = 1; hits <= table.length; hits += 1) if (stackMultiplier(id, hits) > 1) return hits;
  return table.length;
}

/**
 * Multiplier for a consonant run of this length. Built from how many ENABLE
 * words have a run at least this long, then raised where two lengths tied, and
 * raised to RARITY_POWER like every other card.
 * A run of 1 does not score.
 */
export const CONSONANT_CHAIN_MULTIPLIERS: Record<number, number> = {
  // 88% of words have a run of 2, so it does not score.
  2: 1,
  3: 5,
  4: 8,
  5: 15,
  6: 23,
  7: 36,
  8: 42,
  9: 47,
};

/** Same ladder for vowel runs, also raised to RARITY_POWER. No ties on the ENABLE list. */
export const VOWEL_CHAIN_MULTIPLIERS: Record<number, number> = {
  2: 3,
  3: 15,
  4: 32,
  5: 52,
};

/** How many bundled words have each length. */
export const LENGTH_COUNTS: Record<number, number> = {
  2: 96, 3: 972, 4: 3903, 5: 8636, 6: 15232, 7: 23109, 8: 28420, 9: 24873, 10: 20302, 11: 15504, 12: 11358,
  13: 7827, 14: 5127, 15: 3192, 16: 1943, 17: 1127, 18: 594, 19: 329, 20: 160, 21: 62, 22: 30, 23: 13, 24: 9,
  25: 2, 27: 2, 28: 1,
};

const COMMONEST_LENGTH_COUNT = Math.max(...Object.values(LENGTH_COUNTS));

/** Priced by rarity against the most common length (8 letters), the same in both directions. */
export function lengthMultiplier(length: number): number {
  const count = LENGTH_COUNTS[length] ?? 1;
  return rarityCurve(3 * Math.log10(COMMONEST_LENGTH_COUNT / count));
}

export function scoreWord(word: string): ScoredWord {
  const normalized = word.toLowerCase();
  if (!/^[a-z]+$/.test(normalized)) {
    throw new Error(`Cannot score "${word}"`);
  }

  const tiles = tilesFor(normalized);
  const tileSum = tiles.reduce((sum, tile) => sum + tile.value, 0);
  const length = normalized.length;
  const lengthFactor = lengthMultiplier(length);

  const rareTiles = [...normalized].filter((letter) => RARE.has(letter));
  const runs = twinRuns(normalized);
  const doubleTwins = pairedTwins(normalized, 2);
  const tripleTwins = pairedTwins(normalized, 3);
  const palindrome = isMirror(normalized);
  const hiddenMirror = hiddenMirrorRun(normalized);
  const allVowels = [...normalized].every((letter) => VOWELS.has(letter));
  const roman = isRomanWord(normalized);
  const periodic = periodicSpelling(normalized);
  const noVowels = [...normalized].every((letter) => !VOWELS.has(letter));
  const alphabetical = length >= 4 && isNonDecreasing(normalized);
  const backwardsAlphabet = length >= 2 && isNonIncreasing(normalized);
  const collected = letterCollector(normalized);
  const staircase = alphabetStaircaseRuns(normalized);
  const sandwich = letterSandwich(normalized);
  const trimmedEnds = frontOrBack(normalized);
  const shrinking = SHRINKING_CHAINS[normalized] ?? null;
  const rotated = insideOut(normalized);
  const alphabetTwins = alphabetTwinPartners(normalized);
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
  const calculator = calculatorDigits(normalized);
  const upsideDown = readsUpsideDown(normalized);
  const numbers = hiddenWords(normalized, NUMBER_WORDS);
  const animals = hiddenWords(normalized, ANIMAL_WORDS);
  const neighbours = length <= POPULAR_MAX_LENGTH ? neighbourCount(normalized) : 0;
  const uToA = hasReverseVowelOrder(normalized);
  const morse = morseCode(normalized);
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

  const woven = wovenWords(normalized);
  const blocks = buildingBlockRun(normalized);
  const lonely = isLonelyWord(normalized);
  const shared = perfectlySharedCount(normalized);

  const factors: Array<{
    id: FactorId;
    name: string;
    hit: boolean;
    hitDetail: string;
    missDetail: string;
    match?: string;
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
      id: "hidden-mirror",
      name: "Hidden mirror",
      hit: hiddenMirror !== null,
      hitDetail: hiddenMirror
        ? `${normalized.slice(hiddenMirror.start, hiddenMirror.end)} reads the same backwards, in a run of at least five letters that is not the whole word.`
        : "",
      missDetail: palindrome
        ? "The whole word is a mirror."
        : "No run of 5 or more letters reads the same backwards.",
    },
    {
      id: "rewind",
      name: "Rewind",
      hit: hasFact(normalized, "rewind"),
      hitDetail: `Read backwards, it is a different dictionary word: ${[...normalized].reverse().join("")}.`,
      missDetail: palindrome
        ? "Backwards, it is the same word. That is Mirror."
        : "Backwards, it is not a different word in this dictionary.",
    },
    {
      id: "contraband",
      name: "Contraband",
      hit: rareTiles.length > 0,
      hitDetail: `J, Q, X, and Z are rare Scrabble letters. This word has ${rareTiles.length} rare ${rareTiles.length === 1 ? "tile" : "tiles"} (${rareTiles.map((letter) => letter.toUpperCase()).join(", ")}).`,
      missDetail: "No J, Q, X, or Z.",
    },
    {
      id: "twins",
      name: "Twins",
      hit: runs.length > 0,
      hitDetail: `A letter sits next to a copy of itself: ${runs.join(", ")}.`,
      missDetail: "No letter sits next to itself.",
    },
    {
      id: "double-twins",
      name: "Double twins",
      hit: doubleTwins !== null,
      hitDetail: doubleTwins
        ? `Two or more doubled letters sit against each other. ${doubleTwins.detail}`
        : "",
      missDetail: "No two letter pairs sit against each other.",
    },
    {
      id: "triple-twins",
      name: "Triple twins",
      hit: tripleTwins !== null,
      hitDetail: tripleTwins
        ? `Three or more doubled letters sit in a row. ${tripleTwins.detail}`
        : "",
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
      hitDetail: `Every letter appears exactly twice. ${[...new Set(normalized)].join(", ")} each appear twice.`,
      missDetail: "A letter appears once, or more than twice.",
    },
    {
      id: "perfectly-shared",
      name: "Perfectly shared",
      hit: shared !== null,
      hitDetail:
        shared === null
          ? ""
          : `Every different letter appears the same number of times. ${perfectlySharedDetail(normalized, shared)}`,
      missDetail: "The letters do not all occur the same number of times.",
    },
    {
      id: "inside",
      name: "Inside",
      hit: insideHits(normalized).length > 0,
      hitDetail: "",
      missDetail: "No dictionary word of 3 or more letters sits inside.",
    },
    {
      id: "letter-sandwich",
      name: "Letter sandwich",
      hit: sandwich !== null,
      hitDetail: sandwich
        ? `Take off the first and last letters and a dictionary word is left: ${sandwich}.`
        : "",
      missDetail:
        length < 5
          ? "Needs at least 5 letters, so the inside can be a word of 3 or more."
          : "The inside, with the first and last letters removed, is not a dictionary word.",
    },
    {
      id: "front-or-back",
      name: "Front or back",
      hit: trimmedEnds !== null,
      hitDetail: trimmedEnds
        ? `Drop the first letter and a word remains, and drop the last letter and a word remains: ${trimmedEnds.withoutFirst} and ${trimmedEnds.withoutLast}.`
        : "",
      missDetail: "Removing the first letter, or the last, does not leave a dictionary word.",
    },
    {
      id: "shrinking-word",
      name: "Shrinking word",
      hit: shrinking !== null,
      hitDetail: shrinking
        ? `Each step deletes one letter and is still a dictionary word. ${shrinking}`
        : "",
      missDetail: "No chain of 5 dictionary words by deleting one letter at a time.",
    },
    {
      id: "inside-out",
      name: "Inside out",
      hit: rotated !== null,
      hitDetail: rotated ? `Move the first letter to the end and you get another word: ${rotated}.` : "",
      missDetail: "Moving the first letter to the end is not a different dictionary word.",
    },
    {
      id: "swap-shop",
      name: "Swap shop",
      hit: swapShopHits(normalized).length > 0,
      hitDetail: "",
      missDetail: "No adjacent swap of two different letters is another dictionary word.",
    },
    {
      id: "alphabet-step",
      name: "Alphabet step",
      hit: alphabetStepHits(normalized).length > 0,
      hitDetail: "",
      missDetail: "No one-letter step to an alphabetical neighbour is another dictionary word.",
    },
    {
      id: "lonely-word",
      name: "Lonely word",
      hit: lonely,
      hitDetail: "No other dictionary word is one insertion, deletion, or substitution away.",
      missDetail: "Another dictionary word is one insertion, deletion, or substitution away.",
    },
    {
      id: "double-or-nothing",
      name: "Double or nothing",
      hit: doubleOrNothingHits(normalized).length > 0,
      hitDetail: "",
      missDetail: "No single letter doubles into another dictionary word, and no doubled pair comes from one.",
    },
    {
      id: "woven-together",
      name: "Two words woven together",
      hit: woven !== null,
      hitDetail: woven
        ? `Taking every other letter makes two words. Odd letters spell ${woven.odd}, and even letters spell ${woven.even}.`
        : "",
      missDetail:
        length < 4
          ? "Needs at least 4 letters, so each strand is a word of 2 or more."
          : "The odd letters and the even letters are not both dictionary words.",
      match: woven ? `${woven.odd} and ${woven.even}` : undefined,
    },
    {
      id: "building-blocks",
      name: "Building blocks",
      hit: blocks !== null,
      hitDetail: blocks
        ? `Prefixes that grow by one letter are all dictionary words: ${blocks.join(", ")}.`
        : "",
      missDetail: "No 4 neighbouring prefixes are dictionary words.",
      match: blocks ? blocks.join(", ") : undefined,
    },
    {
      id: "alphabet-twins",
      name: "Alphabet twins",
      hit: alphabetTwins !== null,
      hitDetail: alphabetTwins
        ? `Another word uses these same letters, but not the same number of each. ${formatAlphabetTwins(alphabetTwins)}`
        : "",
      missDetail: "No other word uses these letters with different counts.",
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
      id: "letter-collector",
      name: "Letter collector",
      hit: collected !== null,
      hitDetail: collected ? letterCollectorDetail(collected) : "",
      missDetail: "The longest unbroken stretch of the alphabet is shorter than 6 letters.",
    },
    {
      id: "alphabet-staircase",
      name: "Alphabet staircase",
      hit: staircase.length > 0,
      hitDetail: staircase.length > 0 ? alphabetStaircaseDetail(normalized, staircase) : "",
      missDetail: "No three letters in a row step up the alphabet.",
    },
    {
      id: "roman-word",
      name: "Roman word",
      hit: roman,
      hitDetail: "Every letter is a Roman-numeral symbol: I, V, X, L, C, D, or M.",
      missDetail: "A letter is not I, V, X, L, C, D, or M.",
    },
    {
      id: "periodic-spelling",
      name: "Periodic spelling",
      hit: periodic !== null,
      hitDetail: periodic
        ? `The whole word splits into chemical element symbols: ${formatPeriodicSpelling(periodic.symbols)}.`
        : "",
      missDetail: "The letters do not split entirely into element symbols.",
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
      hitDetail: `Vowels outnumber the consonants: ${vowels} ${vowels === 1 ? "vowel" : "vowels"}, ${consonants} ${consonants === 1 ? "consonant" : "consonants"}.`,
      missDetail:
        vowels === consonants
          ? "Vowels and consonants are tied."
          : "Consonants outnumber the vowels.",
    },
    {
      id: "one-vowel-wonder",
      name: "One vowel wonder",
      hit: oneVowel.hit,
      hitDetail: `At least three vowels, and they are all the same letter. Every vowel is ${oneVowel.vowel.toUpperCase()} (${oneVowel.count} of them).`,
      missDetail: "Needs at least 3 vowels, and they all have to be the same one. Y does not count.",
    },
    {
      id: "perfect-balance",
      name: "Perfect balance",
      hit: vowels > 0 && vowels === consonants,
      hitDetail: `Vowels and consonants split evenly: ${vowels} vowels and ${consonants} consonants.`,
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
      hitDetail: `The first and last letters sit next to each other in the alphabet: ${normalized[0]!.toUpperCase()} and ${normalized[length - 1]!.toUpperCase()}.`,
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
      hitDetail: `A usually silent spelling shows up: ${quiet.join(", ")}.`,
      missDetail: "No KN, GN, WR, PS, or RH at the start, and it does not end in MB.",
    },
    {
      id: "flat-type",
      name: "Flat type",
      hit: flat,
      hitDetail: "No ascenders (b d f h k l t) and no descenders (g j p q y).",
      missDetail: "A letter climbs above the line or drops below it.",
    },
    {
      id: "calculator-word",
      name: "Calculator word",
      hit: calculator !== null,
      hitDetail: calculator
        ? `Type ${calculator} on a calculator and turn it upside down: it reads ${normalized.toUpperCase()}.`
        : "",
      missDetail: "An upside-down calculator can't spell it. Only O, I, Z, E, H, S, G, L, and B work.",
    },
    {
      id: "upside-down",
      name: "Upside down",
      hit: upsideDown,
      hitDetail: `Turn it upside down and it still reads ${normalized}.`,
      missDetail: "Turned upside down, it no longer reads the same.",
    },
    {
      id: "typewriter",
      name: "Typewriter",
      hit: length >= 3 && usesOnly(normalized, TOP_ROW),
      hitDetail: "Every letter is on the top row of the keyboard: Q W E R T Y U I O P.",
      missDetail: "A letter is off the top row of the keyboard.",
    },
    {
      id: "home-row",
      name: "Home row",
      hit: length >= 3 && usesOnly(normalized, HOME_ROW),
      hitDetail: "Every letter is on the keyboard's home row: A S D F G H J K L.",
      missDetail: "A letter is off the keyboard's home row.",
    },
    {
      id: "left-handed",
      name: "Left handed",
      hit: length >= 3 && usesOnly(normalized, LEFT_HAND),
      hitDetail: "Touch-typed with the left hand alone: Q W E R T, A S D F G, Z X C V B.",
      missDetail: "Touch-typing it needs the right hand too.",
    },
    {
      id: "right-handed",
      name: "Right handed",
      hit: length >= 3 && usesOnly(normalized, RIGHT_HAND),
      hitDetail: "Touch-typed with the right hand alone: Y U I O P, H J K L, N M.",
      missDetail: "Touch-typing it needs the left hand too.",
    },
    {
      id: "hand-to-hand",
      name: "Hand to hand",
      hit: handToHand(normalized),
      hitDetail: "Touch-typing it, your hands take turns on every single letter.",
      missDetail: "Touch-typing it, one hand types two letters in a row.",
    },
    {
      id: "sheet-music",
      name: "Sheet music",
      hit: length >= 3 && usesOnly(normalized, MUSIC_NOTES),
      hitDetail: `Every letter is a musical note, A to G. Listen: ${normalized.toUpperCase().split("").join(" ")}.`,
      missDetail: "A letter is not a musical note (A to G).",
    },
    {
      id: "hidden-number",
      name: "Hidden number",
      hit: numbers.length > 0,
      hitDetail: `A number hides inside: ${numbers.map((hit) => hit.text).join(", ")}.`,
      missDetail: "No number from one to twelve hides inside.",
    },
    {
      id: "hidden-animal",
      name: "Hidden animal",
      hit: animals.length > 0,
      hitDetail: `${animals.length === 1 ? "An animal hides" : "Animals hide"} inside: ${animals.map((hit) => hit.text).join(", ")}.`,
      missDetail: "No animal hides inside.",
    },
    {
      id: "popular",
      name: "Popular",
      hit: neighbours >= POPULAR_NEIGHBOURS,
      hitDetail: `${neighbours} other words are one letter change, insertion, or deletion away.`,
      missDetail: `Fewer than ${POPULAR_NEIGHBOURS} words are one letter change, insertion, or deletion away.`,
    },
    {
      id: "bingo",
      name: "Bingo",
      hit: length === 7,
      hitDetail: "Seven letters: a full Scrabble rack. Playing every tile at once is a bingo.",
      missDetail: "Not seven letters, so it can't empty a Scrabble rack.",
    },
    {
      id: "u-to-a",
      name: "U to A",
      hit: uToA,
      hitDetail: "U, then O, then I, then E, then A: the vowels backwards, in order.",
      missDetail: "U, O, I, E, and A do not line up in reverse order.",
    },
    {
      id: "morse-mirror",
      name: "Morse mirror",
      hit: morse !== null && length >= 3 && morse === [...morse].reverse().join(""),
      hitDetail: `In Morse code it reads the same backwards: ${morse}.`,
      missDetail: "Its Morse code does not read the same backwards.",
    },
    {
      id: "all-dots",
      name: "All dots",
      hit: length >= 3 && usesOnly(normalized, MORSE_DOTS),
      hitDetail: `Every letter is only dots in Morse code: ${morse}.`,
      missDetail: "A letter has a dash in Morse code. Only E, I, S, and H are all dots.",
    },
    {
      id: "keyboard-walk",
      name: "Keyboard walk",
      hit: keyboardWalk(normalized),
      hitDetail: "Each letter sits right next to the one before it on the keyboard.",
      missDetail: "Two letters in a row are not neighbours on the keyboard.",
    },
    {
      id: "looking-glass",
      name: "Looking glass",
      hit: palindrome && usesOnly(normalized, MIRROR_CAPITALS),
      hitDetail: `Hold ${normalized.toUpperCase()} up to a mirror and it reads exactly the same.`,
      missDetail: palindrome
        ? "A capital letter flips into a different shape in a mirror."
        : "In a mirror it reads backwards.",
    },
    {
      id: "a-to-z",
      name: "A to Z",
      hit: length >= 2 && normalized.startsWith("a") && normalized.endsWith("z"),
      hitDetail: "Starts with A and ends with Z: the whole alphabet, end to end.",
      missDetail: "Does not start with A and end with Z.",
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

  const covered = coveredFactors(factors);

  for (const factor of factors) {
    const multiplier = FACTOR_MULTIPLIERS[factor.id];
    const stacked = stackedHits(factor.id, normalized);
    if (stacked && factor.id in PER_HIT_MULTIPLIERS) {
      const id = factor.id as PerHitFactorId;
      if (stacked.length === 0) {
        rows.push({ id: factor.id, name: factor.name, detail: factor.missDetail, points: null, scored: false });
        continue;
      }
      const points = PER_HIT_MULTIPLIERS[id];
      for (const hit of stacked) {
        const next = running * points;
        const reason = stackReason(id, [hit]);
        rows.push({
          id: factor.id,
          name: `${factor.name} ×${points}`,
          detail: `${reason} ${running.toLocaleString("en-US")} × ${points} = ${next.toLocaleString("en-US")}.`,
          points,
          scored: true,
          matched: true,
          match: hit.match,
          highlight: hit.highlight,
          reason,
        });
        running = next;
      }
      continue;
    }
    if (stacked) {
      const id = factor.id as StackedFactorId;
      const points = stackMultiplier(id, stacked.length);
      if (points <= 1) {
        rows.push({
          id: factor.id,
          name: factor.name,
          detail:
            stacked.length === 0
              ? factor.missDetail
              : `${stackReason(id, stacked)} That's common here: it takes ${stackThreshold(id)} to score.`,
          points: null,
          scored: false,
          matched: stacked.length > 0,
        });
        continue;
      }
      const next = running * points;
      const reason = stackReason(id, stacked);
      rows.push({
        id: factor.id,
        name: `${factor.name} ×${points}`,
        detail: `${reason} ${running.toLocaleString("en-US")} × ${points} = ${next.toLocaleString("en-US")}.`,
        points,
        scored: true,
        matched: true,
        match: stacked.map((hit) => hit.match).join(", "),
        highlight: [...new Set(stacked.flatMap((hit) => hit.highlight))].sort((left, right) => left - right),
        reason,
      });
      running = next;
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
      if (chainPoints <= 1) {
        rows.push({
          id: factor.id,
          name: factor.name,
          detail: `${chainReason(normalized, run, factor.id === "consonant-chain" ? "consonants" : "vowels")} Most words have a run this long, so it does not score.`,
          points: null,
          scored: false,
          matched: true,
        });
        continue;
      }
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
        matched: true,
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
    const coveredBy = covered.get(factor.id);
    if (coveredBy || multiplier <= 1) {
      rows.push({
        id: factor.id,
        name: factor.name,
        detail: `${factor.hitDetail.trim()} ${coveredBy ?? "Most words have this, so it does not score."}`,
        points: null,
        scored: false,
        matched: true,
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
      matched: true,
      highlight: factorHighlight(factor.id, normalized),
      reason: factor.hitDetail.trim(),
      match: factor.match,
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

type StackHit = { match: string; highlight: number[] };

function stackedHits(id: FactorId, word: string): StackHit[] | null {
  switch (id) {
    case "inside":
      return insideSlices(word).map((hit) => ({
        match: hit.text,
        highlight: everyIndex(hit.text.length).map((index) => index + hit.start),
      }));
    case "anagram":
      return anagramsOf(word).map((other) => ({ match: other, highlight: everyIndex(word.length) }));
    case "alphabet-step":
      return alphabetStepHits(word).map((hit) => ({ match: hit.word, highlight: [hit.index] }));
    case "swap-shop":
      return swapShopHits(word).map((hit) => ({ match: hit.word, highlight: [hit.index, hit.index + 1] }));
    case "double-or-nothing":
      return doubleOrNothingHits(word).map((hit) => ({ match: hit.word, highlight: hit.highlight }));
    default:
      return null;
  }
}

function listWords(hits: StackHit[]): string {
  const shown = hits.slice(0, 8).map((hit) => hit.match);
  const more = hits.length - shown.length;
  return more > 0 ? `${shown.join(", ")}, and ${more} more` : shown.join(", ");
}

function stackReason(id: StackedFactorId | PerHitFactorId, hits: StackHit[]): string {
  const one = hits.length === 1;
  const list = listWords(hits);
  switch (id) {
    case "inside":
      return one
        ? `A dictionary word of at least 3 letters is hidden in this one: ${list}.`
        : `${hits.length} dictionary words of at least 3 letters are hidden in this one: ${list}.`;
    case "anagram":
      return one
        ? `Another word uses these exact letters: ${list}.`
        : `${hits.length} other words use these exact letters: ${list}.`;
    case "alphabet-step":
      return one
        ? `Change one letter to the next or previous letter in the alphabet and you get another word: ${list}.`
        : `${hits.length} words are one alphabet step away, changing a letter to its neighbour: ${list}.`;
    case "swap-shop":
      return one
        ? `Swap two neighbouring letters and you get another word: ${list}.`
        : `${hits.length} different swaps of neighbouring letters make words: ${list}.`;
    case "double-or-nothing":
      return one
        ? `Double a letter, or undo a doubled pair, and you get another word: ${list}.`
        : `${hits.length} words are a doubled or undoubled letter away: ${list}.`;
  }
}

const ORIGIN_IDS = new Set<FactorId>(
  (Object.keys(FACTOR_MATCHES) as FactorId[]).filter((id) => id.startsWith("from-")),
);

/**
 * Hits that would pay twice for one property, each mapped to why it does not score.
 * Twins, Double twins, Triple twins: only the highest scores.
 * Perfectly shared: No repeats and Even company already cover those words.
 * Origins: one family tree, so only the rarest root scores.
 */
function coveredFactors(factors: Array<{ id: FactorId; name: string; hit: boolean }>): Map<FactorId, string> {
  const hit = new Set(factors.filter((factor) => factor.hit).map((factor) => factor.id));
  const covered = new Map<FactorId, string>();
  if (hit.has("triple-twins")) {
    covered.set("double-twins", "Triple twins already covers this.");
    covered.set("twins", "Triple twins already covers this.");
  } else if (hit.has("double-twins")) {
    covered.set("twins", "Double twins already covers this.");
  }
  if (hit.has("looking-glass")) covered.set("mirror", "Looking glass already covers this.");
  if (hit.has("all-dots")) covered.set("morse-mirror", "All dots already covers this.");
  if (hit.has("no-repeats")) covered.set("perfectly-shared", "No repeats already covers this.");
  else if (hit.has("even-company")) covered.set("perfectly-shared", "Even company already covers this.");
  const origins = factors.filter((factor) => factor.hit && ORIGIN_IDS.has(factor.id));
  if (origins.length > 1) {
    const rarest = origins.reduce((best, factor) =>
      FACTOR_MATCHES[factor.id] < FACTOR_MATCHES[best.id] ? factor : best,
    );
    for (const factor of origins) {
      if (factor !== rarest) {
        covered.set(factor.id, `Only the rarest root scores, and that is ${rarest.name.replace(/^From /, "")}.`);
      }
    }
  }
  return covered;
}

const TOP_ROW = new Set("qwertyuiop");
const HOME_ROW = new Set("asdfghjkl");
const LEFT_HAND = new Set("qwertasdfgzxcvb");
const RIGHT_HAND = new Set("yuiophjklnm");
const MUSIC_NOTES = new Set("abcdefg");

function usesOnly(word: string, letters: Set<string>): boolean {
  return [...word].every((letter) => letters.has(letter));
}

/** At least 4 letters, and touch-typing switches hands on every letter. */
function handToHand(word: string): boolean {
  if (word.length < 4) return false;
  for (let index = 1; index < word.length; index += 1) {
    if (LEFT_HAND.has(word[index]!) === LEFT_HAND.has(word[index - 1]!)) return false;
  }
  return true;
}

/** Digits that show this word on an upside-down calculator: typed in reverse, 0=O 1=I 2=Z 3=E 4=h 5=S 6=g 7=L 8=B. */
const CALCULATOR_DIGITS: Record<string, string> = { o: "0", i: "1", z: "2", e: "3", h: "4", s: "5", g: "6", l: "7", b: "8" };

function calculatorDigits(word: string): string | null {
  if (word.length < 3) return null;
  let digits = "";
  for (const letter of [...word].reverse()) {
    const digit = CALCULATOR_DIGITS[letter];
    if (digit === undefined) return null;
    digits += digit;
  }
  return digits;
}

/** Letters that still read as a letter when turned 180°, and what they become. */
const UPSIDE_DOWN: Record<string, string> = {
  s: "s", z: "z", o: "o", x: "x", l: "l", n: "u", u: "n", d: "p", p: "d", b: "q", q: "b", m: "w", w: "m",
};

function readsUpsideDown(word: string): boolean {
  if (word.length < 3) return false;
  let turned = "";
  for (const letter of [...word].reverse()) {
    const flipped = UPSIDE_DOWN[letter];
    if (flipped === undefined) return false;
    turned += flipped;
  }
  return turned === word;
}

const NUMBER_WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

const ANIMAL_WORDS = [
  "ant", "ape", "asp", "bat", "bee", "cat", "cod", "cow", "doe", "dog", "eel", "elk", "emu", "ewe", "fox", "gnu",
  "hen", "hog", "owl", "pig", "ram", "rat", "yak", "bear", "boar", "crab", "crow", "deer", "duck", "frog", "goat",
  "hare", "lamb", "lion", "lynx", "mole", "moth", "mule", "newt", "puma", "seal", "slug", "swan", "toad", "wasp",
  "wolf", "worm", "camel", "horse", "hyena", "llama", "moose", "mouse", "otter", "panda", "shark", "sheep", "skunk",
  "snake", "squid", "tiger", "whale", "zebra", "donkey", "ferret", "monkey", "parrot", "rabbit", "turtle",
];

/** Each listed word hiding inside this one, but not the whole word. Overlaps all count. */
function hiddenWords(word: string, list: readonly string[]): Array<{ text: string; start: number }> {
  const hits: Array<{ text: string; start: number }> = [];
  for (const text of list) {
    if (text === word) continue;
    let start = word.indexOf(text);
    while (start !== -1) {
      hits.push({ text, start });
      start = word.indexOf(text, start + 1);
    }
  }
  return hits.sort((left, right) => left.start - right.start || right.text.length - left.text.length);
}

/** Popular: at least this many different words are one edit away. */
const POPULAR_NEIGHBOURS = 8;
/** The longest Popular word in the list is 11 letters (mustinesses), so longer words skip the search. */
const POPULAR_MAX_LENGTH = 11;

/** Different dictionary words one insertion, deletion, or substitution away. */
function neighbourCount(word: string): number {
  const found = new Set<string>();
  for (let index = 0; index <= word.length; index += 1) {
    const prefix = word.slice(0, index);
    const suffix = word.slice(index);
    for (const letter of EDIT_ALPHABET) {
      const inserted = prefix + letter + suffix;
      if (ENABLE_WORDS.has(inserted)) found.add(inserted);
      if (index < word.length && letter !== word[index]) {
        const swapped = prefix + letter + word.slice(index + 1);
        if (ENABLE_WORDS.has(swapped)) found.add(swapped);
      }
    }
    if (index < word.length) {
      const deleted = prefix + word.slice(index + 1);
      if (deleted.length > 0 && ENABLE_WORDS.has(deleted)) found.add(deleted);
    }
  }
  found.delete(word);
  return found.size;
}

const MORSE: Record<string, string> = {
  a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---", k: "-.-",
  l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-",
  w: ".--", x: "-..-", y: "-.--", z: "--..",
};
const MORSE_DOTS = new Set("eish");

/** The word in Morse code, letters run together. */
function morseCode(word: string): string | null {
  let code = "";
  for (const letter of word) {
    const symbol = MORSE[letter];
    if (symbol === undefined) return null;
    code += symbol;
  }
  return code;
}

/** Capitals that look the same in a mirror. */
const MIRROR_CAPITALS = new Set("ahimotuvwxy");

/** QWERTY key positions. Each row sits half a key to the right of the one above. */
const KEY_POSITIONS: Record<string, { x: number; y: number }> = Object.fromEntries(
  ["qwertyuiop", "asdfghjkl", "zxcvbnm"].flatMap((row, y) => [...row].map((letter, x) => [letter, { x: x + y * 0.5, y }])),
);

/** At least 4 letters, and every letter touches the one before it on the keyboard. */
function keyboardWalk(word: string): boolean {
  if (word.length < 4) return false;
  for (let index = 1; index < word.length; index += 1) {
    const from = KEY_POSITIONS[word[index - 1]!];
    const to = KEY_POSITIONS[word[index]!];
    if (!from || !to || word[index] === word[index - 1]) return false;
    if (Math.abs(from.y - to.y) > 1 || Math.abs(from.x - to.x) > 1) return false;
  }
  return true;
}

const REVERSE_VOWEL_ORDER = "uoiea";

function hasReverseVowelOrder(word: string): boolean {
  return uToAIndices(word).length === REVERSE_VOWEL_ORDER.length;
}

function uToAIndices(word: string): number[] {
  const marks: number[] = [];
  let cursor = 0;
  for (let index = 0; index < word.length; index += 1) {
    if (word[index] !== REVERSE_VOWEL_ORDER[cursor]) continue;
    marks.push(index);
    cursor += 1;
    if (cursor === REVERSE_VOWEL_ORDER.length) break;
  }
  return marks;
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

/**
 * Longest run of neighbouring prefixes that are ENABLE words.
 * A run may start after the first letter. One-letter words count when they are in the list.
 * Ties keep the earliest run. Returns null when the longest run is shorter than 4.
 */
export function buildingBlockRun(word: string): string[] | null {
  const prefixes: string[] = [];
  for (let length = 1; length <= word.length; length += 1) {
    const prefix = word.slice(0, length);
    if (ENABLE_WORDS.has(prefix)) prefixes.push(prefix);
  }
  let best: string[] | null = null;
  let current: string[] = [];
  for (const prefix of prefixes) {
    const previous = current[current.length - 1];
    if (previous && prefix.length === previous.length + 1) current.push(prefix);
    else current = [prefix];
    if (current.length >= 4 && (best === null || current.length > best.length)) best = current.slice();
  }
  return best;
}

/** Odd positions and even positions, counting from 1, when both are ENABLE words of at least 2 letters. */
export function wovenWords(word: string): { odd: string; even: string } | null {
  if (word.length < 4) return null;
  let odd = "";
  let even = "";
  for (let index = 0; index < word.length; index += 1) {
    if (index % 2 === 0) odd += word[index] ?? "";
    else even += word[index] ?? "";
  }
  if (odd.length < 2 || even.length < 2) return null;
  if (!ENABLE_WORDS.has(odd) || !ENABLE_WORDS.has(even)) return null;
  return { odd, even };
}

export type DoubleOrNothingHit = { highlight: number[]; word: string };

/**
 * A single letter doubled into an adjacent pair, or an exact pair reduced to one letter,
 * when the other spelling is an ENABLE word. A run of three or more is skipped.
 */
export function doubleOrNothingHits(word: string): DoubleOrNothingHit[] {
  const hits: DoubleOrNothingHit[] = [];
  let index = 0;
  while (index < word.length) {
    let end = index + 1;
    while (end < word.length && word[end] === word[index]) end += 1;
    const run = end - index;
    if (run === 1) {
      const letter = word[index] ?? "";
      const longer = word.slice(0, index) + letter + letter + word.slice(end);
      if (ENABLE_WORDS.has(longer)) hits.push({ highlight: [index], word: longer });
    } else if (run === 2) {
      const shorter = word.slice(0, index) + word[index] + word.slice(end);
      if (ENABLE_WORDS.has(shorter)) hits.push({ highlight: [index, index + 1], word: shorter });
    }
    index = end;
  }
  return hits;
}

export type AlphabetStepHit = { index: number; word: string };

/** One letter replaced by its immediate alphabetical neighbour, spelling another ENABLE word. */
export function alphabetStepHits(word: string): AlphabetStepHit[] {
  const letters = [...word];
  const hits: AlphabetStepHit[] = [];
  for (let index = 0; index < letters.length; index += 1) {
    const letter = letters[index];
    if (letter === undefined) continue;
    const code = letter.charCodeAt(0);
    for (const nextCode of [code - 1, code + 1]) {
      if (nextCode < 97 || nextCode > 122) continue;
      const stepped = letters.slice();
      stepped[index] = String.fromCharCode(nextCode);
      const next = stepped.join("");
      if (next === word || !ENABLE_WORDS.has(next)) continue;
      hits.push({ index, word: next });
    }
  }
  return hits;
}

export type SwapShopHit = { index: number; word: string };

/** Adjacent transpositions of two different letters that spell another ENABLE word. */
export function swapShopHits(word: string): SwapShopHit[] {
  const letters = [...word];
  const hits: SwapShopHit[] = [];
  for (let index = 0; index < letters.length - 1; index += 1) {
    const left = letters[index];
    const right = letters[index + 1];
    if (left === undefined || right === undefined || left === right) continue;
    const swapped = letters.slice();
    swapped[index] = right;
    swapped[index + 1] = left;
    const next = swapped.join("");
    if (next === word || !ENABLE_WORDS.has(next)) continue;
    hits.push({ index, word: next });
  }
  return hits;
}

const EDIT_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

/**
 * Every letter is a Roman-numeral symbol: I, V, X, L, C, D, or M.
 * This tests the letters, not whether the word is a valid numeral.
 * The empty string is not a word.
 */
export function isRomanWord(word: string): boolean {
  if (word.length === 0) return false;
  for (const letter of word.toLowerCase()) {
    if (!ROMAN_LETTERS.has(letter)) return false;
  }
  return true;
}

/**
 * Official IUPAC symbols for elements 1–118.
 * Every symbol is 1 or 2 letters. Temporary systematic 3-letter names are omitted.
 */
export const ELEMENT_SYMBOLS = [
  "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
  "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
  "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
  "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
  "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn",
  "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd",
  "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb",
  "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
  "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th",
  "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm",
  "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds",
  "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og",
] as const;

const ELEMENT_SYMBOL_SET = new Set(ELEMENT_SYMBOLS.map((symbol) => symbol.toLowerCase()));

export type PeriodicSpelling = {
  /** Title-cased symbols. Fewest symbols, then the lexicographically earliest sequence. */
  symbols: string[];
};

/**
 * Partition the whole word into official element symbols, or null when any letter is left over.
 * Any complete partition is a hit. The word does not need a unique partition.
 * Among complete partitions, the fewest symbols wins, then the lexicographically earliest
 * sequence of title-cased symbols. Matching is case-insensitive. The empty string is not a word.
 * A hit covers every letter, so the card lights the whole word and the detail shows the breaks.
 */
export function periodicSpelling(word: string): PeriodicSpelling | null {
  const text = word.toLowerCase();
  if (text.length === 0) return null;
  const best: Array<string[] | undefined> = Array.from({ length: text.length + 1 }, () => undefined);
  best[0] = [];
  for (let index = 0; index < text.length; index += 1) {
    const current = best[index];
    if (!current) continue;
    for (const size of [1, 2]) {
      const end = index + size;
      if (end > text.length) continue;
      const raw = text.slice(index, end);
      if (!ELEMENT_SYMBOL_SET.has(raw)) continue;
      const next = current.concat(titleCaseSymbol(raw));
      const existing = best[end];
      if (existing && !isEarlierPartition(next, existing)) continue;
      best[end] = next;
    }
  }
  const symbols = best[text.length];
  if (!symbols || symbols.length === 0) return null;
  return { symbols };
}

/** En dashes, title-cased the way element symbols are written: Ba–Na–Na. */
export function formatPeriodicSpelling(symbols: readonly string[]): string {
  return symbols.join("–");
}

function titleCaseSymbol(raw: string): string {
  if (raw.length === 1) return raw.toUpperCase();
  return `${raw[0]!.toUpperCase()}${raw.slice(1)}`;
}

function isEarlierPartition(candidate: readonly string[], existing: readonly string[]): boolean {
  if (candidate.length !== existing.length) return candidate.length < existing.length;
  for (let index = 0; index < candidate.length; index += 1) {
    const left = candidate[index]!;
    const right = existing[index]!;
    if (left === right) continue;
    return left < right;
  }
  return false;
}

/**
 * No other ENABLE word is one insertion, deletion, or substitution away.
 * Transpositions are Swap shop. The word itself does not count. The empty
 * string is not a word, so a one-letter word is lonely unless an insertion
 * or a substitution hits.
 */
function isLonelyWord(word: string): boolean {
  if (word.length > 1) {
    for (let index = 0; index < word.length; index += 1) {
      const deleted = word.slice(0, index) + word.slice(index + 1);
      if (deleted.length > 0 && ENABLE_WORDS.has(deleted)) return false;
    }
  }
  for (let index = 0; index < word.length; index += 1) {
    const prefix = word.slice(0, index);
    const suffix = word.slice(index + 1);
    for (const letter of EDIT_ALPHABET) {
      if (letter === word[index]) continue;
      if (ENABLE_WORDS.has(prefix + letter + suffix)) return false;
    }
  }
  for (let index = 0; index <= word.length; index += 1) {
    const prefix = word.slice(0, index);
    const suffix = word.slice(index);
    for (const letter of EDIT_ALPHABET) {
      if (ENABLE_WORDS.has(prefix + letter + suffix)) return false;
    }
  }
  return true;
}

export function anagramsOf(word: string): string[] {
  const group = ANAGRAM_GROUPS.get([...word].sort().join("")) ?? [];
  return group.filter((other) => other !== word);
}

export function insideHits(word: string): string[] {
  return insideSlices(word).map((hit) => hit.text);
}

function nullPrototypeGroups(
  groups: Record<string, Record<string, string[]>>,
): Record<string, Record<string, string[]>> {
  const outer = Object.create(null) as Record<string, Record<string, string[]>>;
  for (const setKey of Object.keys(groups)) {
    outer[setKey] = Object.assign(Object.create(null), groups[setKey]) as Record<string, string[]>;
  }
  return outer;
}

function alphabetTwinPartners(word: string): string[] | null {
  const letters = [...word];
  const setKey = [...new Set(letters)].sort().join("");
  const countKey = letters.slice().sort().join("");
  const group = ALPHABET_TWINS[setKey];
  if (!group) return null;
  const partners: string[] = [];
  for (const key of Object.keys(group)) {
    if (key === countKey) continue;
    partners.push(...(group[key] ?? []));
  }
  if (partners.length === 0) return null;
  partners.sort();
  return partners;
}

function formatAlphabetTwins(partners: string[]): string {
  if (partners.length <= 8) return `${partners.join(", ")}.`;
  const more = partners.length - 8;
  return `${partners.slice(0, 8).join(", ")}, and ${more} more.`;
}

function insideOut(word: string): string | null {
  if (word.length < 2) return null;
  const rotated = word.slice(1) + word[0];
  if (rotated === word || !ENABLE_WORDS.has(rotated)) return null;
  return rotated;
}

function frontOrBack(word: string): { withoutFirst: string; withoutLast: string } | null {
  if (word.length < 2) return null;
  const withoutFirst = word.slice(1);
  const withoutLast = word.slice(0, -1);
  if (!ENABLE_WORDS.has(withoutFirst) || !ENABLE_WORDS.has(withoutLast)) return null;
  return { withoutFirst, withoutLast };
}

function letterSandwich(word: string): string | null {
  if (word.length < 5) return null;
  const middle = word.slice(1, -1);
  if (middle.length < 3 || !ENABLE_WORDS.has(middle)) return null;
  return middle;
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

/** Same test as Mirror: at least 3 letters, and the same word backwards. */
function isMirror(text: string): boolean {
  return text.length >= 3 && text === [...text].reverse().join("");
}

/**
 * Longest contiguous palindrome of at least 5 letters that is shorter than the word.
 * Ties keep the leftmost run. A word that is itself a palindrome misses.
 */
export function hiddenMirrorRun(word: string): { start: number; end: number } | null {
  if (isMirror(word)) return null;
  for (let length = word.length - 1; length >= 5; length -= 1) {
    const last = word.length - length;
    for (let start = 0; start <= last; start += 1) {
      if (!isMirror(word.slice(start, start + length))) continue;
      return { start, end: start + length };
    }
  }
  return null;
}

function factorHighlight(id: FactorId, word: string): number[] {
  if (id === "building-blocks") {
    const run = buildingBlockRun(word);
    const longest = run?.[run.length - 1];
    if (!longest) return [];
    return everyIndex(longest.length);
  }
  if (id === "hidden-mirror") {
    const run = hiddenMirrorRun(word);
    if (!run) return [];
    return Array.from({ length: run.end - run.start }, (_, offset) => run.start + offset);
  }
  if (id === "letter-sandwich") {
    return Array.from({ length: Math.max(0, word.length - 2) }, (_, index) => index + 1);
  }
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
  if (id === "u-to-a") return uToAIndices(word);
  if (id === "a-to-z") return [0, word.length - 1];
  if (id === "hidden-number" || id === "hidden-animal") {
    const hits = hiddenWords(word, id === "hidden-number" ? NUMBER_WORDS : ANIMAL_WORDS);
    return [...new Set(hits.flatMap((hit) => everyIndex(hit.text.length).map((index) => index + hit.start)))].sort(
      (left, right) => left - right,
    );
  }
  if (id === "consonant-chain" || id === "vowel-chain") {
    const run = longestRun(word, id === "vowel-chain");
    if (!run) return everyIndex(word.length);
    return Array.from({ length: run.length }, (_, offset) => run.start + offset);
  }
  if (id === "letter-collector") return letterCollector(word)?.indexes ?? [];
  if (id === "alphabet-staircase") {
    return alphabetStaircaseRuns(word).flatMap((run) =>
      Array.from({ length: run.end - run.start }, (_, offset) => run.start + offset),
    );
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
  const count = LENGTH_COUNTS[length] ?? 0;
  const share = (count / LIST_SIZE) * 100;
  const shown = share >= 1 ? share.toFixed(0) : share >= 0.1 ? share.toFixed(1) : share.toFixed(2);
  const words = count === 1 ? "word has" : "words have";
  return `Only ${count.toLocaleString("en-US")} ${words} ${length} letters (${shown}% of the dictionary). Rarer lengths multiply more.`;
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

/**
 * Every distinct letter occurs the same number of times.
 * A count of 1 hits, so a word with no repeated letters hits.
 * A single letter hits. The empty string does not.
 * Matching is case-insensitive. Anything outside a–z misses.
 * One card per word. A hit lights the whole word.
 */
export function isPerfectlyShared(word: string): boolean {
  return perfectlySharedCount(word) !== null;
}

function perfectlySharedCount(word: string): number | null {
  const text = word.toLowerCase();
  if (!/^[a-z]+$/.test(text)) return null;
  const counts = new Map<string, number>();
  for (const letter of text) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  let shared: number | null = null;
  for (const count of counts.values()) {
    if (shared === null) shared = count;
    else if (count !== shared) return null;
  }
  return shared;
}

function perfectlySharedDetail(word: string, count: number): string {
  const letters = [...new Set(word)];
  const times = count === 1 ? "once" : count === 2 ? "twice" : `${count} times`;
  if (letters.length === 1) return `${letters[0]} occurs ${times}.`;
  return `${letters.join(", ")} each occur ${times}.`;
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
  const runWord = kind === "consonants" ? "consonants" : "vowels";
  return `Letters of the same kind sit together. ${word.slice(run.start, run.end)} is ${run.length} ${runWord} in a row.`;
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

export type LetterCollectorHit = {
  /** First letter of the stretch, lowercase. */
  start: string;
  /** Last letter of the stretch, lowercase. */
  end: string;
  length: number;
  /** Every index whose letter belongs to that stretch, including repeats. */
  indexes: number[];
};

/**
 * Longest run of alphabet letters that all appear in the word.
 * Order does not matter. A repeated letter does not extend the run.
 * A missing letter ends it. Ties keep the run that starts earlier.
 * Returns null when that run is shorter than 6.
 */
export function letterCollector(word: string): LetterCollectorHit | null {
  const normalized = word.toLowerCase();
  const present = Array.from({ length: 26 }, () => false);
  for (const letter of normalized) {
    const code = letter.charCodeAt(0) - 97;
    if (code >= 0 && code < 26) present[code] = true;
  }
  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  for (let index = 0; index <= 26; index += 1) {
    if (index < 26 && present[index]) {
      if (runStart < 0) runStart = index;
      continue;
    }
    if (runStart >= 0) {
      const length = index - runStart;
      if (length > bestLength) {
        bestLength = length;
        bestStart = runStart;
      }
    }
    runStart = -1;
  }
  if (bestLength < 6 || bestStart < 0) return null;
  const letters = new Set<string>();
  for (let offset = 0; offset < bestLength; offset += 1) {
    letters.add(String.fromCharCode(97 + bestStart + offset));
  }
  return {
    start: String.fromCharCode(97 + bestStart),
    end: String.fromCharCode(97 + bestStart + bestLength - 1),
    length: bestLength,
    indexes: [...normalized].flatMap((letter, index) => (letters.has(letter) ? [index] : [])),
  };
}

function letterCollectorDetail(hit: LetterCollectorHit): string {
  return `Neighbouring letters of the alphabet show up in any order, at least six of them. ${hit.start.toUpperCase()}–${hit.end.toUpperCase()} is ${hit.length} alphabet letters in a row.`;
}

export type AlphabetStaircaseRun = {
  /** Index of the first letter in the run. */
  start: number;
  /** Index just after the last letter in the run. */
  end: number;
};

/**
 * Maximal contiguous runs where each letter is the immediate next letter of the alphabet.
 * Ascending only, and at least 3 letters. A repeated letter breaks the run.
 * The alphabet does not wrap, so YZA is not a run. A longer run still counts.
 */
export function alphabetStaircaseRuns(word: string): AlphabetStaircaseRun[] {
  const normalized = word.toLowerCase();
  const runs: AlphabetStaircaseRun[] = [];
  let start = 0;
  for (let index = 1; index <= normalized.length; index += 1) {
    const previous = normalized.charCodeAt(index - 1);
    const current = index < normalized.length ? normalized.charCodeAt(index) : 0;
    if (current === previous + 1 && previous >= 97 && previous <= 121) continue;
    if (index - start >= 3) runs.push({ start, end: index });
    start = index;
  }
  return runs;
}

function alphabetStaircaseDetail(word: string, runs: AlphabetStaircaseRun[]): string {
  const labels = runs.map((run) => word.slice(run.start, run.end).toUpperCase());
  const rule = "Three or more letters in a row each step up to the next letter of the alphabet.";
  if (labels.length === 1) {
    const label = labels[0] ?? "";
    return `${rule} ${label} is ${label.length} letters stepping up the alphabet.`;
  }
  const last = labels[labels.length - 1] ?? "";
  const head = labels.slice(0, -1);
  const list = head.length === 1 ? `${head[0]} and ${last}` : `${head.join(", ")}, and ${last}`;
  return `${rule} ${list} step up the alphabet.`;
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
