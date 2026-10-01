/**
 * An opaque key for a card, so the collection page can list locked cards
 * without saying which card they are. The browser computes the same key from
 * the ids it has found, to match them up.
 */
export function cardKey(id: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `c${hash.toString(36)}`;
}
