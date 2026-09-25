export function plainDefinition(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  const stop = text.search(/[.!?](?:\s|$)/);
  const sentence = stop === -1 ? text : text.slice(0, stop + 1);
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}…` : sentence;
}

export async function fetchRemoteDefinition(word: string): Promise<string | null> {
  const response = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
  if (!response.ok) return null;
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("en" in body)) return null;
  const english = (body as { en?: unknown }).en;
  if (!Array.isArray(english)) return null;
  const labeled = english.filter(
    (sense) => !!sense && typeof sense === "object" && (sense as { language?: unknown }).language === "English",
  );
  const senses = labeled.length > 0 ? labeled : english;
  for (const sense of senses) {
    if (!sense || typeof sense !== "object" || !("definitions" in sense)) continue;
    const definitions = (sense as { definitions?: unknown }).definitions;
    if (!Array.isArray(definitions)) continue;
    for (const entry of definitions) {
      if (!entry || typeof entry !== "object" || !("definition" in entry)) continue;
      const definition = (entry as { definition?: unknown }).definition;
      if (typeof definition !== "string") continue;
      const plain = plainDefinition(definition);
      if (plain.length >= 4) return plain;
    }
  }
  return null;
}
