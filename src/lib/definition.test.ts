import assert from "node:assert/strict";
import { test } from "node:test";
import { definitionFor, plainDefinition } from "./definition";

test("a roll reads a bundled sentence, or nothing when Wiktionary had no gloss", () => {
  assert.equal(
    definitionFor("book"),
    "A collection of sheets of paper bound together to hinge at one edge, containing printed or written material, pictures, etc.",
  );
  assert.equal(definitionFor("BOOK"), definitionFor("book"));
  assert.equal(definitionFor("ablins"), null);
  assert.match(definitionFor("constructor") ?? "", /^A person who/);
});

test("wiktionary markup collapses to one plain sentence", () => {
  assert.equal(
    plainDefinition('Hatred of <a href="/wiki/marriage">marriage</a>. More text.'),
    "Hatred of marriage.",
  );
});
