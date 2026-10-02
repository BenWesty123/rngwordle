import assert from "node:assert/strict";
import { test } from "node:test";
import { displayName, HIDDEN_NAME, isBlockedUsername, isBlockedWord } from "./blocked";
import { scoreWord } from "./scoring";

test("blocked words are never dealt or shown inside other cards", () => {
  assert.equal(isBlockedWord("spic"), true);
  assert.equal(isBlockedWord("spicy"), false);
  // raccoon still hides real words, but not the slur inside it.
  const inside = scoreWord("raccoon").rows.filter((row) => row.id === "inside").map((row) => row.match);
  assert.equal(inside.includes("coon"), false);
});

test("usernames catch slurs, look-alike spellings, and padding", () => {
  for (const name of ["coon", "Coons", "xx_coon_xx", "n1gg3r", "NIGGGER99", "big_faggot", "f4gg0t", "wetbackz", "nigga"]) {
    assert.equal(isBlockedUsername(name), true, name);
  }
});

test("ordinary usernames that contain a short slur's letters are fine", () => {
  for (const name of ["raccoon_fan", "spiky", "swooper", "darkeyes", "niger_river", "nigerian_chef", "honkytonk", "retardant", "TileWizard42", "Westy"]) {
    assert.equal(isBlockedUsername(name), false, name);
  }
  assert.equal(displayName("Westy"), "Westy");
  assert.equal(displayName("coon_99"), HIDDEN_NAME);
});
