import assert from "node:assert/strict";
import { test } from "node:test";
import {
  letterNotes,
  MULTIPLIER_BLIP_CAP,
  MULTIPLIER_CAP_HZ,
  MULTIPLIER_FLOOR_HZ,
  MULTIPLIER_START_HZ,
  multiplierBlipCount,
  multiplierNotes,
  nextMultiplierStart,
} from "./score-sound";

test("one-point letters are a single note", () => {
  const notes = letterNotes(1, 0);
  assert.equal(notes.length, 1);
  assert.equal(notes[0]?.delay, 0);
  assert.equal(notes[0]?.frequency, 220);
});

test("three-point letters are three rising notes, packed tighter than one note each", () => {
  const notes = letterNotes(3, 0);
  assert.equal(notes.length, 3);
  assert.ok(notes[1]!.frequency > notes[0]!.frequency);
  assert.ok(notes[2]!.frequency > notes[1]!.frequency);
  assert.ok(notes[1]!.delay > 0);
  assert.ok(notes[1]!.delay <= 0.07);
  assert.ok(notes[2]!.delay - notes[1]!.delay <= 0.07);
});

test("later letters start higher than the running total so far", () => {
  const first = letterNotes(1, 0);
  const later = letterNotes(1, 4);
  assert.ok(later[0]!.frequency > first[0]!.frequency);
});

test("a small multiplier is a short run and a large one is longer, then capped", () => {
  assert.equal(multiplierBlipCount(2), 3);
  assert.equal(multiplierNotes(2, MULTIPLIER_START_HZ).length, 3);
  assert.equal(multiplierBlipCount(32), MULTIPLIER_BLIP_CAP);
  assert.equal(multiplierBlipCount(128), MULTIPLIER_BLIP_CAP);
  assert.ok(multiplierBlipCount(32) > multiplierBlipCount(2));
});

test("each multiplier run climbs from a low restart and never goes past the cap", () => {
  const first = multiplierNotes(32, MULTIPLIER_START_HZ);
  assert.equal(first[0]?.frequency, MULTIPLIER_START_HZ);
  assert.ok(first[1]!.frequency > first[0]!.frequency);
  assert.ok(first.every((note) => note.frequency <= MULTIPLIER_CAP_HZ));
  assert.ok(first.some((note) => note.frequency === MULTIPLIER_CAP_HZ));
  const next = nextMultiplierStart(MULTIPLIER_START_HZ, first);
  assert.ok(next < MULTIPLIER_START_HZ);
  assert.ok(next < first[first.length - 1]!.frequency);
  const second = multiplierNotes(32, next);
  assert.equal(second[0]?.frequency, next);
  assert.ok(second.every((note) => note.frequency <= MULTIPLIER_CAP_HZ));
});

test("an uncapped run still restarts lower than where it finished", () => {
  const run = multiplierNotes(2, MULTIPLIER_START_HZ);
  assert.ok(run.every((note) => note.frequency < MULTIPLIER_CAP_HZ));
  const next = nextMultiplierStart(MULTIPLIER_START_HZ, run);
  assert.ok(next < run[run.length - 1]!.frequency);
  assert.ok(next < MULTIPLIER_START_HZ);
  assert.ok(next >= MULTIPLIER_FLOOR_HZ);
});

test("notes inside a letter keep climbing from the points already counted", () => {
  const notes = letterNotes(3, 5);
  const fromZero = letterNotes(3, 0);
  assert.ok(notes[0]!.frequency > fromZero[2]!.frequency);
});
