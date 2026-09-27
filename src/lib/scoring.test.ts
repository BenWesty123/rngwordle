import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FACTOR_MATCHES,
  FACTOR_MULTIPLIERS,
  alphabetStaircaseRuns,
  lengthMultiplier,
  letterCollector,
  rarityMultiplier,
  scoreWord,
} from "./scoring";

test("nine-letter words sit at ×1", () => {
  assert.equal(lengthMultiplier(9), 1);
});

test("length multipliers follow the short-double and long-step curve", () => {
  assert.equal(lengthMultiplier(8), 2);
  assert.equal(lengthMultiplier(10), 2);
  assert.equal(lengthMultiplier(7), 4);
  assert.equal(lengthMultiplier(11), 3);
  assert.equal(lengthMultiplier(6), 8);
  assert.equal(lengthMultiplier(12), 4);
  assert.equal(lengthMultiplier(5), 16);
  assert.equal(lengthMultiplier(2), 128);
  assert.equal(lengthMultiplier(15), 7);
});

test("rarer factors get larger multipliers", () => {
  assert.equal(rarityMultiplier(41209), 2);
  assert.equal(FACTOR_MULTIPLIERS.twins, 2);
  assert.equal(FACTOR_MULTIPLIERS.contraband, 3);
  assert.equal(FACTOR_MULTIPLIERS["vowel-sweep"], 6);
  assert.equal(FACTOR_MULTIPLIERS["alphabet-soup"], 8);
  assert.equal(FACTOR_MULTIPLIERS["bone-dry"], 9);
  assert.equal(FACTOR_MULTIPLIERS.mirror, 10);
  assert.equal(FACTOR_MULTIPLIERS["hidden-mirror"], 5);
  assert.equal(FACTOR_MULTIPLIERS["swap-shop"], 5);
  assert.equal(FACTOR_MULTIPLIERS["swap-shop"], rarityMultiplier(2815));
  assert.equal(FACTOR_MULTIPLIERS["alphabet-step"], 3);
  assert.equal(FACTOR_MULTIPLIERS["alphabet-step"], rarityMultiplier(16735));
  assert.equal(FACTOR_MATCHES["lonely-word"], 35181);
  assert.equal(FACTOR_MULTIPLIERS["lonely-word"], 2);
  assert.equal(FACTOR_MULTIPLIERS["lonely-word"], rarityMultiplier(FACTOR_MATCHES["lonely-word"]));
  assert.equal(FACTOR_MATCHES["letter-collector"], 145);
  assert.equal(FACTOR_MULTIPLIERS["letter-collector"], 9);
  assert.equal(
    FACTOR_MULTIPLIERS["letter-collector"],
    rarityMultiplier(FACTOR_MATCHES["letter-collector"]),
  );
  assert.equal(FACTOR_MATCHES["alphabet-staircase"], 1502);
  assert.equal(FACTOR_MULTIPLIERS["alphabet-staircase"], 6);
  assert.equal(
    FACTOR_MULTIPLIERS["alphabet-staircase"],
    rarityMultiplier(FACTOR_MATCHES["alphabet-staircase"]),
  );
  assert.equal(FACTOR_MULTIPLIERS["double-or-nothing"], 5);
  assert.equal(FACTOR_MULTIPLIERS["double-or-nothing"], rarityMultiplier(5429));
  assert.equal(FACTOR_MULTIPLIERS["woven-together"], 6);
  assert.equal(FACTOR_MULTIPLIERS["woven-together"], rarityMultiplier(1490));
  assert.equal(FACTOR_MULTIPLIERS["building-blocks"], 5);
  assert.equal(FACTOR_MULTIPLIERS["building-blocks"], rarityMultiplier(4186));
  assert.equal(FACTOR_MULTIPLIERS["hidden-mirror"], rarityMultiplier(3148));
  assert.equal(FACTOR_MULTIPLIERS["a-cappella"], 14);
  assert.equal(FACTOR_MULTIPLIERS["vowel-rich"], 4);
  assert.equal(FACTOR_MULTIPLIERS["flat-type"], 4);
  assert.equal(FACTOR_MULTIPLIERS["next-door"], 3);
  assert.equal(FACTOR_MULTIPLIERS.ing, 3);
  assert.equal(FACTOR_MULTIPLIERS.ist, 6);
  assert.equal(FACTOR_MULTIPLIERS.ish, 7);
  assert.equal(FACTOR_MULTIPLIERS["i-before-e"], 6);
  assert.equal(FACTOR_MULTIPLIERS["quiet-letters"], 7);
  assert.equal(FACTOR_MULTIPLIERS["a-to-u"], 11);
  assert.equal(FACTOR_MULTIPLIERS["lone-q"], 11);
  assert.ok(FACTOR_MULTIPLIERS.mirror > FACTOR_MULTIPLIERS["vowel-sweep"]);
  assert.ok(FACTOR_MULTIPLIERS["a-to-u"] > FACTOR_MULTIPLIERS.mirror);
  assert.ok(FACTOR_MULTIPLIERS["vowel-sweep"] > FACTOR_MULTIPLIERS.twins);
});

test("quiz is scrabble tiles times length times contraband", () => {
  const scored = scoreWord("quiz");
  assert.equal(scored.tileSum, 22);
  assert.equal(scored.lengthMultiplier, 32);
  assert.equal(scored.rows.find((row) => row.id === "contraband")?.points, 3);
  assert.equal(scored.rows.find((row) => row.id === "no-repeats")?.points, 2);
  assert.equal(scored.rows.find((row) => row.id === "perfect-balance")?.points, 3);
  assert.equal(scored.rows.find((row) => row.id === "vowel-chain")?.points, 2);
  assert.equal(scored.total, 22 * 32 * 3 * 2 * 3 * 2);
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
  assert.equal(hidden[0]?.points, 5);
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
  assert.equal(rows[0]?.points, 5);
  assert.equal(rows[0]?.match, "an, ant, anti, antic, antics");
  assert.deepEqual(rows[0]?.highlight, [0, 1, 2, 3, 4, 5]);
  assert.equal(rows[0]?.reason, "an, ant, anti, antic, antics.");

  const quiz = scoreWord("quiz");
  assert.equal(quiz.rows.find((row) => row.id === "building-blocks")?.scored, false);
  assert.equal(quiz.rows.find((row) => row.id === "building-blocks")?.points, null);
});

test("schooled weaves shoe and cold, and a word that does not split misses", () => {
  const rows = scoreWord("schooled").rows.filter((row) => row.id === "woven-together");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.scored, true);
  assert.equal(rows[0]?.points, 6);
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
  const hoping = scoreWord("hoping").rows.filter((row) => row.id === "double-or-nothing" && row.scored);
  const toHopping = hoping.find((row) => row.match === "hopping");
  assert.equal(toHopping?.points, 5);
  assert.deepEqual(toHopping?.highlight, [2]);
  assert.match(toHopping?.reason ?? "", /hopping/);

  const hopping = scoreWord("hopping").rows.filter((row) => row.id === "double-or-nothing" && row.scored);
  assert.equal(hopping.length, 1);
  assert.equal(hopping[0]?.points, 5);
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
  assert.equal(steps[0]?.points, 3);
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
  assert.equal(row?.points, 9);
  assert.equal(row?.points, FACTOR_MULTIPLIERS["letter-collector"]);
  assert.equal(row?.name, "Letter collector ×9");
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(row?.reason, "A–F is 6 alphabet letters in a row.");
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
  assert.equal(earlier.rows.find((entry) => entry.id === "letter-collector")?.reason, "A–F is 6 alphabet letters in a row.");

  const longer = scoreWord("abcdefmnopqrst");
  assert.equal(longer.rows.find((entry) => entry.id === "letter-collector")?.reason, "M–T is 8 alphabet letters in a row.");
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
  assert.equal(hij?.points, 6);
  assert.equal(hij?.points, FACTOR_MULTIPLIERS["alphabet-staircase"]);
  assert.equal(hij?.name, "Alphabet staircase ×6");
  assert.deepEqual(hij?.highlight, [0, 1, 2]);
  assert.equal(hij?.reason, "HIJ is 3 letters stepping up the alphabet.");
  assert.deepEqual(alphabetStaircaseRuns("HIJACK"), [{ start: 0, end: 3 }]);
  assert.equal(hijack.total, product(hijack));

  const first = scoreWord("first");
  const rst = first.rows.find((entry) => entry.id === "alphabet-staircase");
  assert.equal(rst?.scored, true);
  assert.equal(rst?.points, FACTOR_MULTIPLIERS["alphabet-staircase"]);
  assert.deepEqual(rst?.highlight, [2, 3, 4]);
  assert.equal(rst?.reason, "RST is 3 letters stepping up the alphabet.");
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
    "RSTU is 4 letters stepping up the alphabet.",
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
    "HIJ and XYZ step up the alphabet.",
  );
});

test("a lonely word has no insert, delete, or substitute neighbour", () => {
  const lonely = scoreWord("syzygy");
  const row = lonely.rows.find((entry) => entry.id === "lonely-word");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 2);
  assert.equal(row?.name, "Lonely word ×2");
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
  assert.equal(swaps[0]?.points, 5);
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
  assert.deepEqual(
    pairs.map((row) => ({ word: row.match, highlight: row.highlight })),
    [
      { word: "cared", highlight: [0, 1] },
      { word: "arced", highlight: [1, 2] },
    ],
  );
  assert.ok(pairs.every((row) => row.points === 5));
});

test("kayak multiplies mirror", () => {
  const scored = scoreWord("kayak");
  assert.equal(scored.tileSum, 16);
  assert.equal(scored.lengthMultiplier, 16);
  assert.equal(scored.rows.find((row) => row.id === "mirror")?.points, 10);
  assert.equal(scored.rows.filter((row) => row.id === "inside" && row.scored).length, 2);
  assert.equal(scored.rows.find((row) => row.id === "alternator")?.points, 4);
  assert.equal(scored.rows.find((row) => row.id === "alphabet-twins")?.points, 2);
  assert.equal(scored.total, 16 * 16 * 10 * 2 * 2 * 4 * 2);
});

test("rhythm is bone dry and y is not a vowel", () => {
  const scored = scoreWord("rhythm");
  assert.equal(scored.rows.find((row) => row.id === "bone-dry")?.scored, true);
  assert.equal(scored.rows.find((row) => row.id === "a-cappella")?.scored, false);
  assert.equal(scored.tileSum, 17);
  assert.equal(scored.lengthMultiplier, 8);
  assert.equal(scored.rows.find((row) => row.id === "quiet-letters")?.points, 7);
  assert.equal(scored.total, product(scored));
});

test("stop pays Anagram once per other word with the same letters", () => {
  const scored = scoreWord("stop");
  const hits = scored.rows.filter((row) => row.id === "anagram" && row.scored);
  assert.deepEqual(
    hits.map((row) => row.match),
    ["opts", "post", "pots", "spot", "tops"],
  );
  assert.ok(hits.every((row) => row.points === 4));
  assert.ok(hits.every((row) => row.highlight?.length === scored.word.length));
  assert.equal(scoreWord("echo").rows.find((row) => row.id === "anagram")?.points, null);
  assert.equal(FACTOR_MULTIPLIERS.anagram, 4);
});

test("headlamp pays Inside once per nested dictionary word", () => {
  const scored = scoreWord("headlamp");
  const hits = scored.rows.filter((row) => row.id === "inside" && row.scored);
  assert.deepEqual(
    hits.map((row) => row.match),
    ["head", "lamp", "lam", "amp"],
  );
  assert.equal(scoreWord("cat").rows.find((row) => row.id === "inside")?.match, undefined);
  assert.equal(hits.length, 4);
  assert.ok(hits.every((row) => row.points === FACTOR_MULTIPLIERS.inside));
  assert.deepEqual(
    hits.map((row) => row.highlight),
    [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [4, 5, 6],
      [5, 6, 7],
    ],
  );
  const length = scored.rows.find((row) => row.id === "length");
  assert.deepEqual(length?.highlight, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(scoreWord("cat").rows.find((row) => row.id === "inside")?.points, null);
  assert.deepEqual(
    scoreWord("quiz").rows.find((row) => row.id === "contraband")?.highlight,
    [0, 3],
  );
  assert.deepEqual(
    scoreWord("bookkeeper").rows.find((row) => row.id === "twins")?.highlight,
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(scoreWord("echo").rows.find((row) => row.id === "no-repeats")?.highlight, [0, 1, 2, 3]);
  assert.match(scoreWord("echo").rows.find((row) => row.id === "from-greek")?.reason ?? "", /Greek/);
});

test("bookends matches the first two letters to the last two", () => {
  const church = scoreWord("church");
  const row = church.rows.find((entry) => entry.id === "bookends");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 8);
  assert.equal(row?.name, "Bookends ×8");
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
  const banana = scoreWord("banana");
  const row = banana.rows.find((entry) => entry.id === "alphabet-twins");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 2);
  assert.equal(row?.name, "Alphabet twins ×2");
  assert.equal(row?.reason, "ban, nab.");
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4, 5]);

  const tone = scoreWord("tone");
  const toneRow = tone.rows.find((entry) => entry.id === "alphabet-twins");
  const tonePartners = (toneRow?.reason ?? "").replace(/\.$/, "").split(", ");
  assert.equal(toneRow?.scored, true);
  assert.ok(tonePartners.includes("nonet"));
  assert.equal(tonePartners.includes("note"), false);
  assert.equal(tonePartners.includes("ten"), false);

  const start = scoreWord("start");
  const startRow = start.rows.find((entry) => entry.id === "alphabet-twins");
  assert.match(startRow?.reason ?? "", /^arts, attars, ratatats, rats, satara, sataras, star, stars, and 10 more\.$/);

  assert.equal(scoreWord("quiz").rows.find((entry) => entry.id === "alphabet-twins")?.scored, false);
});

test("inside out moves the first letter to the end", () => {
  const stable = scoreWord("stable");
  const row = stable.rows.find((entry) => entry.id === "inside-out");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 7);
  assert.equal(row?.name, "Inside out ×7");
  assert.equal(row?.reason, "tables.");
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4, 5]);

  assert.equal(scoreWord("book").rows.find((entry) => entry.id === "inside-out")?.scored, false);
  assert.equal(scoreWord("aa").rows.find((entry) => entry.id === "inside-out")?.scored, false);
});

test("shrinking word follows a deletion chain of at least 5", () => {
  const scored = scoreWord("startling");
  const row = scored.rows.find((entry) => entry.id === "shrinking-word");
  const chain = "startling → starling → staring → string → sting → ting → tin → in";
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 4);
  assert.equal(row?.name, "Shrinking word ×4");
  assert.equal(row?.reason, chain);
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
  assert.equal(row?.points, 5);
  assert.equal(row?.name, "Front or back ×5");
  assert.equal(row?.reason, "tart and star.");
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4]);

  const book = scoreWord("book");
  assert.equal(book.rows.find((entry) => entry.id === "front-or-back")?.scored, false);
});

test("letter sandwich scores the exact middle word", () => {
  const there = scoreWord("there");
  const row = there.rows.find((entry) => entry.id === "letter-sandwich");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 4);
  assert.equal(row?.name, "Letter sandwich ×4");
  assert.equal(row?.reason, "her sits inside.");
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
  assert.equal(row?.points, 10);
  assert.equal(row?.name, "Even company ×10");
  assert.deepEqual(row?.highlight, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.match(row?.reason ?? "", /r, e, a, p each appear twice/);

  const noon = scoreWord("noon");
  assert.equal(noon.rows.find((entry) => entry.id === "even-company")?.scored, true);
  assert.deepEqual(noon.rows.find((entry) => entry.id === "even-company")?.highlight, [0, 1, 2, 3]);

  assert.equal(scoreWord("book").rows.find((entry) => entry.id === "even-company")?.scored, false);
  assert.equal(scoreWord("bookkeeper").rows.find((entry) => entry.id === "even-company")?.scored, false);
});

test("double twins sit together and a run of three is not a pair", () => {
  const coffee = scoreWord("coffee");
  const doubled = coffee.rows.find((entry) => entry.id === "double-twins");
  assert.equal(doubled?.scored, true);
  assert.equal(doubled?.points, 9);
  assert.equal(doubled?.name, "Double twins ×9");
  assert.deepEqual(doubled?.highlight, [2, 3, 4, 5]);
  assert.match(doubled?.reason ?? "", /ffee is 2 pairs/);
  assert.equal(coffee.rows.find((entry) => entry.id === "triple-twins")?.scored, false);

  const balloon = scoreWord("balloon");
  assert.deepEqual(balloon.rows.find((entry) => entry.id === "double-twins")?.highlight, [2, 3, 4, 5]);
  assert.match(balloon.rows.find((entry) => entry.id === "double-twins")?.reason ?? "", /lloo/);

  const committee = scoreWord("committee");
  assert.deepEqual(committee.rows.find((entry) => entry.id === "double-twins")?.highlight, [5, 6, 7, 8]);
  assert.equal(committee.rows.find((entry) => entry.id === "twins")?.scored, true);

  const bookkeeper = scoreWord("bookkeeper");
  const triple = bookkeeper.rows.find((entry) => entry.id === "triple-twins");
  assert.equal(triple?.scored, true);
  assert.equal(triple?.points, 14);
  assert.equal(triple?.name, "Triple twins ×14");
  assert.deepEqual(triple?.highlight, [1, 2, 3, 4, 5, 6]);
  assert.match(triple?.reason ?? "", /ookkee is 3 pairs/);
  assert.equal(bookkeeper.rows.find((entry) => entry.id === "double-twins")?.points, 9);
  assert.deepEqual(bookkeeper.rows.find((entry) => entry.id === "double-twins")?.highlight, [1, 2, 3, 4, 5, 6]);

  const book = scoreWord("book");
  assert.equal(book.rows.find((entry) => entry.id === "double-twins")?.scored, false);
  assert.equal(book.rows.find((entry) => entry.id === "triple-twins")?.scored, false);
  assert.equal(book.rows.find((entry) => entry.id === "twins")?.scored, true);

  const longRun = scoreWord("aaa");
  assert.equal(longRun.rows.find((entry) => entry.id === "twins")?.scored, true);
  assert.equal(longRun.rows.find((entry) => entry.id === "double-twins")?.scored, false);
  assert.equal(longRun.rows.find((entry) => entry.id === "triple-twins")?.scored, false);
});

test("bookkeeper pays the twins multiplier once", () => {
  const scored = scoreWord("bookkeeper");
  assert.equal(scored.rows.find((row) => row.id === "twins")?.points, 2);
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
  assert.equal(row?.points, 8);
  assert.equal(row?.name, "Backwards alphabet ×8");
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
  assert.equal(scored.rows.find((row) => row.id === "alphabet-soup")?.points, 8);
});

test("banana is a one vowel wonder", () => {
  const scored = scoreWord("banana");
  const row = scored.rows.find((entry) => entry.id === "one-vowel-wonder");
  assert.equal(row?.scored, true);
  assert.equal(row?.points, 5);
  assert.equal(row?.name, "One vowel wonder ×5");
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
  assert.equal(row?.points, 3);
  assert.equal(row?.name, "Perfect balance ×3");
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
  assert.equal(row?.points, 4);
  assert.equal(row?.name, "Alternator ×4");
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
  assert.equal(consonants?.points, 6);
  assert.equal(consonants?.name, "Consonant chain ×6");
  assert.deepEqual(consonants?.highlight, [4, 5, 6, 7, 8]);
  assert.match(consonants?.reason ?? "", /ngths is 5 consonants/);
  assert.equal(scored.rows.find((entry) => entry.id === "vowel-chain")?.scored, false);

  const strength = scoreWord("strength");
  assert.equal(strength.rows.find((entry) => entry.id === "consonant-chain")?.points, 4);
  assert.match(strength.rows.find((entry) => entry.id === "consonant-chain")?.reason ?? "", /4 consonants/);

  const doubled = scoreWord("cryptanalysts");
  assert.deepEqual(doubled.rows.find((entry) => entry.id === "consonant-chain")?.highlight, [0, 1, 2, 3, 4]);

  const rhythm = scoreWord("rhythm");
  assert.equal(rhythm.rows.find((entry) => entry.id === "consonant-chain")?.points, 8);
  assert.deepEqual(rhythm.rows.find((entry) => entry.id === "consonant-chain")?.highlight, [0, 1, 2, 3, 4, 5]);
  assert.equal(rhythm.rows.find((entry) => entry.id === "vowel-chain")?.scored, false);

  const vowels = scoreWord("cooeeing");
  const vowelRow = vowels.rows.find((entry) => entry.id === "vowel-chain");
  assert.equal(vowelRow?.points, 14);
  assert.equal(vowelRow?.name, "Vowel chain ×14");
  assert.deepEqual(vowelRow?.highlight, [1, 2, 3, 4, 5]);
  assert.match(vowelRow?.reason ?? "", /ooeei is 5 vowels/);
  assert.equal(vowels.rows.find((entry) => entry.id === "consonant-chain")?.points, 2);

  const book = scoreWord("book");
  assert.equal(book.rows.find((entry) => entry.id === "vowel-chain")?.points, 2);
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
  assert.equal(scored.rows.find((row) => row.id === "vowel-sweep")?.points, 6);
  assert.equal(scored.rows.find((row) => row.id === "vowel-rich")?.points, 4);
  assert.equal(scored.rows.find((row) => row.id === "a-to-u")?.points, 11);
  assert.equal(scored.rows.find((row) => row.id === "a-cappella")?.scored, false);
  assert.equal(scored.rows.find((row) => row.id === "no-repeats")?.points, 2);
  assert.equal(scored.rows.filter((row) => row.id === "inside" && row.scored).length, 3);
  assert.equal(scored.total, product(scored));
});

test("aa can be all vowels without counting as a mirror", () => {
  const scored = scoreWord("aa");
  assert.equal(scored.rows.find((row) => row.id === "a-cappella")?.scored, true);
  assert.equal(scored.rows.find((row) => row.id === "mirror")?.scored, false);
  assert.equal(scored.rows.find((row) => row.id === "bone-dry")?.scored, false);
  assert.equal(scored.rows.find((row) => row.id === "twins")?.scored, true);
  assert.equal(scored.rows.find((row) => row.id === "vowel-rich")?.points, 4);
  assert.equal(scored.rows.find((row) => row.id === "flat-type")?.points, 4);
  assert.equal(scored.total, product(scored));
});

test("neighbours, endings, and spelling slips pay only when they hit", () => {
  assert.equal(scoreWord("ab").rows.find((row) => row.id === "next-door")?.points, 3);
  assert.equal(scoreWord("fishing").rows.find((row) => row.id === "ing")?.points, 3);
  assert.equal(scoreWord("faqir").rows.find((row) => row.id === "lone-q")?.points, 11);
  assert.equal(scoreWord("know").rows.find((row) => row.id === "quiet-letters")?.points, 7);

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
  const echo = scoreWord("echo");
  assert.equal(echo.rows.find((row) => row.id === "from-greek")?.points, FACTOR_MULTIPLIERS["from-greek"]);
  assert.equal(echo.rows.find((row) => row.id === "from-latin")?.scored, true);
  assert.equal(echo.tileSum, 9);
  assert.equal(echo.lengthMultiplier, 32);
  assert.equal(echo.rows.find((row) => row.id === "no-repeats")?.points, 2);
  assert.equal(echo.total, product(echo));

  const philosophy = scoreWord("philosophy");
  assert.equal(philosophy.rows.find((row) => row.id === "from-greek")?.scored, true);
  assert.equal(philosophy.rows.find((row) => row.id === "from-latin")?.scored, true);
  assert.equal(philosophy.rows.find((row) => row.id === "from-french")?.scored, true);

  assert.equal(scoreWord("piano").rows.find((row) => row.id === "from-italian")?.scored, true);
  assert.equal(scoreWord("they").rows.find((row) => row.id === "from-norse")?.scored, true);
  assert.equal(scoreWord("aardvark").rows.find((row) => row.id === "from-dutch")?.scored, true);
  assert.equal(scoreWord("algebra").rows.find((row) => row.id === "from-arabic")?.scored, true);
  assert.equal(scoreWord("avatar").rows.find((row) => row.id === "from-sanskrit")?.scored, true);
  assert.equal(scoreWord("shekel").rows.find((row) => row.id === "from-hebrew")?.scored, true);
  assert.equal(scoreWord("ghoul").rows.find((row) => row.id === "from-persian")?.scored, true);
  assert.equal(scoreWord("cheetah").rows.find((row) => row.id === "from-hindi")?.scored, true);
  assert.equal(scoreWord("ginkgo").rows.find((row) => row.id === "from-east-asia")?.scored, true);
  assert.equal(scoreWord("gold").rows.find((row) => row.id === "from-greek")?.scored, false);
  const cement = scoreWord("cement");
  assert.equal(cement.rows.find((row) => row.id === "from-french")?.scored, true);
  assert.equal(cement.rows.find((row) => row.id === "from-latin")?.scored, true);
  assert.equal(cement.rows.some((row) => row.id === "from-middle-english"), false);
  assert.match(scoreWord("gold").rows.find((row) => row.id === "from-greek")?.detail ?? "", /Wiktionary has no usable/);
});

test("inflected forms inherit the lemma's origins", () => {
  const from = (word: string) =>
    scoreWord(word)
      .rows.filter((row) => row.id.startsWith("from-") && row.scored)
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
