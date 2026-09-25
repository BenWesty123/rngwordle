export type ScoreNote = {
  frequency: number;
  delay: number;
  duration: number;
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

function hzAboveFloor(semitones: number): number {
  return MULTIPLIER_FLOOR_HZ * 2 ** (semitones / 12);
}

export function planMultiplierRuns(multipliers: number[]): ScoreNote[][] {
  const hits = multipliers.filter((multiplier) => multiplier > 1);
  const count = hits.length;
  if (count === 0) return [];
  const firstEnd = 12;
  const lastEnd = 36;
  const step = count === 1 ? 0 : (lastEnd - firstEnd) / (count - 1);
  let previousEnd: number | null = null;
  return hits.map((multiplier, index) => {
    const endHz = hzAboveFloor(count === 1 ? lastEnd : firstEnd + step * index);
    const notes = multiplierClimb(multiplier, endHz, previousEnd);
    previousEnd = notes[notes.length - 1]?.frequency ?? endHz;
    return notes;
  });
}

function multiplierClimb(multiplier: number, endHz: number, previousEnd: number | null): ScoreNote[] {
  const count = multiplierBlipCount(multiplier);
  const dipped =
    previousEnd === null ? endHz / 2 : Math.min(previousEnd * 2 ** (-2 / 12), endHz * 2 ** (-4 / 12));
  let startHz = Math.max(MULTIPLIER_FLOOR_HZ, dipped);
  if (startHz >= endHz) startHz = Math.max(MULTIPLIER_FLOOR_HZ, endHz * 2 ** (-1 / 12));
  const gap = Math.min(0.048, 0.55 / Math.max(count, 1));
  const notes: ScoreNote[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 1 : index / (count - 1);
    const frequency = Math.min(MULTIPLIER_CAP_HZ, startHz * (endHz / startHz) ** t);
    notes.push({ frequency, delay: index * gap, duration: 0.055 });
  }
  const last = notes[notes.length - 1];
  if (last) last.frequency = Math.min(MULTIPLIER_CAP_HZ, endHz);
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

function schedule(notes: ScoreNote[], start: number): void {
  if (!context) return;
  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(note.frequency, start + note.delay);
    gain.gain.setValueAtTime(0.0001, start + note.delay);
    gain.gain.exponentialRampToValueAtTime(0.07, start + note.delay + 0.008);
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

export function prepareMultiplierScore(multipliers: number[]): void {
  plannedRuns = planMultiplierRuns(multipliers);
}

export function playLetterPoints(points: number, runningBefore: number): void {
  if (!context || context.state !== "running") return;
  schedule(letterNotes(points, runningBefore), context.currentTime + 0.02);
}

export function playMultiplier(index: number): void {
  if (!context || context.state !== "running") return;
  const notes = plannedRuns[index];
  if (!notes) return;
  schedule(notes, context.currentTime + 0.02);
}
