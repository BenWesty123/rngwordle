let pending: Promise<string[]> | null = null;

export function loadDictionary(): Promise<string[]> {
  if (!pending) {
    pending = fetch("/words.txt")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Dictionary request failed (${response.status})`);
        }
        return response.text();
      })
      .then((text) => {
        const words = text
          .trim()
          .split(/\n/)
          .map((word) => word.trim())
          .filter((word) => /^[a-z]+$/.test(word));
        if (words.length === 0) throw new Error("Dictionary was empty");
        return words;
      })
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

export function randomWord(words: readonly string[]): string {
  if (words.length === 0) throw new Error("Dictionary was empty");
  const span = 0x1_0000_0000;
  const limit = span - (span % words.length);
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0] ?? 0;
  } while (value >= limit);
  return words[value % words.length] ?? words[0]!;
}

/**
 * Dictionary length weights for 4–10 letters (the same counts as scoring's
 * LENGTH_COUNTS). The bag stays inside this band so the row doesn't leap
 * between a 2-letter word and a 20-letter one.
 */
const FLICKER_LENGTH_WEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [4, 3891],
  [5, 8621],
  [6, 15219],
  [7, 23096],
  [8, 28413],
  [9, 24870],
  [10, 20300],
];

const FLICKER_LENGTH_SPAN = FLICKER_LENGTH_WEIGHTS.reduce((sum, [, count]) => sum + count, 0);

/** A length the bag might deal, weighted like the dictionary. */
export function randomFlickerLength(): number {
  let pick = Math.floor(Math.random() * FLICKER_LENGTH_SPAN);
  for (const [length, count] of FLICKER_LENGTH_WEIGHTS) {
    if (pick < count) return length;
    pick -= count;
  }
  return 8;
}

/** Random letters. Omit length to also draw a random dictionary length. */
export function flickerWord(length = randomFlickerLength()): string {
  const glyphs = "abcdefghijklmnopqrstuvwxyz";
  let word = "";
  const size = Math.max(2, length);
  for (let index = 0; index < size; index += 1) {
    word += glyphs[Math.floor(Math.random() * glyphs.length)] ?? "a";
  }
  return word;
}
