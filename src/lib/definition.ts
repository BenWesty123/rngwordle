import bundledGlosses from "@/data/definitions.json";

const glosses = Object.assign(Object.create(null), bundledGlosses) as Record<string, string | undefined>;

export function definitionFor(word: string): string | null {
  const gloss = glosses[word.toLowerCase()];
  return typeof gloss === "string" ? gloss : null;
}

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
