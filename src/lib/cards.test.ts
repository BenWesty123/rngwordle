import assert from "node:assert/strict";
import { test } from "node:test";
import { cardCatalog, cardsInWord } from "./cards";
import { FACTOR_MATCHES } from "./scoring";

test("every scoring card is in the collection, except ones that can never score", () => {
  const ids = new Set(cardCatalog().map((card) => card.id));
  for (const id of Object.keys(FACTOR_MATCHES)) {
    if (id === "alphabet-twins") assert.equal(ids.has(id), false);
    else assert.ok(ids.has(id), `${id} is missing from the collection`);
  }
  assert.ok(ids.has("length"));
  assert.equal(cardCatalog().length, 100);
  assert.ok(cardCatalog().every((card) => card.name.length > 0 && card.blurb.length > 0 && /^×/.test(card.value)));
});

test("a word's cards are the ones it scored", () => {
  const cards = cardsInWord("cabbage");
  assert.ok(cards.includes("sheet-music"));
  assert.ok(cards.includes("bingo"));
  assert.equal(cards.includes("tiles"), false);
  assert.equal(new Set(cards).size, cards.length);
});
