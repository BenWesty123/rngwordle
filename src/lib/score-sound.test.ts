import assert from "node:assert/strict";
import { test } from "node:test";
import {
  letterNotes,
  MULTIPLIER_BLIP_CAP,
  MULTIPLIER_CAP_HZ,
  MULTIPLIER_FLOOR_HZ,
  multiplierBlipCount,
  planMultiplierRuns,
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
  assert.equal(planMultiplierRuns([2])[0]?.length, 3);
  assert.equal(multiplierBlipCount(32), MULTIPLIER_BLIP_CAP);
  assert.equal(multiplierBlipCount(128), MULTIPLIER_BLIP_CAP);
  assert.ok(multiplierBlipCount(32) > multiplierBlipCount(2));
});

function lastNote(run: { frequency: number }[]): number {
  return run[run.length - 1]!.frequency;
}

test("echo's later multiplier ends higher than the earlier one", () => {
  const [length, greek] = planMultiplierRuns([32, 6]);
  assert.equal(length!.length, 12);
  assert.equal(greek!.length, 6);
  assert.ok(lastNote(greek!) > lastNote(length!));
  assert.ok(greek![0]!.frequency < lastNote(length!));
  assert.ok(greek![0]!.frequency < lastNote(greek!));
  assert.equal(lastNote(greek!), MULTIPLIER_CAP_HZ);
  for (const run of [length!, greek!]) {
    assert.ok(run.every((note) => note.frequency <= MULTIPLIER_CAP_HZ && note.frequency >= MULTIPLIER_FLOOR_HZ));
    assert.ok(run.every((note, index) => index === 0 || note.frequency >= run[index - 1]!.frequency));
  }
});

test("many multipliers compress the ending steps and still climb under the cap", () => {
  const runs = planMultiplierRuns(Array.from({ length: 13 }, () => 2));
  const endings = runs.map((run) => lastNote(run));
  for (let index = 1; index < endings.length; index += 1) {
    assert.ok(endings[index]! > endings[index - 1]!);
  }
  assert.equal(endings.at(-1), MULTIPLIER_CAP_HZ);
  const wide = planMultiplierRuns([2, 2]).map((run) => lastNote(run));
  const wideGap = wide[1]! - wide[0]!;
  const tightGap = endings[1]! - endings[0]!;
  assert.ok(tightGap < wideGap);
  assert.ok(runs.every((run) => run.every((note) => note.frequency <= MULTIPLIER_CAP_HZ)));
});

test("notes inside a letter keep climbing from the points already counted", () => {
  const notes = letterNotes(3, 5);
  const fromZero = letterNotes(3, 0);
  assert.ok(notes[0]!.frequency > fromZero[2]!.frequency);
});
