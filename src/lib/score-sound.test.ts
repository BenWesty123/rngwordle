import assert from "node:assert/strict";
import { test } from "node:test";
import { letterNotes } from "./score-sound";

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

test("notes inside a letter keep climbing from the points already counted", () => {
  const notes = letterNotes(3, 5);
  const fromZero = letterNotes(3, 0);
  assert.ok(notes[0]!.frequency > fromZero[2]!.frequency);
});
