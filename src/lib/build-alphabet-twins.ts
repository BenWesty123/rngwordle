/**
 * Groups ENABLE words that share a set of distinct letters but not the same counts.
 * Anagrams stay in one count bucket and are not partners of each other.
 */
export function buildAlphabetTwins(words: readonly string[]): Record<string, Record<string, string[]>> {
  const groups = new Map<string, Map<string, string[]>>();
  for (const word of words) {
    const letters = [...word];
    const setKey = [...new Set(letters)].sort().join("");
    const countKey = letters.slice().sort().join("");
    let bucket = groups.get(setKey);
    if (!bucket) {
      bucket = new Map();
      groups.set(setKey, bucket);
    }
    const list = bucket.get(countKey);
    if (list) list.push(word);
    else bucket.set(countKey, [word]);
  }

  const result: Record<string, Record<string, string[]>> = {};
  for (const setKey of [...groups.keys()].sort()) {
    const bucket = groups.get(setKey);
    if (!bucket || bucket.size < 2) continue;
    const counts: Record<string, string[]> = {};
    for (const countKey of [...bucket.keys()].sort()) {
      counts[countKey] = (bucket.get(countKey) ?? []).slice().sort();
    }
    result[setKey] = counts;
  }
  return result;
}
