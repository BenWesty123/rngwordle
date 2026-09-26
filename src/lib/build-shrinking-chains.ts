/** Longest chain of ENABLE words formed by deleting one letter at a time. */
export function buildShrinkingChains(words: readonly string[]): Record<string, string> {
  const set = new Set(words);
  const byLength = new Map<number, string[]>();
  for (const word of words) {
    const bucket = byLength.get(word.length) ?? [];
    bucket.push(word);
    byLength.set(word.length, bucket);
  }

  const next = new Map<string, string>();
  const chainLength = new Map<string, number>();
  const maxLength = Math.max(0, ...byLength.keys());
  for (let length = 2; length <= maxLength; length += 1) {
    for (const word of byLength.get(length) ?? []) {
      let best = 1;
      let chosen: string | null = null;
      const seen = new Set<string>();
      for (let index = 0; index < word.length; index += 1) {
        const child = word.slice(0, index) + word.slice(index + 1);
        if (seen.has(child) || !set.has(child)) continue;
        seen.add(child);
        const childLength = chainLength.get(child) ?? 1;
        if (1 + childLength > best) {
          best = 1 + childLength;
          chosen = child;
        }
      }
      chainLength.set(word, best);
      if (chosen) next.set(word, chosen);
    }
  }

  const chains: Record<string, string> = {};
  const heads = words.filter((word) => (chainLength.get(word) ?? 1) >= 5).sort();
  for (const word of heads) {
    const steps = [word];
    let cursor = word;
    const guard = new Set<string>([word]);
    while (next.has(cursor)) {
      const child = next.get(cursor);
      if (!child || guard.has(child)) break;
      guard.add(child);
      steps.push(child);
      cursor = child;
    }
    chains[word] = steps.join(" → ");
  }
  return chains;
}
