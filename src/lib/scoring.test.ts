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
  assert.equal(scored.total, 22 * 32 * 3 * 2);
  assert.equal(product(scored), scored.total);
});

test("kayak multiplies mirror", () => {
  const scored = scoreWord("kayak");
  assert.equal(scored.tileSum, 16);
  assert.equal(scored.lengthMultiplier, 16);
  assert.equal(scored.rows.find((row) => row.id === "mirror")?.points, 10);
  assert.equal(scored.total, 16 * 16 * 10);
});

test("rhythm is bone dry and y is not a vowel", () => {
  const scored = scoreWord("rhythm");
  assert.equal(scored.rows.find((row) => row.id === "bone-dry")?.scored, true);
  assert.equal(scored.rows.find((row) => row.id === "a-cappella")?.scored, false);
  assert.equal(scored.tileSum, 17);
  assert.equal(scored.lengthMultiplier, 8);
  assert.equal(scored.rows.find((row) => row.id === "quiet-letters")?.points, 7);
  assert.equal(scored.total, 17 * 8 * 9 * 7);
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

test("facetious sweeps the vowels and lines them up on a ×1 length", () => {
  const scored = scoreWord("facetious");
  assert.equal(scored.lengthMultiplier, 1);
  assert.equal(scored.tileSum, 14);
  assert.equal(scored.rows.find((row) => row.id === "vowel-sweep")?.points, 6);
  assert.equal(scored.rows.find((row) => row.id === "vowel-rich")?.points, 4);
  assert.equal(scored.rows.find((row) => row.id === "a-to-u")?.points, 11);
  assert.equal(scored.rows.find((row) => row.id === "a-cappella")?.scored, false);
  assert.equal(scored.rows.find((row) => row.id === "no-repeats")?.points, 2);
  assert.equal(scored.total, 14 * 6 * 4 * 11 * 2);
});

test("aa can be all vowels without counting as a mirror", () => {
  const scored = scoreWord("aa");
  assert.equal(scored.rows.find((row) => row.id === "a-cappella")?.scored, true);
  assert.equal(scored.rows.find((row) => row.id === "mirror")?.scored, false);
  assert.equal(scored.rows.find((row) => row.id === "bone-dry")?.scored, false);
  assert.equal(scored.rows.find((row) => row.id === "twins")?.scored, true);
  assert.equal(scored.rows.find((row) => row.id === "vowel-rich")?.points, 4);
  assert.equal(scored.rows.find((row) => row.id === "flat-type")?.points, 4);
  assert.equal(scored.total, 2 * 128 * 14 * 2 * 4 * 4);
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

test("origins come from the 1913 Webster trace, and a silence is a miss", () => {
  const echo = scoreWord("echo");
  assert.equal(echo.rows.find((row) => row.id === "from-greek")?.points, FACTOR_MULTIPLIERS["from-greek"]);
  assert.equal(echo.tileSum, 9);
  assert.equal(echo.lengthMultiplier, 32);
  assert.equal(echo.rows.find((row) => row.id === "no-repeats")?.points, 2);
  assert.equal(echo.total, 9 * 32 * FACTOR_MULTIPLIERS["from-greek"] * 2);

  assert.equal(scoreWord("piano").rows.find((row) => row.id === "from-italian")?.scored, true);
  assert.equal(scoreWord("they").rows.find((row) => row.id === "from-norse")?.scored, true);
  assert.equal(scoreWord("aardvark").rows.find((row) => row.id === "from-dutch")?.scored, true);
  assert.equal(scoreWord("algebra").rows.find((row) => row.id === "from-arabic")?.scored, true);
  assert.equal(scoreWord("avatar").rows.find((row) => row.id === "from-sanskrit")?.scored, true);
  assert.equal(scoreWord("shekel").rows.find((row) => row.id === "from-hebrew")?.scored, true);
  assert.equal(scoreWord("ghoul").rows.find((row) => row.id === "from-persian")?.scored, true);
  assert.equal(scoreWord("cheetah").rows.find((row) => row.id === "from-hindi")?.scored, true);
  assert.equal(scoreWord("ginkgo").rows.find((row) => row.id === "from-east-asia")?.scored, true);
  assert.equal(scoreWord("philosophy").rows.find((row) => row.id === "from-greek")?.scored, false);
  assert.equal(scoreWord("gold").rows.find((row) => row.id === "from-greek")?.scored, false);
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
