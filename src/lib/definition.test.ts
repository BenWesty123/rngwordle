import assert from "node:assert/strict";
import { test } from "node:test";
import { plainDefinition } from "./definition";

test("wiktionary markup collapses to one plain sentence", () => {
  assert.equal(
    plainDefinition('Hatred of <a href="/wiki/marriage">marriage</a>. More text.'),
    "Hatred of marriage.",
  );
});
