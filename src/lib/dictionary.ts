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

export function flickerWord(length: number): string {
  const glyphs = "abcdefghijklmnopqrstuvwxyz";
  let word = "";
  const size = Math.max(2, length);
  for (let index = 0; index < size; index += 1) {
    word += glyphs[Math.floor(Math.random() * glyphs.length)] ?? "a";
  }
  return word;
}
