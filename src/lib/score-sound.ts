export type ScoreNote = {
  frequency: number;
  delay: number;
  duration: number;
};

const BASE_HZ = 220;
const MAX_SEMITONES = 36;
export const MULTIPLIER_START_HZ = BASE_HZ;
export const MULTIPLIER_CAP_HZ = 880;
export const MULTIPLIER_FLOOR_HZ = 110;
export const MULTIPLIER_BLIP_CAP = 12;

export function multiplierBlipCount(multiplier: number): number {
  if (multiplier <= 1) return 0;
  return Math.min(MULTIPLIER_BLIP_CAP, Math.max(3, Math.round(multiplier)));
}

export function multiplierNotes(multiplier: number, startHz: number): ScoreNote[] {
  const count = multiplierBlipCount(multiplier);
  const gap = Math.min(0.048, 0.55 / Math.max(count, 1));
  const notes: ScoreNote[] = [];
  for (let index = 0; index < count; index += 1) {
    const raw = startHz * 2 ** ((index * 3) / 12);
    notes.push({
      frequency: Math.min(MULTIPLIER_CAP_HZ, raw),
      delay: index * gap,
      duration: 0.055,
    });
  }
  return notes;
}

export function nextMultiplierStart(startHz: number, notes: ScoreNote[]): number {
  const end = notes[notes.length - 1]?.frequency ?? startHz;
  const hitCap = notes.some((note) => note.frequency >= MULTIPLIER_CAP_HZ - 0.01);
  const drop = hitCap ? 5 : 2;
  const lowered = startHz * 2 ** (-drop / 12);
  return Math.max(MULTIPLIER_FLOOR_HZ, Math.min(lowered, end * 2 ** (-1 / 12)));
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
let multiplierStartHz = MULTIPLIER_START_HZ;

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

export function resetMultiplierPitch(): void {
  multiplierStartHz = MULTIPLIER_START_HZ;
}

export function playLetterPoints(points: number, runningBefore: number): void {
  if (!context || context.state !== "running") return;
  schedule(letterNotes(points, runningBefore), context.currentTime + 0.02);
}

export function playMultiplier(multiplier: number): void {
  if (!context || context.state !== "running") return;
  const notes = multiplierNotes(multiplier, multiplierStartHz);
  multiplierStartHz = nextMultiplierStart(multiplierStartHz, notes);
  schedule(notes, context.currentTime + 0.02);
}
