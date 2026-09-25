import type { TierId } from "@/lib/tiers";

export type ScoreNote = {
  frequency: number;
  delay: number;
  duration: number;
  gain?: number;
};

export type RollSound = {
  runs: ScoreNote[][];
  verdict: ScoreNote[];
};

const BASE_HZ = 220;
const MAX_SEMITONES = 36;
export const MULTIPLIER_CAP_HZ = 880;
export const MULTIPLIER_FLOOR_HZ = 110;
export const MULTIPLIER_BLIP_CAP = 12;

export function multiplierBlipCount(multiplier: number): number {
  if (multiplier <= 1) return 0;
  return Math.min(MULTIPLIER_BLIP_CAP, Math.max(3, Math.round(multiplier)));
}

export function multiplierRiseSemitones(multiplier: number): number {
  if (multiplier >= 32) return 8;
  if (multiplier >= 12) return 6;
  if (multiplier >= 8) return 4;
  if (multiplier >= 4) return 3;
  return 2;
}

function hzAboveFloor(semitones: number): number {
  return MULTIPLIER_FLOOR_HZ * 2 ** (semitones / 12);
}

function chordIntervals(multiplier: number): number[] {
  if (multiplier <= 4) return [0];
  if (multiplier < 12) return [0, 4];
  if (multiplier < 32) return [0, 4, 7];
  return [0, 4, 7, 12];
}

function verdictShape(tier: TierId): { root: number; intervals: number[] } {
  if (tier === "trash" || tier === "common") return { root: 7, intervals: [0] };
  if (tier === "uncommon" || tier === "rare") return { root: 18, intervals: [0, 4] };
  return { root: 24, intervals: [0, 4, 7, 12] };
}

function fitIntervals(multiplier: number, root: number, nextRoot: number): number[] {
  let intervals = chordIntervals(multiplier);
  while (intervals.length > 1 && root + intervals[intervals.length - 1]! >= nextRoot - 0.05) {
    intervals = intervals.slice(0, -1);
  }
  return intervals;
}

function placeRoots(hits: number[], verdictRoot: number, tier: TierId): { root: number; intervals: number[] }[] {
  const count = hits.length;
  if (count === 0) return [];
  const low = tier === "trash" || tier === "common";
  const mid = tier === "uncommon" || tier === "rare";
  const lastSpan = chordIntervals(hits[count - 1] ?? 2).at(-1) ?? 0;
  const lastRoot = Math.max(2, verdictRoot - lastSpan - 0.45);
  if (count === 1) return [{ root: lastRoot, intervals: fitIntervals(hits[0] ?? 2, lastRoot, verdictRoot) }];
  let first = lastRoot;
  if (low) first = Math.max(2, lastRoot - 1.15 * (count - 1));
  else if (mid) first = Math.max(4, lastRoot - 2.4 * (count - 1));
  else first = Math.min(Math.max(3, multiplierRiseSemitones(hits[0] ?? 2) - 1), lastRoot - 0.5);
  const step = (lastRoot - first) / (count - 1);
  const roots = Array.from({ length: count }, (_, index) => (index === count - 1 ? lastRoot : first + step * index));
  return roots.map((root, index) => {
    const next = index === count - 1 ? verdictRoot : roots[index + 1]!;
    return { root, intervals: fitIntervals(hits[index] ?? 2, root, next) };
  });
}

export function planRollSound(multipliers: number[], tier: TierId): RollSound {
  const hits = multipliers.filter((multiplier) => multiplier > 1);
  const verdict = verdictShape(tier);
  const placed = placeRoots(hits, verdict.root, tier);
  return {
    runs: placed.map((slot, index) => multiplierClimb(hits[index] ?? 2, slot.root, slot.intervals)),
    verdict: chordHit(verdict.root, verdict.intervals, 0, 0.24),
  };
}

export function planMultiplierRuns(multipliers: number[], tier: TierId = "common"): ScoreNote[][] {
  return planRollSound(multipliers, tier).runs;
}

function voiceGain(intervals: number[], interval: number): number {
  if (intervals.length === 1) return 0.07;
  return interval === 0 ? 0.09 : 0.042;
}

function chordHit(rootSemis: number, intervals: number[], delay: number, duration: number): ScoreNote[] {
  return intervals
    .map((interval) => ({
      frequency: Math.min(MULTIPLIER_CAP_HZ, hzAboveFloor(rootSemis + interval)),
      delay,
      duration,
      gain: voiceGain(intervals, interval),
    }))
    .filter((note) => note.frequency <= MULTIPLIER_CAP_HZ + 0.01);
}

function multiplierClimb(multiplier: number, endSemis: number, intervals: number[]): ScoreNote[] {
  const count = multiplierBlipCount(multiplier);
  const rise = multiplierRiseSemitones(multiplier);
  const endHz = hzAboveFloor(endSemis);
  const startHz = Math.max(MULTIPLIER_FLOOR_HZ, endHz * 2 ** (-rise / 12));
  const gap = Math.min(0.048, 0.55 / Math.max(count, 1));
  const notes: ScoreNote[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 1 : index / (count - 1);
    const melody = Math.min(MULTIPLIER_CAP_HZ, startHz * (endHz / startHz) ** t);
    const semis = 12 * Math.log2(melody / MULTIPLIER_FLOOR_HZ);
    notes.push(...chordHit(semis, intervals, index * gap, 0.055));
  }
  return notes;
}

export function letterNotes(points: number, runningBefore: number): ScoreNote[] {
  if (points < 1) return [];
  const gap = Math.min(0.07, 0.28 / points);
  const notes: ScoreNote[] = [];
  for (let index = 0; index < points; index += 1) {
    const step = Math.min(MAX_SEMITONES, runningBefore + index);
    notes.push({
      frequency: BASE_HZ * 2 ** (step / 12),
      delay: index * gap,
      duration: 0.055,
    });
  }
  return notes;
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;
let active: OscillatorNode[] = [];
let plannedRuns: ScoreNote[][] = [];
let plannedVerdict: ScoreNote[] = [];

function schedule(notes: ScoreNote[], start: number): void {
  if (!context) return;
  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(note.frequency, start + note.delay);
    gain.gain.setValueAtTime(0.0001, start + note.delay);
    gain.gain.exponentialRampToValueAtTime(note.gain ?? 0.07, start + note.delay + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.delay + note.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start + note.delay);
    oscillator.stop(start + note.delay + note.duration + 0.02);
    active.push(oscillator);
    oscillator.onended = () => {
      active = active.filter((node) => node !== oscillator);
    };
  }
}

export function armScoreAudio(): void {
  const Ctx = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!Ctx) return;
  if (!context) context = new Ctx();
  if (context.state === "suspended") void context.resume();
}

export function stopScoreAudio(): void {
  for (const oscillator of active) {
    try {
      oscillator.stop();
    } catch {
      // Already stopped.
    }
  }
  active = [];
}

export function prepareMultiplierScore(multipliers: number[], tier: TierId): void {
  const plan = planRollSound(multipliers, tier);
  plannedRuns = plan.runs;
  plannedVerdict = plan.verdict;
}

export function playLetterPoints(points: number, runningBefore: number): void {
  if (!context || context.state !== "running") return;
  schedule(letterNotes(points, runningBefore), context.currentTime + 0.02);
}

export function playVerdict(): void {
  if (!context || context.state !== "running" || plannedVerdict.length === 0) return;
  schedule(plannedVerdict, context.currentTime + 0.02);
}

export function playMultiplier(index: number): void {
  if (!context || context.state !== "running") return;
  const notes = plannedRuns[index];
  if (!notes) return;
  const start = context.currentTime + 0.02;
  schedule(notes, start);
  if (index !== plannedRuns.length - 1) return;
  const tail = notes.reduce((max, note) => Math.max(max, note.delay + note.duration), 0);
  schedule(plannedVerdict, start + tail + 0.12);
}
