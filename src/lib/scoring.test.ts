import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FACTOR_MULTIPLIERS,
  lengthMultiplier,
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

test("kayak multiplies mirror", () => {
  const scored = scoreWord("kayak");
  assert.equal(scored.tileSum, 16);
  assert.equal(scored.lengthMultiplier, 16);
  assert.equal(scored.rows.find((row) => row.id === "mirror")?.points, 10);
  assert.equal(scored.rows.filter((row) => row.id === "inside" && row.scored).length, 2);
  assert.equal(scored.rows.find((row) => row.id === "alternator")?.points, 4);
  assert.equal(scored.total, 16 * 16 * 10 * 2 * 2 * 4);
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
