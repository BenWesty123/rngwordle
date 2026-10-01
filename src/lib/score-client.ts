"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SCORING_VERSION } from "@/lib/standing";
import type { ScoredWord } from "@/lib/tiles";

/**
 * Breakdowns come from /api/score, so the browser never downloads the word data.
 * A roll's response primes the cache, so a fresh roll shows without a second request.
 */
const cache = new Map<string, ScoredWord | "error">();
const pending = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(word: string) {
  if (cache.has(word) || pending.has(word)) return;
  pending.add(word);
  fetch(`/api/score?word=${encodeURIComponent(word)}&v=${SCORING_VERSION}`)
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error("missing"))))
    .then((body: { scored?: ScoredWord }) => {
      if (!body.scored) throw new Error("missing");
      cache.set(word, body.scored);
    })
    .catch(() => {
      cache.set(word, "error");
    })
    .finally(() => {
      pending.delete(word);
      emit();
    });
}

export function primeScore(scored: ScoredWord) {
  cache.set(scored.word, scored);
  emit();
}

export function retryScore(word: string) {
  if (cache.get(word) !== "error") return;
  cache.delete(word);
  emit();
  load(word);
}

/** undefined while loading, "error" when the request failed. */
export function useScored(word: string | null): ScoredWord | "error" | undefined {
  const value = useSyncExternalStore(
    subscribe,
    () => (word ? cache.get(word) : undefined),
    () => undefined,
  );
  useEffect(() => {
    if (word) load(word);
  }, [word]);
  return value;
}
