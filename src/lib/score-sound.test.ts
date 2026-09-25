import assert from "node:assert/strict";
import { test } from "node:test";
import {
  letterNotes,
  MULTIPLIER_BLIP_CAP,
  MULTIPLIER_CAP_HZ,
  MULTIPLIER_FLOOR_HZ,
  multiplierBlipCount,
  planMultiplierRuns,
  planRollSound,
} from "./score-sound";
import { scoreWord } from "./scoring";
import { standingFor } from "./standing";

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
  assert.equal(planMultiplierRuns([2], "common")[0]?.length, 3);
  assert.equal(multiplierBlipCount(32), MULTIPLIER_BLIP_CAP);
  assert.equal(multiplierBlipCount(128), MULTIPLIER_BLIP_CAP);
  assert.ok(multiplierBlipCount(32) > multiplierBlipCount(2));
});

function melodyEnds(run: { frequency: number; delay: number }[]): { first: number; last: number } {
  const firstDelay = run[0]?.delay ?? 0;
  const lastDelay = run[run.length - 1]?.delay ?? 0;
  const at = (delay: number) =>
    Math.min(...run.filter((note) => note.delay === delay).map((note) => note.frequency));
  return { first: at(firstDelay), last: at(lastDelay) };
}

function voicesAtEnd(run: { frequency: number; delay: number }[]): number {
  const lastDelay = run[run.length - 1]?.delay ?? 0;
  return run.filter((note) => note.delay === lastDelay).length;
}

test("air ends bright and bookkeeper ends low and thin", () => {
  const air = scoreWord("air");
  const book = scoreWord("bookkeeper");
  assert.equal(standingFor(air.total).tier.id, "epic");
  assert.equal(standingFor(book.total).tier.id, "trash");
  const airHits = air.rows.filter((row) => row.id !== "tiles" && row.scored && (row.points ?? 0) > 1).map((row) => row.points ?? 0);
  const bookHits = book.rows.filter((row) => row.id !== "tiles" && row.scored && (row.points ?? 0) > 1).map((row) => row.points ?? 0);
  const strong = planRollSound(airHits, standingFor(air.total).tier.id);
  const weak = planRollSound(bookHits, standingFor(book.total).tier.id);
  const strongEnds = strong.runs.map((run) => melodyEnds(run).last);
  for (let index = 1; index < strongEnds.length; index += 1) assert.ok(strongEnds[index]! > strongEnds[index - 1]!);
  assert.ok(strong.verdict[0]!.frequency > strongEnds.at(-1)!);
  assert.equal(Math.max(...strong.verdict.map((note) => note.frequency)), MULTIPLIER_CAP_HZ);
  assert.ok(strong.verdict.length >= 3);
  assert.equal(voicesAtEnd(weak.runs[0]!), 1);
  assert.equal(weak.verdict.length, 1);
  assert.ok(weak.verdict[0]!.frequency < 200);
  assert.ok(weak.verdict[0]!.frequency > melodyEnds(weak.runs.at(-1)!).last);
  const lengthRise = (() => {
    const ends = melodyEnds(strong.runs[0]!);
    return 12 * Math.log2(ends.last / ends.first);
  })();
  const nextRise = (() => {
    const ends = melodyEnds(strong.runs[1]!);
    return 12 * Math.log2(ends.last / ends.first);
  })();
  assert.ok(lengthRise > 4 && lengthRise <= 8.01);
  assert.ok(nextRise >= 2 && nextRise <= 4.01);
  for (const note of [...strong.runs.flat(), ...strong.verdict, ...weak.runs.flat(), ...weak.verdict]) {
    assert.ok(note.frequency <= MULTIPLIER_CAP_HZ && note.frequency >= MULTIPLIER_FLOOR_HZ);
  }
});

test("many multipliers compress the ending steps and still climb under the cap", () => {
  const runs = planMultiplierRuns(Array.from({ length: 13 }, () => 2), "mythic");
  const endings = runs.map((run) => melodyEnds(run).last);
  for (let index = 1; index < endings.length; index += 1) {
    assert.ok(endings[index]! > endings[index - 1]!);
  }
  assert.ok(endings.at(-1)! < MULTIPLIER_CAP_HZ);
  const wide = planMultiplierRuns([2, 2], "mythic").map((run) => melodyEnds(run).last);
  const wideGap = wide[1]! - wide[0]!;
  const tightGap = endings[1]! - endings[0]!;
  assert.ok(tightGap < wideGap);
});

test("notes inside a letter keep climbing from the points already counted", () => {
  const notes = letterNotes(3, 5);
  const fromZero = letterNotes(3, 0);
  assert.ok(notes[0]!.frequency > fromZero[2]!.frequency);
});
