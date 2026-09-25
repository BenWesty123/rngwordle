export type ScoreNote = {
  frequency: number;
  delay: number;
  duration: number;
};

const BASE_HZ = 220;
const MAX_SEMITONES = 36;

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

export function playLetterPoints(points: number, runningBefore: number): void {
  if (!context || context.state !== "running") return;
  const start = context.currentTime + 0.02;
  for (const note of letterNotes(points, runningBefore)) {
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
