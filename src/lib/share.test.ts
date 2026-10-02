import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreWord } from "./scoring";
import { buildShareMessage, shareLink, topCards } from "./share";
import { standingFor } from "./standing";

test("top cards merge repeats and keep the three biggest", () => {
  const scored = scoreWord("headlamp");
  const cards = topCards(scored, 10);
  const inside = cards.find((card) => card.name === "Inside");
  // headlamp hides 4 words, each ×2, so one Inside card worth ×16.
  assert.equal(inside?.points, 16);
  assert.equal(cards.filter((card) => card.name === "Inside").length, 1);
  const top = topCards(scored);
  assert.ok(top.length <= 3);
  assert.ok(top.every((card, index) => index === 0 || card.points <= top[index - 1]!.points));
});

test("the share message names the word, score, best cards, and a link", () => {
  const scored = scoreWord("cabbage");
  const standing = standingFor(scored.total);
  const link = shareLink("https://rwgdle.app", "Cabbage");
  assert.equal(link, "https://rwgdle.app/s/cabbage");
  const message = buildShareMessage({
    word: scored.word,
    total: scored.total,
    tierLabel: standing.tier.label,
    beaten: standing.beaten,
    cards: topCards(scored),
    link,
  });
  const lines = message.text.split("\n");
  assert.equal(lines[0], `🎲 My RWGdle word of the day is CABBAGE, for ${scored.total.toLocaleString("en-US")} points!`);
  assert.match(lines[1]!, /^🏆 /);
  assert.match(lines[2]!, /^🃏 Sheet music ×27/);
  assert.equal(lines.at(-1), "Can you do better? 👉 https://rwgdle.app/s/cabbage");
  assert.equal(message.withoutLink.includes("https://"), false);
});
