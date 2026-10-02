import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ELEMENT_SYMBOLS,
  FACTOR_MATCHES,
  FACTOR_MULTIPLIERS,
  alphabetStaircaseRuns,
  formatPeriodicSpelling,
  isPerfectlyShared,
  isRomanWord,
  lengthMultiplier,
  PER_HIT_MULTIPLIERS,
  letterCollector,
  periodicSpelling,
  rarityMultiplier,
  scoreWord,
} from "./scoring";

test("common lengths sit at ×1", () => {
  for (const length of [6, 7, 8, 9, 10, 11, 12]) assert.equal(lengthMultiplier(length), 1);
});

test("length is priced by rarity, the same in both directions", () => {
  assert.equal(lengthMultiplier(5), 3);
  assert.equal(lengthMultiplier(4), 5);
  assert.equal(lengthMultiplier(3), 8);
  assert.equal(lengthMultiplier(2), 19);
  assert.equal(lengthMultiplier(13), 3);
  assert.equal(lengthMultiplier(15), 5);
  assert.equal(lengthMultiplier(20), 19);
  assert.equal(lengthMultiplier(28), 47);
  assert.equal(lengthMultiplier(2), lengthMultiplier(20));
});

test("rarer factors get larger multipliers", () => {
  assert.equal(rarityMultiplier(41209), 3);
  assert.equal(FACTOR_MULTIPLIERS.twins, 3);
  assert.equal(FACTOR_MULTIPLIERS.contraband, 5);
  assert.equal(FACTOR_MULTIPLIERS["vowel-sweep"], 15);
  assert.equal(FACTOR_MULTIPLIERS["alphabet-soup"], 23);
  assert.equal(FACTOR_MULTIPLIERS["bone-dry"], 27);
  assert.equal(FACTOR_MULTIPLIERS.mirror, 32);
  assert.equal(FACTOR_MULTIPLIERS["hidden-mirror"], 11);
  assert.equal(FACTOR_MULTIPLIERS["swap-shop"], 11);
  assert.equal(FACTOR_MULTIPLIERS["swap-shop"], rarityMultiplier(2815));
  assert.equal(FACTOR_MULTIPLIERS["alphabet-step"], 5);
  assert.equal(FACTOR_MULTIPLIERS["alphabet-step"], rarityMultiplier(16735));
  assert.equal(FACTOR_MATCHES["lonely-word"], 35182);
  assert.equal(FACTOR_MULTIPLIERS["lonely-word"], 3);
  assert.equal(FACTOR_MULTIPLIERS["lonely-word"], rarityMultiplier(FACTOR_MATCHES["lonely-word"]));
  assert.equal(FACTOR_MATCHES["letter-collector"], 145);
  assert.equal(FACTOR_MULTIPLIERS["letter-collector"], 27);
  assert.equal(
    FACTOR_MULTIPLIERS["letter-collector"],
    rarityMultiplier(FACTOR_MATCHES["letter-collector"]),
  );
  assert.equal(FACTOR_MATCHES["alphabet-staircase"], 1502);
  assert.equal(FACTOR_MULTIPLIERS["alphabet-staircase"], 15);
  assert.equal(
    FACTOR_MULTIPLIERS["alphabet-staircase"],
    rarityMultiplier(FACTOR_MATCHES["alphabet-staircase"]),
  );
  assert.equal(FACTOR_MATCHES["roman-word"], 28);
  assert.equal(FACTOR_MULTIPLIERS["roman-word"], 36);
  assert.equal(FACTOR_MULTIPLIERS["roman-word"], rarityMultiplier(FACTOR_MATCHES["roman-word"]));
  assert.equal(FACTOR_MATCHES["periodic-spelling"], 28897);
  assert.equal(FACTOR_MULTIPLIERS["periodic-spelling"], 3);
  assert.equal(
    FACTOR_MULTIPLIERS["periodic-spelling"],
    rarityMultiplier(FACTOR_MATCHES["periodic-spelling"]),
  );
  assert.equal(FACTOR_MATCHES["perfectly-shared"], 34878);
  assert.equal(FACTOR_MULTIPLIERS["perfectly-shared"], 3);
  assert.equal(
    FACTOR_MULTIPLIERS["perfectly-shared"],
    rarityMultiplier(FACTOR_MATCHES["perfectly-shared"]),
  );
  assert.equal(FACTOR_MULTIPLIERS["double-or-nothing"], 11);
  assert.equal(FACTOR_MULTIPLIERS["double-or-nothing"], rarityMultiplier(5429));
  assert.equal(FACTOR_MULTIPLIERS["woven-together"], 15);
  assert.equal(FACTOR_MULTIPLIERS["woven-together"], rarityMultiplier(1490));
  assert.equal(FACTOR_MULTIPLIERS["building-blocks"], 11);
  assert.equal(FACTOR_MULTIPLIERS["building-blocks"], rarityMultiplier(4186));
  assert.equal(FACTOR_MULTIPLIERS["hidden-mirror"], rarityMultiplier(3148));
  assert.equal(FACTOR_MULTIPLIERS["a-cappella"], 52);
  assert.equal(FACTOR_MULTIPLIERS["vowel-rich"], 8);
  assert.equal(FACTOR_MULTIPLIERS["flat-type"], 8);
  assert.equal(FACTOR_MULTIPLIERS["next-door"], 5);
  assert.equal(FACTOR_MULTIPLIERS.ing, 5);
  assert.equal(FACTOR_MULTIPLIERS.ist, 15);
  assert.equal(FACTOR_MULTIPLIERS.ish, 19);
  assert.equal(FACTOR_MULTIPLIERS["i-before-e"], 15);
  assert.equal(FACTOR_MULTIPLIERS["quiet-letters"], 19);
  assert.equal(FACTOR_MULTIPLIERS["a-to-u"], 36);
  assert.equal(FACTOR_MULTIPLIERS["lone-q"], 36);
  assert.ok(FACTOR_MULTIPLIERS.mirror > FACTOR_MULTIPLIERS["vowel-sweep"]);
  assert.ok(FACTOR_MULTIPLIERS["a-to-u"] > FACTOR_MULTIPLIERS.mirror);
  assert.ok(FACTOR_MULTIPLIERS["vowel-sweep"] > FACTOR_MULTIPLIERS.twins);
});

test("quiz is scrabble tiles times length times contraband", () => {
  const scored = scoreWord("quiz");
  assert.equal(scored.tileSum, 22);
  assert.equal(scored.lengthMultiplier, 5);
  assert.equal(scored.rows.find((row) => row.id === "contraband")?.points, 5);
  assert.equal(scored.rows.find((row) => row.id === "no-repeats")?.points, 3);
  assert.equal(scored.rows.find((row) => row.id === "perfect-balance")?.points, 5);
  assert.equal(scored.rows.find((row) => row.id === "vowel-chain")?.points, 3);
  // No repeats already pays for this.
  assert.equal(scored.rows.find((row) => row.id === "perfectly-shared")?.points, null);
  assert.equal(scored.rows.find((row) => row.id === "perfectly-shared")?.matched, true);
  assert.equal(scored.total, 22 * 5 * 5 * 3 * 5 * 3);
  assert.equal(product(scored), scored.total);
});

test("a whole palindrome misses hidden mirror, and an inner run of 5 hits", () => {
  const rotator = scoreWord("rotator");
  assert.equal(rotator.rows.find((row) => row.id === "mirror")?.scored, true);
  assert.equal(rotator.rows.find((row) => row.id === "hidden-mirror")?.scored, false);
  assert.equal(rotator.rows.find((row) => row.id === "hidden-mirror")?.points, null);

  const prefer = scoreWord("prefer");
  const hidden = prefer.rows.filter((row) => row.id === "hidden-mirror");
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0]?.scored, true);
  assert.equal(hidden[0]?.points, 11);
  assert.deepEqual(hidden[0]?.highlight, [1, 2, 3, 4, 5]);
  assert.match(hidden[0]?.reason ?? "", /refer reads the same backwards/);
  assert.equal(prefer.rows.find((row) => row.id === "mirror")?.scored, false);

  assert.equal(scoreWord("xabbay").rows.find((row) => row.id === "hidden-mirror")?.scored, false);

  const tied = scoreWord("abcbaqdefed");
  assert.deepEqual(tied.rows.find((row) => row.id === "hidden-mirror")?.highlight, [0, 1, 2, 3, 4]);

  const longer = scoreWord("abcbaqdeffed");
  assert.deepEqual(longer.rows.find((row) => row.id === "hidden-mirror")?.highlight, [6, 7, 8, 9, 10, 11]);

  const wrapped = scoreWord("abcbaqabcba");
  assert.equal(wrapped.rows.find((row) => row.id === "mirror")?.scored, true);
  assert.equal(wrapped.rows.find((row) => row.id === "hidden-mirror")?.scored, false);
});

test("antics builds from an through antics, and quiz has no such run", () => {
  const rows = scoreWord("antics").rows.filter((row) => row.id === "building-blocks");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.scored, true);
  assert.equal(rows[0]?.points, 11);
  assert.equal(rows[0]?.match, "an, ant, anti, antic, antics");
  assert.deepEqual(rows[0]?.highlight, [0, 1, 2, 3, 4, 5]);
  assert.equal(
    rows[0]?.reason,
    "Prefixes that grow by one letter are all dictionary words: an, ant, anti, antic, antics.",
  );

  const quiz = scoreWord("quiz");
  assert.equal(quiz.rows.find((row) => row.id === "building-blocks")?.scored, false);
  assert.equal(quiz.rows.find((row) => row.id === "building-blocks")?.points, null);
});

test("schooled weaves shoe and cold, and a word that does not split misses", () => {
  const rows = scoreWord("schooled").rows.filter((row) => row.id === "woven-together");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.scored, true);
  assert.equal(rows[0]?.points, 15);
  assert.equal(rows[0]?.match, "shoe and cold");
  assert.deepEqual(rows[0]?.highlight, [0, 1, 2, 3, 4, 5, 6, 7]);
  const reason = rows[0]?.reason ?? "";
  assert.match(reason, /shoe/);
  assert.match(reason, /cold/);
  assert.ok(reason.indexOf("shoe") < reason.indexOf("cold"));

  const quiz = scoreWord("quiz");
  assert.equal(quiz.rows.find((row) => row.id === "woven-together")?.scored, false);
  assert.equal(quiz.rows.find((row) => row.id === "woven-together")?.points, null);
});

test("hoping and hopping each name the other, and a word with no pair misses", () => {
  // One card for every hit, priced by how rare that many hits is.
  const hoping = scoreWord("hoping").rows.filter((row) => row.id === "double-or-nothing" && row.scored);
  assert.equal(hoping.length, 1);
  assert.equal(hoping[0]?.points, 27);
  assert.equal(hoping[0]?.match, "hooping, hopping");
  assert.deepEqual(hoping[0]?.highlight, [1, 2]);
  assert.match(hoping[0]?.reason ?? "", /hopping/);

  const hopping = scoreWord("hopping").rows.filter((row) => row.id === "double-or-nothing" && row.scored);
  assert.equal(hopping.length, 1);
  assert.equal(hopping[0]?.points, 11);
  assert.equal(hopping[0]?.match, "hoping");
  assert.deepEqual(hopping[0]?.highlight, [2, 3]);
  assert.match(hopping[0]?.reason ?? "", /hoping/);

  const quiz = scoreWord("quiz");
  assert.equal(quiz.rows.find((row) => row.id === "double-or-nothing")?.scored, false);
  assert.equal(quiz.rows.find((row) => row.id === "double-or-nothing")?.points, null);
});

test("cat steps C to bat, and A does not wrap around to Z", () => {
  const cat = scoreWord("cat");
  const steps = cat.rows.filter((row) => row.id === "alphabet-step");
  assert.equal(steps.length, 1);
  assert.equal(steps[0]?.scored, true);
  assert.equal(steps[0]?.points, 5);
  assert.equal(steps[0]?.match, "bat");
  assert.deepEqual(steps[0]?.highlight, [0]);
  assert.match(steps[0]?.reason ?? "", /bat/);

  const quiz = scoreWord("quiz");
  assert.equal(quiz.rows.find((row) => row.id === "alphabet-step")?.scored, false);
  assert.equal(quiz.rows.find((row) => row.id === "alphabet-step")?.points, null);

  const aero = scoreWord("aero");
  assert.equal(aero.rows.find((row) => row.id === "alphabet-step")?.scored, false);
  assert.equal(
    aero.rows.some((row) => row.match === "zero"),
    false,
  );
});

test("feedback collects A through F, and a 5-letter stretch misses", () => {
  const feedback = scoreWord("feedback");
  const row = feedback.rows.find((entry) => entry.id === "letter-collector");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 27);
  assert.equal(row?.points, FACTOR_MULTIPLIERS["letter-collector"]);
  assert.equal(row?.name, "Letter collector ×27");
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(
    row?.reason,
    "Neighbouring letters of the alphabet show up in any order, at least six of them. A–F is 6 alphabet letters in a row.",
  );
  assert.equal(feedback.total, product(feedback));
  assert.deepEqual(letterCollector("FEEDBACK")?.indexes, [0, 1, 2, 3, 4, 5, 6]);

  const boldface = scoreWord("boldface");
  assert.equal(boldface.rows.find((entry) => entry.id === "letter-collector")?.scored, true);
  assert.deepEqual(boldface.rows.find((entry) => entry.id === "letter-collector")?.highlight, [
    0, 3, 4, 5, 6, 7,
  ]);

  const backed = scoreWord("backed");
  assert.equal(backed.rows.find((entry) => entry.id === "letter-collector")?.scored, false);
  assert.equal(backed.rows.find((entry) => entry.id === "letter-collector")?.points, null);
  assert.equal(letterCollector("backed"), null);

  assert.equal(scoreWord("abcefg").rows.find((entry) => entry.id === "letter-collector")?.scored, false);
  assert.equal(letterCollector("abcefg"), null);

  const earlier = scoreWord("abcdefxyzmnopqr");
  assert.deepEqual(earlier.rows.find((entry) => entry.id === "letter-collector")?.highlight, [
    0, 1, 2, 3, 4, 5,
  ]);
  assert.equal(
    earlier.rows.find((entry) => entry.id === "letter-collector")?.reason,
    "Neighbouring letters of the alphabet show up in any order, at least six of them. A–F is 6 alphabet letters in a row.",
  );

  const longer = scoreWord("abcdefmnopqrst");
  assert.equal(
    longer.rows.find((entry) => entry.id === "letter-collector")?.reason,
    "Neighbouring letters of the alphabet show up in any order, at least six of them. M–T is 8 alphabet letters in a row.",
  );
  assert.deepEqual(
    longer.rows.find((entry) => entry.id === "letter-collector")?.highlight,
    [6, 7, 8, 9, 10, 11, 12, 13],
  );
});

test("hijack and first step up the alphabet, and a short or descending run misses", () => {
  const hijack = scoreWord("hijack");
  const hij = hijack.rows.find((entry) => entry.id === "alphabet-staircase");
  assert.equal(hijack.rows.filter((entry) => entry.id === "alphabet-staircase").length, 1);
  assert.equal(hij?.scored, true);
  assert.equal(hij?.points, 15);
  assert.equal(hij?.points, FACTOR_MULTIPLIERS["alphabet-staircase"]);
  assert.equal(hij?.name, "Alphabet staircase ×15");
  assert.deepEqual(hij?.highlight, [0, 1, 2]);
  assert.equal(
    hij?.reason,
    "Three or more letters in a row each step up to the next letter of the alphabet. HIJ is 3 letters stepping up the alphabet.",
  );
  assert.deepEqual(alphabetStaircaseRuns("HIJACK"), [{ start: 0, end: 3 }]);
  assert.equal(hijack.total, product(hijack));

  const first = scoreWord("first");
  const rst = first.rows.find((entry) => entry.id === "alphabet-staircase");
  assert.equal(rst?.scored, true);
  assert.equal(rst?.points, FACTOR_MULTIPLIERS["alphabet-staircase"]);
  assert.deepEqual(rst?.highlight, [2, 3, 4]);
  assert.equal(
    rst?.reason,
    "Three or more letters in a row each step up to the next letter of the alphabet. RST is 3 letters stepping up the alphabet.",
  );
  assert.deepEqual(alphabetStaircaseRuns("first"), [{ start: 2, end: 5 }]);

  const fed = scoreWord("fed");
  assert.equal(fed.rows.find((entry) => entry.id === "alphabet-staircase")?.scored, false);
  assert.equal(fed.rows.find((entry) => entry.id === "alphabet-staircase")?.points, null);
  assert.deepEqual(alphabetStaircaseRuns("fed"), []);
  assert.deepEqual(alphabetStaircaseRuns("onm"), []);

  const step = scoreWord("ab");
  assert.equal(step.rows.find((entry) => entry.id === "alphabet-staircase")?.scored, false);
  assert.equal(step.rows.find((entry) => entry.id === "alphabet-staircase")?.points, null);
  assert.deepEqual(alphabetStaircaseRuns("ab"), []);

  assert.deepEqual(alphabetStaircaseRuns("book"), []);
  assert.deepEqual(alphabetStaircaseRuns("yza"), []);

  const longer = scoreWord("overstuff");
  assert.equal(
    longer.rows.find((entry) => entry.id === "alphabet-staircase")?.reason,
    "Three or more letters in a row each step up to the next letter of the alphabet. RSTU is 4 letters stepping up the alphabet.",
  );
  assert.deepEqual(longer.rows.find((entry) => entry.id === "alphabet-staircase")?.highlight, [
    3, 4, 5, 6,
  ]);

  const both = scoreWord("hijackxyz");
  assert.equal(both.rows.filter((entry) => entry.id === "alphabet-staircase").length, 1);
  assert.deepEqual(both.rows.find((entry) => entry.id === "alphabet-staircase")?.highlight, [
    0, 1, 2, 6, 7, 8,
  ]);
  assert.equal(
    both.rows.find((entry) => entry.id === "alphabet-staircase")?.reason,
    "Three or more letters in a row each step up to the next letter of the alphabet. HIJ and XYZ step up the alphabet.",
  );
});

test("civic, mix, and dim are Roman words, and a letter outside that set misses", () => {
  for (const word of ["civic", "mix", "dim", "did", "id"]) {
    const scored = scoreWord(word);
    const rows = scored.rows.filter((entry) => entry.id === "roman-word");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.scored, true);
    assert.equal(rows[0]?.points, 36);
    assert.equal(rows[0]?.points, FACTOR_MULTIPLIERS["roman-word"]);
    assert.equal(rows[0]?.name, "Roman word ×36");
    assert.deepEqual(
      rows[0]?.highlight,
      Array.from({ length: word.length }, (_, index) => index),
    );
    assert.equal(rows[0]?.reason, "Every letter is a Roman-numeral symbol: I, V, X, L, C, D, or M.");
    assert.equal(scored.total, product(scored));
  }

  const cat = scoreWord("cat");
  assert.equal(cat.rows.find((entry) => entry.id === "roman-word")?.scored, false);
  assert.equal(cat.rows.find((entry) => entry.id === "roman-word")?.points, null);

  const mixes = scoreWord("mixes");
  assert.equal(mixes.rows.find((entry) => entry.id === "roman-word")?.scored, false);
  assert.equal(mixes.rows.find((entry) => entry.id === "roman-word")?.points, null);

  assert.equal(isRomanWord("civic"), true);
  assert.equal(isRomanWord("CIVIC"), true);
  assert.equal(isRomanWord("mix"), true);
  assert.equal(isRomanWord("dim"), true);
  assert.equal(isRomanWord("did"), true);
  assert.equal(isRomanWord("viii"), true);
  assert.equal(isRomanWord("i"), true);
  assert.equal(isRomanWord(""), false);
  assert.equal(isRomanWord("cat"), false);
  assert.equal(isRomanWord("mixes"), false);

  assert.equal(scoreWord("i").rows.find((entry) => entry.id === "roman-word")?.scored, true);
  assert.deepEqual(scoreWord("i").rows.find((entry) => entry.id === "roman-word")?.highlight, [0]);
  assert.equal(scoreWord("a").rows.find((entry) => entry.id === "roman-word")?.scored, false);
});

test("banana and silicon split into element symbols, and jazz does not", () => {
  assert.equal(ELEMENT_SYMBOLS.length, 118);
  assert.equal(new Set(ELEMENT_SYMBOLS.map((symbol) => symbol.toLowerCase())).size, 118);
  assert.ok(ELEMENT_SYMBOLS.every((symbol) => /^[A-Z][a-z]?$/.test(symbol)));

  for (const [word, partition] of [
    ["banana", "Ba–Na–Na"],
    ["silicon", "Si–Li–Co–N"],
    ["cat", "C–At"],
  ] as const) {
    const symbols = partition.split("–");
    assert.deepEqual(periodicSpelling(word)?.symbols, symbols);
    assert.equal(formatPeriodicSpelling(symbols), partition);
    const scored = scoreWord(word);
    const rows = scored.rows.filter((entry) => entry.id === "periodic-spelling");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.scored, true);
    assert.equal(rows[0]?.points, 3);
    assert.equal(rows[0]?.points, FACTOR_MULTIPLIERS["periodic-spelling"]);
    assert.equal(rows[0]?.name, "Periodic spelling ×3");
    assert.equal(
      rows[0]?.reason,
      `The whole word splits into chemical element symbols: ${partition}.`,
    );
    assert.deepEqual(
      rows[0]?.highlight,
      Array.from({ length: word.length }, (_, index) => index),
    );
    assert.equal(scored.total, product(scored));
  }

  assert.deepEqual(periodicSpelling("BANANA")?.symbols, ["Ba", "Na", "Na"]);
  assert.deepEqual(periodicSpelling("SiLiCoN")?.symbols, ["Si", "Li", "Co", "N"]);
  assert.equal(periodicSpelling("jazz"), null);
  assert.equal(periodicSpelling(""), null);
  assert.deepEqual(periodicSpelling("coin")?.symbols, ["Co", "In"]);
  assert.deepEqual(periodicSpelling("sinc")?.symbols, ["S", "In", "C"]);
  assert.deepEqual(periodicSpelling("uun")?.symbols, ["U", "U", "N"]);

  const jazz = scoreWord("jazz");
  assert.equal(jazz.rows.filter((entry) => entry.id === "periodic-spelling").length, 1);
  assert.equal(jazz.rows.find((entry) => entry.id === "periodic-spelling")?.scored, false);
  assert.equal(jazz.rows.find((entry) => entry.id === "periodic-spelling")?.points, null);
  assert.equal(jazz.rows.find((entry) => entry.id === "periodic-spelling")?.highlight, undefined);
});

test("a lonely word has no insert, delete, or substitute neighbour", () => {
  const lonely = scoreWord("syzygy");
  const row = lonely.rows.find((entry) => entry.id === "lonely-word");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 3);
  assert.equal(row?.name, "Lonely word ×3");
  assert.equal(row?.points, FACTOR_MULTIPLIERS["lonely-word"]);
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4, 5]);
  assert.match(row?.reason ?? "", /insertion, deletion, or substitution/);
  assert.equal(lonely.total, product(lonely));

  const abaft = scoreWord("abaft");
  assert.equal(abaft.rows.find((entry) => entry.id === "lonely-word")?.scored, true);
  assert.deepEqual(abaft.rows.find((entry) => entry.id === "lonely-word")?.highlight, [0, 1, 2, 3, 4]);

  const swapped = scoreWord("compliant");
  const swap = swapped.rows.find((entry) => entry.id === "swap-shop" && entry.scored);
  assert.equal(swap?.match, "complaint");
  assert.equal(swapped.rows.find((entry) => entry.id === "lonely-word")?.scored, true);

  const cat = scoreWord("cat");
  assert.equal(cat.rows.find((entry) => entry.id === "alphabet-step")?.match, "bat");
  assert.equal(cat.rows.find((entry) => entry.id === "lonely-word")?.scored, false);
  assert.equal(cat.rows.find((entry) => entry.id === "lonely-word")?.points, null);

  assert.equal(scoreWord("c").rows.find((entry) => entry.id === "lonely-word")?.scored, true);
  assert.deepEqual(scoreWord("c").rows.find((entry) => entry.id === "lonely-word")?.highlight, [0]);
  assert.equal(scoreWord("a").rows.find((entry) => entry.id === "lonely-word")?.scored, false);
});

test("salt swaps into slat, and identical neighbours do not", () => {
  const salt = scoreWord("salt");
  const swaps = salt.rows.filter((row) => row.id === "swap-shop");
  assert.equal(swaps.length, 1);
  assert.equal(swaps[0]?.scored, true);
  assert.equal(swaps[0]?.points, FACTOR_MULTIPLIERS["swap-shop"]);
  assert.equal(swaps[0]?.match, "slat");
  assert.deepEqual(swaps[0]?.highlight, [1, 2]);
  assert.match(swaps[0]?.reason ?? "", /slat/);

  const quiz = scoreWord("quiz");
  assert.equal(quiz.rows.find((row) => row.id === "swap-shop")?.scored, false);
  assert.equal(quiz.rows.find((row) => row.id === "swap-shop")?.points, null);

  const doubled = scoreWord("aa");
  assert.equal(doubled.rows.find((row) => row.id === "swap-shop")?.scored, false);
  assert.equal(scoreWord("book").rows.find((row) => row.id === "swap-shop")?.scored, false);

  const acred = scoreWord("acred");
  const pairs = acred.rows.filter((row) => row.id === "swap-shop" && row.scored);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]?.match, "cared, arced");
  assert.deepEqual(pairs[0]?.highlight, [0, 1, 2]);
  // Two swaps is far rarer than one.
  assert.equal(pairs[0]?.points, 32);
});

test("kayak multiplies mirror", () => {
  const scored = scoreWord("kayak");
  assert.equal(scored.tileSum, 16);
  assert.equal(scored.lengthMultiplier, 3);
  assert.equal(scored.rows.find((row) => row.id === "mirror")?.points, 32);
  assert.equal(scored.rows.filter((row) => row.id === "inside" && row.scored).length, 2);
  assert.equal(scored.rows.find((row) => row.id === "alternator")?.points, 8);
  // Alphabet twins is ordinary, so it does not score.
  assert.equal(scored.rows.find((row) => row.id === "alphabet-twins")?.points, null);
  // Kayak also alternates hands and hides a yak.
  assert.equal(scored.rows.find((row) => row.id === "hand-to-hand")?.points, 15);
  assert.equal(scored.rows.find((row) => row.id === "hidden-animal")?.points, 5);
  assert.equal(scored.total, 16 * 3 * 32 * 2 * 2 * 8 * 15 * 5);
});

test("rhythm is bone dry and y is not a vowel", () => {
  const scored = scoreWord("rhythm");
  assert.equal(scored.rows.find((row) => row.id === "bone-dry")?.scored, true);
  assert.equal(scored.rows.find((row) => row.id === "a-cappella")?.scored, false);
  assert.equal(scored.tileSum, 17);
  assert.equal(scored.lengthMultiplier, 1);
  assert.equal(scored.rows.find((row) => row.id === "quiet-letters")?.points, 19);
  assert.equal(scored.total, product(scored));
});

test("stop pays Anagram once per other word with the same letters", () => {
  const scored = scoreWord("stop");
  const hits = scored.rows.filter((row) => row.id === "anagram" && row.scored);
  assert.deepEqual(
    hits.map((row) => row.match),
    ["opts", "post", "pots", "spot", "tops"],
  );
  assert.ok(hits.every((row) => row.points === PER_HIT_MULTIPLIERS.anagram));
  assert.equal(PER_HIT_MULTIPLIERS.anagram, 2);
  assert.ok(hits.every((row) => row.highlight?.length === scored.word.length));
  assert.equal(scoreWord("echo").rows.find((row) => row.id === "anagram")?.points, null);
});

test("headlamp pays Inside once per nested dictionary word", () => {
  const scored = scoreWord("headlamp");
  const hits = scored.rows.filter((row) => row.id === "inside" && row.scored);
  assert.deepEqual(
    hits.map((row) => row.match),
    ["head", "lamp", "lam", "amp"],
  );
  assert.ok(hits.every((row) => row.points === PER_HIT_MULTIPLIERS.inside));
  assert.deepEqual(
    hits.map((row) => row.highlight),
    [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [4, 5, 6],
      [5, 6, 7],
    ],
  );
  assert.equal(scoreWord("cat").rows.find((row) => row.id === "inside")?.scored, false);
});

test("bookends matches the first two letters to the last two", () => {
  const church = scoreWord("church");
  const row = church.rows.find((entry) => entry.id === "bookends");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 23);
  assert.equal(row?.name, "Bookends ×23");
  assert.deepEqual(row?.highlight, [0, 1, 4, 5]);
  assert.match(row?.reason ?? "", /ch/);

  const sense = scoreWord("sense");
  assert.equal(sense.rows.find((entry) => entry.id === "bookends")?.scored, true);
  assert.deepEqual(sense.rows.find((entry) => entry.id === "bookends")?.highlight, [0, 1, 3, 4]);

  const book = scoreWord("book");
  assert.equal(book.rows.find((entry) => entry.id === "bookends")?.scored, false);

  const short = scoreWord("cat");
  assert.equal(short.rows.find((entry) => entry.id === "bookends")?.scored, false);
  assert.match(short.rows.find((entry) => entry.id === "bookends")?.detail ?? "", /4 letters/);
});

test("alphabet twins share a letter set with different counts", () => {
  // 74% of words have an alphabet twin, so it is detected but does not score.
  const banana = scoreWord("banana");
  const row = banana.rows.find((entry) => entry.id === "alphabet-twins");
  assert.equal(row?.scored, false);
  assert.equal(row?.matched, true);
  assert.equal(row?.points, null);
  assert.equal(FACTOR_MULTIPLIERS["alphabet-twins"], 1);
  assert.match(
    row?.detail ?? "",
    /Another word uses these same letters, but not the same number of each. ban, nab./,
  );

  const tone = scoreWord("tone");
  const toneRow = tone.rows.find((entry) => entry.id === "alphabet-twins");
  const tonePartners = (toneRow?.detail ?? "")
    .replace(/ Most words have this, so it does not score\.$/, "")
    .replace(/^.*\. /, "")
    .replace(/\.$/, "")
    .split(", ");
  assert.equal(toneRow?.matched, true);
  assert.ok(tonePartners.includes("nonet"));
  assert.equal(tonePartners.includes("note"), false);
  assert.equal(tonePartners.includes("ten"), false);

  const start = scoreWord("start");
  const startRow = start.rows.find((entry) => entry.id === "alphabet-twins");
  assert.match(
    startRow?.detail ?? "",
    /^Another word uses these same letters, but not the same number of each\. arts, attars, ratatats, rats, satara, sataras, star, stars, and 10 more\. Most words have this, so it does not score\.$/,
  );

  assert.equal(scoreWord("quiz").rows.find((entry) => entry.id === "alphabet-twins")?.scored, false);
});

test("inside out moves the first letter to the end", () => {
  const stable = scoreWord("stable");
  const row = stable.rows.find((entry) => entry.id === "inside-out");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 19);
  assert.equal(row?.name, "Inside out ×19");
  assert.equal(row?.reason, "Move the first letter to the end and you get another word: tables.");
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4, 5]);

  assert.equal(scoreWord("book").rows.find((entry) => entry.id === "inside-out")?.scored, false);
  assert.equal(scoreWord("aa").rows.find((entry) => entry.id === "inside-out")?.scored, false);
});

test("shrinking word follows a deletion chain of at least 5", () => {
  const scored = scoreWord("startling");
  const row = scored.rows.find((entry) => entry.id === "shrinking-word");
  const chain = "startling → starling → staring → string → sting → ting → tin → in";
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 8);
  assert.equal(row?.name, "Shrinking word ×8");
  assert.equal(row?.reason, `Each step deletes one letter and is still a dictionary word. ${chain}`);
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const steps = chain.split(" → ");
  assert.ok(steps.length >= 5);
  for (let index = 1; index < steps.length; index += 1) {
    assert.equal(deletesOneLetter(steps[index - 1]!, steps[index]!), true);
  }
  assert.equal(deletesOneLetter("staring", "string"), true);

  assert.equal(scoreWord("book").rows.find((entry) => entry.id === "shrinking-word")?.scored, false);
  assert.equal(scoreWord("start").rows.find((entry) => entry.id === "shrinking-word")?.scored, false);
});

function deletesOneLetter(longer: string, shorter: string): boolean {
  if (shorter.length !== longer.length - 1) return false;
  let skipped = false;
  let cursor = 0;
  for (const letter of longer) {
    if (cursor < shorter.length && letter === shorter[cursor]) cursor += 1;
    else if (!skipped) skipped = true;
    else return false;
  }
  return skipped && cursor === shorter.length;
}

test("front or back needs both trimmed words", () => {
  const start = scoreWord("start");
  const row = start.rows.find((entry) => entry.id === "front-or-back");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 11);
  assert.equal(row?.name, "Front or back ×11");
  assert.equal(
    row?.reason,
    "Drop the first letter and a word remains, and drop the last letter and a word remains: tart and star.",
  );
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4]);

  const book = scoreWord("book");
  assert.equal(book.rows.find((entry) => entry.id === "front-or-back")?.scored, false);
});

test("letter sandwich scores the exact middle word", () => {
  const there = scoreWord("there");
  const row = there.rows.find((entry) => entry.id === "letter-sandwich");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 8);
  assert.equal(row?.name, "Letter sandwich ×8");
  assert.equal(row?.reason, "Take off the first and last letters and a dictionary word is left: her.");
  assert.deepEqual(row?.highlight, [1, 2, 3]);

  const book = scoreWord("book");
  assert.equal(book.rows.find((entry) => entry.id === "letter-sandwich")?.scored, false);

  const short = scoreWord("cat");
  assert.equal(short.rows.find((entry) => entry.id === "letter-sandwich")?.scored, false);
  assert.match(short.rows.find((entry) => entry.id === "letter-sandwich")?.detail ?? "", /5 letters/);
});

test("even company needs every letter exactly twice", () => {
  const scored = scoreWord("reappear");
  const row = scored.rows.find((entry) => entry.id === "even-company");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 32);
  assert.equal(row?.name, "Even company ×32");
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.match(row?.reason ?? "", /r, e, a, p each appear twice/);

  const noon = scoreWord("noon");
  assert.equal(noon.rows.find((entry) => entry.id === "even-company")?.scored, true);
  assert.deepEqual(noon.rows.find((entry) => entry.id === "even-company")?.highlight, [0, 1, 2, 3]);

  assert.equal(scoreWord("book").rows.find((entry) => entry.id === "even-company")?.scored, false);
  assert.equal(scoreWord("bookkeeper").rows.find((entry) => entry.id === "even-company")?.scored, false);
});

test("perfectly shared needs every distinct letter to share one count", () => {
  assert.equal(isPerfectlyShared("the"), true);
  assert.equal(isPerfectlyShared("CAT"), true);
  assert.equal(isPerfectlyShared("noon"), true);
  assert.equal(isPerfectlyShared("NOON"), true);
  assert.equal(isPerfectlyShared("book"), false);
  assert.equal(isPerfectlyShared("BOOK"), false);
  assert.equal(isPerfectlyShared("aaa"), true);
  assert.equal(isPerfectlyShared("a"), true);
  assert.equal(isPerfectlyShared(""), false);
  assert.equal(isPerfectlyShared("no-on"), false);

  // No repeats and Even company already pay for these words, so Perfectly shared is matched but does not score.
  const cat = scoreWord("cat");
  const catRow = cat.rows.find((entry) => entry.id === "perfectly-shared");
  assert.equal(cat.rows.filter((entry) => entry.id === "perfectly-shared").length, 1);
  assert.equal(catRow?.scored, false);
  assert.equal(catRow?.matched, true);
  assert.match(catRow?.detail ?? "", /c, a, t each occur once\. No repeats already covers this\./);
  assert.equal(cat.total, product(cat));

  const noon = scoreWord("noon");
  const noonRow = noon.rows.find((entry) => entry.id === "perfectly-shared");
  assert.equal(noonRow?.scored, false);
  assert.match(noonRow?.detail ?? "", /n, o each occur twice\. Even company already covers this\./);

  // deeded is the one word only Perfectly shared catches.
  const deeded = scoreWord("deeded");
  const deededRow = deeded.rows.find((entry) => entry.id === "perfectly-shared");
  assert.equal(deeded.rows.filter((entry) => entry.id === "perfectly-shared").length, 1);
  assert.equal(deededRow?.scored, true);
  assert.equal(
    deededRow?.reason,
    "Every different letter appears the same number of times. d, e each occur 3 times.",
  );
  assert.deepEqual(deededRow?.highlight, [0, 1, 2, 3, 4, 5]);

  const book = scoreWord("book");
  assert.equal(book.rows.filter((entry) => entry.id === "perfectly-shared").length, 1);
  assert.equal(book.rows.find((entry) => entry.id === "perfectly-shared")?.scored, false);
  assert.equal(book.rows.find((entry) => entry.id === "perfectly-shared")?.points, null);
  assert.equal(book.rows.find((entry) => entry.id === "perfectly-shared")?.highlight, undefined);

  const single = scoreWord("a");
  assert.equal(single.rows.find((entry) => entry.id === "perfectly-shared")?.matched, true);
  assert.equal(
    single.rows.find((entry) => entry.id === "perfectly-shared")?.detail,
    "Every different letter appears the same number of times. a occurs once. No repeats already covers this.",
  );
});

test("double twins sit together and a run of three is not a pair", () => {
  const coffee = scoreWord("coffee");
  const doubled = coffee.rows.find((entry) => entry.id === "double-twins");
  assert.equal(doubled?.scored, true);
  assert.equal(doubled?.points, 27);
  assert.equal(doubled?.name, "Double twins ×27");
  assert.deepEqual(doubled?.highlight, [2, 3, 4, 5]);
  assert.match(doubled?.reason ?? "", /ffee is 2 pairs/);
  assert.equal(coffee.rows.find((entry) => entry.id === "triple-twins")?.scored, false);

  const balloon = scoreWord("balloon");
  assert.deepEqual(balloon.rows.find((entry) => entry.id === "double-twins")?.highlight, [2, 3, 4, 5]);
  assert.match(balloon.rows.find((entry) => entry.id === "double-twins")?.reason ?? "", /lloo/);

  const committee = scoreWord("committee");
  assert.deepEqual(committee.rows.find((entry) => entry.id === "double-twins")?.highlight, [5, 6, 7, 8]);
  // Double twins covers the plain twins.
  assert.equal(committee.rows.find((entry) => entry.id === "twins")?.scored, false);
  assert.equal(committee.rows.find((entry) => entry.id === "twins")?.matched, true);

  const bookkeeper = scoreWord("bookkeeper");
  const triple = bookkeeper.rows.find((entry) => entry.id === "triple-twins");
  assert.equal(triple?.scored, true);
  assert.equal(triple?.points, 52);
  assert.equal(triple?.name, "Triple twins ×52");
  assert.deepEqual(triple?.highlight, [1, 2, 3, 4, 5, 6]);
  assert.match(triple?.reason ?? "", /ookkee is 3 pairs/);
  // Triple twins covers the lower two.
  assert.equal(bookkeeper.rows.find((entry) => entry.id === "double-twins")?.points, null);
  assert.equal(bookkeeper.rows.find((entry) => entry.id === "double-twins")?.matched, true);
  assert.equal(bookkeeper.rows.find((entry) => entry.id === "twins")?.points, null);

  const book = scoreWord("book");
  assert.equal(book.rows.find((entry) => entry.id === "double-twins")?.scored, false);
  assert.equal(book.rows.find((entry) => entry.id === "triple-twins")?.scored, false);
  assert.equal(book.rows.find((entry) => entry.id === "twins")?.scored, true);

  const longRun = scoreWord("aaa");
  assert.equal(longRun.rows.find((entry) => entry.id === "twins")?.scored, true);
  assert.equal(longRun.rows.find((entry) => entry.id === "double-twins")?.scored, false);
  assert.equal(longRun.rows.find((entry) => entry.id === "triple-twins")?.scored, false);
});

test("bookkeeper pays only the highest twins card", () => {
  const scored = scoreWord("bookkeeper");
  assert.equal(scored.rows.find((row) => row.id === "twins")?.points, null);
  assert.equal(scored.rows.find((row) => row.id === "triple-twins")?.points, 52);
  assert.equal(scored.rows.find((row) => row.id === "no-repeats")?.points, null);
  assert.deepEqual(
    scored.tiles.map((tile) => tile.twin),
    [false, true, true, true, true, true, true, false, false, false],
  );
});

test("backwards alphabet runs down the whole word", () => {
  const pool = scoreWord("pool");
  const row = pool.rows.find((entry) => entry.id === "backwards-alphabet");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 23);
  assert.equal(row?.name, "Backwards alphabet ×23");
  assert.deepEqual(row?.highlight, [0, 1, 2, 3]);
  assert.equal(pool.rows.find((entry) => entry.id === "alphabet-soup")?.scored, false);

  const fed = scoreWord("fed");
  assert.equal(fed.rows.find((entry) => entry.id === "backwards-alphabet")?.scored, true);
  assert.deepEqual(fed.rows.find((entry) => entry.id === "backwards-alphabet")?.highlight, [0, 1, 2]);

  const spoon = scoreWord("spoon");
  assert.equal(spoon.rows.find((entry) => entry.id === "backwards-alphabet")?.scored, true);

  const book = scoreWord("book");
  assert.equal(book.rows.find((entry) => entry.id === "backwards-alphabet")?.scored, false);
  assert.equal(scoreWord("a").rows.find((entry) => entry.id === "backwards-alphabet")?.scored, false);
  assert.match(scoreWord("a").rows.find((entry) => entry.id === "backwards-alphabet")?.detail ?? "", /one-letter/);
});

test("almost is alphabet soup", () => {
  const scored = scoreWord("almost");
  assert.equal(scored.rows.find((row) => row.id === "alphabet-soup")?.points, 23);
});

test("banana is a one vowel wonder", () => {
  const scored = scoreWord("banana");
  const row = scored.rows.find((entry) => entry.id === "one-vowel-wonder");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 11);
  assert.equal(row?.name, "One vowel wonder ×11");
  assert.deepEqual(row?.highlight, [1, 3, 5]);
  assert.match(row?.reason ?? "", /Every vowel is A/);

  assert.equal(scoreWord("area").rows.find((entry) => entry.id === "one-vowel-wonder")?.scored, false);
  assert.equal(scoreWord("see").rows.find((entry) => entry.id === "one-vowel-wonder")?.scored, false);
  assert.equal(scoreWord("rhythm").rows.find((entry) => entry.id === "one-vowel-wonder")?.scored, false);
  assert.equal(scoreWord("syzygy").rows.find((entry) => entry.id === "one-vowel-wonder")?.scored, false);
});

test("banana is in perfect balance", () => {
  const scored = scoreWord("banana");
  const row = scored.rows.find((entry) => entry.id === "perfect-balance");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 5);
  assert.equal(row?.name, "Perfect balance ×5");
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4, 5]);
  assert.match(row?.reason ?? "", /3 vowels and 3 consonants/);

  const area = scoreWord("area");
  assert.equal(area.rows.find((entry) => entry.id === "perfect-balance")?.scored, false);

  const cat = scoreWord("cat");
  assert.equal(cat.rows.find((entry) => entry.id === "perfect-balance")?.scored, false);
  assert.match(cat.rows.find((entry) => entry.id === "perfect-balance")?.detail ?? "", /odd number/);

  const rhythm = scoreWord("rhythm");
  assert.equal(rhythm.rows.find((entry) => entry.id === "perfect-balance")?.scored, false);
  assert.match(rhythm.rows.find((entry) => entry.id === "perfect-balance")?.detail ?? "", /Y counts as a consonant/);
});

test("banana alternates and book does not", () => {
  const scored = scoreWord("banana");
  const row = scored.rows.find((entry) => entry.id === "alternator");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 8);
  assert.equal(row?.name, "Alternator ×8");
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4, 5]);

  const book = scoreWord("book");
  assert.equal(book.rows.find((entry) => entry.id === "alternator")?.scored, false);
  assert.match(book.rows.find((entry) => entry.id === "alternator")?.detail ?? "", /next to each other/);

  const single = scoreWord("a");
  assert.equal(single.rows.find((entry) => entry.id === "alternator")?.scored, false);
  assert.match(single.rows.find((entry) => entry.id === "alternator")?.detail ?? "", /one-letter/);

  const yes = scoreWord("yes");
  assert.equal(yes.rows.find((entry) => entry.id === "alternator")?.scored, true);
});

test("chain length sets the multiplier and a run of 1 misses", () => {
  const scored = scoreWord("strengths");
  const consonants = scored.rows.find((entry) => entry.id === "consonant-chain");
  assert.equal(consonants?.scored, true);
  assert.equal(consonants?.points, 15);
  assert.equal(consonants?.name, "Consonant chain ×15");
  assert.deepEqual(consonants?.highlight, [4, 5, 6, 7, 8]);
  assert.match(consonants?.reason ?? "", /ngths is 5 consonants/);
  assert.equal(scored.rows.find((entry) => entry.id === "vowel-chain")?.scored, false);

  const strength = scoreWord("strength");
  assert.equal(strength.rows.find((entry) => entry.id === "consonant-chain")?.points, 8);
  assert.match(strength.rows.find((entry) => entry.id === "consonant-chain")?.reason ?? "", /4 consonants/);

  const doubled = scoreWord("cryptanalysts");
  assert.deepEqual(doubled.rows.find((entry) => entry.id === "consonant-chain")?.highlight, [0, 1, 2, 3, 4]);

  const rhythm = scoreWord("rhythm");
  assert.equal(rhythm.rows.find((entry) => entry.id === "consonant-chain")?.points, 23);
  assert.deepEqual(rhythm.rows.find((entry) => entry.id === "consonant-chain")?.highlight, [0, 1, 2, 3, 4, 5]);
  assert.equal(rhythm.rows.find((entry) => entry.id === "vowel-chain")?.scored, false);

  const vowels = scoreWord("cooeeing");
  const vowelRow = vowels.rows.find((entry) => entry.id === "vowel-chain");
  assert.equal(vowelRow?.points, 52);
  assert.equal(vowelRow?.name, "Vowel chain ×52");
  assert.deepEqual(vowelRow?.highlight, [1, 2, 3, 4, 5]);
  assert.match(vowelRow?.reason ?? "", /ooeei is 5 vowels/);
  // A run of 2 consonants is ordinary, so it is matched but does not score.
  assert.equal(vowels.rows.find((entry) => entry.id === "consonant-chain")?.points, null);
  assert.equal(vowels.rows.find((entry) => entry.id === "consonant-chain")?.matched, true);

  const book = scoreWord("book");
  assert.equal(book.rows.find((entry) => entry.id === "vowel-chain")?.points, 3);
  assert.deepEqual(book.rows.find((entry) => entry.id === "vowel-chain")?.highlight, [1, 2]);
  assert.equal(book.rows.find((entry) => entry.id === "consonant-chain")?.scored, false);

  const cat = scoreWord("cat");
  assert.equal(cat.rows.find((entry) => entry.id === "consonant-chain")?.scored, false);
  assert.equal(cat.rows.find((entry) => entry.id === "vowel-chain")?.scored, false);
  assert.equal(scoreWord("a").rows.find((entry) => entry.id === "consonant-chain")?.points, null);
  assert.equal(scoreWord("a").rows.find((entry) => entry.id === "vowel-chain")?.points, null);
});

test("facetious sweeps the vowels and lines them up on a ×1 length", () => {
  const scored = scoreWord("facetious");
  assert.equal(scored.lengthMultiplier, 1);
  assert.equal(scored.tileSum, 14);
  assert.equal(scored.rows.find((row) => row.id === "vowel-sweep")?.points, 15);
  assert.equal(scored.rows.find((row) => row.id === "vowel-rich")?.points, 8);
  assert.equal(scored.rows.find((row) => row.id === "a-to-u")?.points, 36);
  assert.equal(scored.rows.find((row) => row.id === "a-cappella")?.scored, false);
  assert.equal(scored.rows.find((row) => row.id === "no-repeats")?.points, 3);
  assert.equal(scored.rows.filter((row) => row.id === "inside" && row.scored).length, 3);
  assert.equal(scored.total, product(scored));
});

test("aa can be all vowels without counting as a mirror", () => {
  const scored = scoreWord("aa");
  assert.equal(scored.rows.find((row) => row.id === "a-cappella")?.scored, true);
  assert.equal(scored.rows.find((row) => row.id === "mirror")?.scored, false);
  assert.equal(scored.rows.find((row) => row.id === "bone-dry")?.scored, false);
  assert.equal(scored.rows.find((row) => row.id === "twins")?.scored, true);
  assert.equal(scored.rows.find((row) => row.id === "vowel-rich")?.points, 8);
  assert.equal(scored.rows.find((row) => row.id === "flat-type")?.points, 8);
  assert.equal(scored.total, product(scored));
});

test("neighbours, endings, and spelling slips pay only when they hit", () => {
  assert.equal(scoreWord("ab").rows.find((row) => row.id === "next-door")?.points, 5);
  assert.equal(scoreWord("fishing").rows.find((row) => row.id === "ing")?.points, 5);
  assert.equal(scoreWord("faqir").rows.find((row) => row.id === "lone-q")?.points, 36);
  assert.equal(scoreWord("know").rows.find((row) => row.id === "quiet-letters")?.points, 19);

  const weird = scoreWord("weird");
  assert.equal(weird.rows.find((row) => row.id === "i-before-e")?.scored, true);
  assert.match(weird.rows.find((row) => row.id === "i-before-e")?.detail ?? "", /EI/);

  const science = scoreWord("science");
  assert.equal(science.rows.find((row) => row.id === "i-before-e")?.scored, true);
  assert.match(science.rows.find((row) => row.id === "i-before-e")?.detail ?? "", /after C/);

  assert.equal(scoreWord("receive").rows.find((row) => row.id === "i-before-e")?.scored, false);
  assert.equal(scoreWord("piece").rows.find((row) => row.id === "i-before-e")?.scored, false);
  assert.equal(scoreWord("quiz").rows.find((row) => row.id === "lone-q")?.scored, false);
});

test("origins come from Wiktionary, and a silence is a miss", () => {
  // Only the rarest root scores; the others are matched.
  const echo = scoreWord("echo");
  assert.equal(echo.rows.find((row) => row.id === "from-greek")?.points, FACTOR_MULTIPLIERS["from-greek"]);
  assert.equal(echo.rows.find((row) => row.id === "from-latin")?.scored, false);
  assert.equal(echo.rows.find((row) => row.id === "from-latin")?.matched, true);
  assert.match(echo.rows.find((row) => row.id === "from-latin")?.detail ?? "", /Only the rarest root scores, and that is Greek\./);
  assert.equal(echo.tileSum, 9);
  assert.equal(echo.lengthMultiplier, 5);
  assert.equal(echo.rows.find((row) => row.id === "no-repeats")?.points, 3);
  assert.equal(echo.total, product(echo));

  const philosophy = scoreWord("philosophy");
  assert.equal(philosophy.rows.find((row) => row.id === "from-greek")?.scored, true);
  assert.equal(philosophy.rows.find((row) => row.id === "from-latin")?.matched, true);
  assert.equal(philosophy.rows.find((row) => row.id === "from-french")?.matched, true);

  assert.equal(scoreWord("piano").rows.find((row) => row.id === "from-italian")?.matched, true);
  assert.equal(scoreWord("they").rows.find((row) => row.id === "from-norse")?.matched, true);
  assert.equal(scoreWord("aardvark").rows.find((row) => row.id === "from-dutch")?.matched, true);
  assert.equal(scoreWord("algebra").rows.find((row) => row.id === "from-arabic")?.matched, true);
  assert.equal(scoreWord("avatar").rows.find((row) => row.id === "from-sanskrit")?.matched, true);
  assert.equal(scoreWord("shekel").rows.find((row) => row.id === "from-hebrew")?.matched, true);
  assert.equal(scoreWord("ghoul").rows.find((row) => row.id === "from-persian")?.matched, true);
  assert.equal(scoreWord("cheetah").rows.find((row) => row.id === "from-hindi")?.matched, true);
  assert.equal(scoreWord("ginkgo").rows.find((row) => row.id === "from-east-asia")?.matched, true);
  assert.equal(scoreWord("gold").rows.find((row) => row.id === "from-greek")?.scored, false);
  const cement = scoreWord("cement");
  assert.equal(cement.rows.find((row) => row.id === "from-french")?.scored, true);
  assert.equal(cement.rows.find((row) => row.id === "from-latin")?.matched, true);
  assert.equal(cement.rows.some((row) => row.id === "from-middle-english"), false);
  assert.match(scoreWord("gold").rows.find((row) => row.id === "from-greek")?.detail ?? "", /Wiktionary has no usable/);
});

test("inflected forms inherit the lemma's origins", () => {
  const from = (word: string) =>
    scoreWord(word)
      .rows.filter((row) => row.id.startsWith("from-") && row.matched)
      .map((row) => row.id);

  assert.deepEqual(from("books"), from("book"));
  assert.deepEqual(from("computed"), from("compute"));
  assert.deepEqual(from("running"), from("run"));
  assert.deepEqual(from("computer"), []);
  assert.deepEqual(from("email"), []);

  const seed = from("seed");
  assert.ok(seed.includes("from-old-english"));
  assert.equal(seed.includes("from-latin"), false);
  assert.equal(seed.includes("from-french"), false);
  assert.ok(from("see").includes("from-latin"));
});

test("sound words, rewinds, and dittos are separate from mirror", () => {
  const buzz = scoreWord("buzz");
  assert.equal(buzz.rows.find((row) => row.id === "sound-word")?.scored, true);
  assert.match(buzz.rows.find((row) => row.id === "sound-word")?.detail ?? "", /imitative/);

  const stressed = scoreWord("stressed");
  assert.equal(stressed.rows.find((row) => row.id === "rewind")?.scored, true);
  assert.match(stressed.rows.find((row) => row.id === "rewind")?.detail ?? "", /desserts/);
  assert.equal(stressed.rows.find((row) => row.id === "mirror")?.scored, false);

  const kayak = scoreWord("kayak");
  assert.equal(kayak.rows.find((row) => row.id === "mirror")?.scored, true);
  assert.equal(kayak.rows.find((row) => row.id === "rewind")?.scored, false);

  const bonbon = scoreWord("bonbon");
  assert.equal(bonbon.rows.find((row) => row.id === "ditto")?.points, FACTOR_MULTIPLIERS.ditto);
  assert.match(bonbon.rows.find((row) => row.id === "ditto")?.detail ?? "", /bon/);
});

function product(scored: { tileSum: number; rows: { id: string; points: number | null }[] }): number {
  return scored.rows.reduce((total, row) => {
    if (row.id === "tiles" || row.points === null) return total;
    return total * row.points;
  }, scored.tileSum);
}

test("calculator words spell themselves on an upside-down calculator", () => {
  const hello = scoreWord("hello").rows.find((row) => row.id === "calculator-word");
  assert.equal(hello?.scored, true);
  assert.match(hello?.reason ?? "", /Type 07734 on a calculator/);
  assert.equal(scoreWord("cat").rows.find((row) => row.id === "calculator-word")?.scored, false);
});

test("upside down words read the same turned 180 degrees", () => {
  assert.equal(scoreWord("solos").rows.find((row) => row.id === "upside-down")?.scored, true);
  assert.equal(scoreWord("dollop").rows.find((row) => row.id === "upside-down")?.scored, true);
  assert.equal(scoreWord("solo").rows.find((row) => row.id === "upside-down")?.scored, false);
});

test("keyboard rows and hands", () => {
  const card = (word: string, id: string) => scoreWord(word).rows.find((row) => row.id === id)?.scored;
  assert.equal(card("typewriter", "typewriter"), true);
  assert.equal(card("alfalfa", "home-row"), true);
  assert.equal(card("sweaterdresses", "left-handed"), true);
  assert.equal(card("homophony", "right-handed"), true);
  assert.equal(card("homophony", "left-handed"), false);
  assert.equal(card("airman", "hand-to-hand"), true);
  assert.equal(card("airmen", "hand-to-hand"), true);
  assert.equal(card("salt", "hand-to-hand"), false);
});

test("sheet music words are all notes, and the tune plays each letter", () => {
  assert.equal(scoreWord("cabbage").rows.find((row) => row.id === "sheet-music")?.scored, true);
  assert.equal(scoreWord("cabbie").rows.find((row) => row.id === "sheet-music")?.scored, false);
});

test("hidden numbers and animals list what they find", () => {
  const often = scoreWord("often").rows.find((row) => row.id === "hidden-number");
  assert.equal(often?.scored, true);
  assert.match(often?.reason ?? "", /ten/);
  const million = scoreWord("million").rows.find((row) => row.id === "hidden-animal");
  assert.equal(million?.matched, true);
  assert.match(million?.detail ?? "", /lion/);
  assert.deepEqual(scoreWord("scatter").rows.find((row) => row.id === "hidden-animal")?.highlight, [1, 2, 3]);
  assert.equal(scoreWord("cat").rows.find((row) => row.id === "hidden-animal")?.matched, undefined);
});

test("popular, bingo, U to A, and A to Z", () => {
  assert.equal(scoreWord("bares").rows.find((row) => row.id === "popular")?.matched, true);
  assert.equal(scoreWord("aardwolf").rows.find((row) => row.id === "popular")?.matched, undefined);
  assert.equal(scoreWord("abalone").rows.find((row) => row.id === "bingo")?.matched, true);
  assert.equal(scoreWord("abalones").rows.find((row) => row.id === "bingo")?.matched, undefined);
  assert.equal(scoreWord("subcontinental").rows.find((row) => row.id === "u-to-a")?.scored, true);
  assert.equal(scoreWord("abuzz").rows.find((row) => row.id === "a-to-z")?.scored, true);
  assert.deepEqual(scoreWord("abuzz").rows.find((row) => row.id === "a-to-z")?.highlight, [0, 4]);
});

test("morse mirror, all dots, keyboard walk, and looking glass", () => {
  const card = (word: string, id: string) => scoreWord(word).rows.find((row) => row.id === id);
  assert.equal(card("abate", "morse-mirror")?.scored, true);
  assert.match(card("abate", "morse-mirror")?.reason ?? "", /\.--\.\.\.\.--\./);
  // All dots is always a Morse palindrome, so it takes that card's place.
  assert.equal(card("hisses", "all-dots")?.scored, true);
  assert.equal(card("hisses", "morse-mirror")?.scored, false);
  assert.equal(card("hisses", "morse-mirror")?.matched, true);
  assert.equal(card("desert", "keyboard-walk")?.scored, true);
  assert.equal(card("dessert", "keyboard-walk")?.scored, false);
  // Looking glass is a stricter Mirror, so it takes Mirror's place.
  assert.equal(card("otto", "looking-glass")?.scored, true);
  assert.equal(card("otto", "mirror")?.scored, false);
  assert.equal(card("kayak", "looking-glass")?.scored, false);
  assert.equal(card("kayak", "mirror")?.scored, true);
});
