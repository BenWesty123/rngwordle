"use client";

import { useSyncExternalStore } from "react";
import type { ScoredWord } from "@/lib/tiles";

/**
 * Cards found in this browser: card id → the first word that earned it.
 * Guests have only this. Logged-in players also get every card from their saved rolls.
 */
const KEY = "rwgdle.cards.v1";

export type FoundCards = Record<string, string>;

const listeners = new Set<() => void>();
let snapshot: string | null = null;

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string {
  const next = read();
  if (next !== snapshot) snapshot = next;
  return snapshot;
}

export function parseFound(text: string): FoundCards {
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

/** Cards this roll scored that this browser has never seen. Call before rememberCards. */
export function unseenCards(scored: ScoredWord): string[] {
  const found = parseFound(read());
  return [...new Set(scored.rows.filter((row) => row.scored && row.id !== "tiles" && !found[row.id]).map((row) => row.id))];
}

/** Remember every card this roll scored. Earlier finds keep their first word. */
export function rememberCards(scored: ScoredWord): void {
  const found = parseFound(read());
  let changed = false;
  for (const row of scored.rows) {
    if (!row.scored || row.id === "tiles" || found[row.id]) continue;
    found[row.id] = scored.word;
    changed = true;
  }
  if (!changed) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(found));
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}

export function useLocalCards(): FoundCards {
  const text = useSyncExternalStore(subscribe, getSnapshot, () => "{}");
  return parseFound(text);
}
