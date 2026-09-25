import assert from "node:assert/strict";
import { test } from "node:test";
import { bundledDefinition, needsRemoteDefinition, plainDefinition } from "./definition";

test("echo keeps the first Webster sense and bookkeeper is absent", () => {
  assert.match(bundledDefinition("echo") ?? "", /^A nymph,/);
  assert.equal(bundledDefinition("bookkeeper"), null);
  assert.equal(bundledDefinition("quiz"), null);
});

test("broken 1913 fragments are the only remote lookups", () => {
  assert.equal(needsRemoteDefinition("misogamy"), true);
  assert.equal(needsRemoteDefinition("echo"), false);
  assert.equal(needsRemoteDefinition("bookkeeper"), false);
});

test("wiktionary markup collapses to one plain sentence", () => {
  assert.equal(
    plainDefinition('Hatred of <a href="/wiki/marriage">marriage</a>. More text.'),
    "Hatred of marriage.",
  );
});
