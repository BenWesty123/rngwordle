const STORAGE_KEY = "rngworlde.roll.v1";
const SERVER_SNAPSHOT = "";

const listeners = new Set<() => void>();

export type StoredRoll = {
  date: string;
  word: string;
};

function emit(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY) emit();
}

export function subscribeRoll(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function readRollSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? SERVER_SNAPSHOT;
  } catch {
    return SERVER_SNAPSHOT;
  }
}

export function serverRollSnapshot(): string {
  return SERVER_SNAPSHOT;
}

export function parseRoll(snapshot: string): StoredRoll | null {
  if (!snapshot) return null;
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as { date?: unknown; word?: unknown };
    if (typeof record.date !== "string" || typeof record.word !== "string") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return null;
    if (!/^[a-z]+$/.test(record.word)) return null;
    return { date: record.date, word: record.word };
  } catch {
    return null;
  }
}

export function writeRoll(roll: StoredRoll): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roll));
  emit();
}
