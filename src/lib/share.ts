import type { ScoredWord } from "@/lib/tiles";

export function formatBeaten(beaten: number): string {
  const rounded = Math.round(beaten * 1000) / 10;
  if (rounded >= 100 && beaten < 1) return "99.9%";
  if (rounded <= 0 && beaten > 0) return "0.1%";
  return `${rounded.toFixed(1)}%`;
}

export function formatStanding(beaten: number): string {
  const rounded = Math.round(beaten * 1000) / 10;
  const shown = rounded >= 100 && beaten < 1 ? 99.9 : rounded <= 0 && beaten > 0 ? 0.1 : rounded;
  return `${shown >= 50 ? "Top" : "Bottom"} ${formatBeaten(beaten)}`;
}

export type ShareCard = { name: string; points: number };

/** A roll's best cards, highest multiplier first. Repeats like Inside merge into one card. */
export function topCards(scored: ScoredWord, limit = 3): ShareCard[] {
  const merged = new Map<string, ShareCard>();
  for (const row of scored.rows) {
    if (!row.scored || row.id === "tiles" || row.points == null || row.points <= 1) continue;
    const entry = merged.get(row.id);
    if (entry) entry.points *= row.points;
    else merged.set(row.id, { name: row.name.replace(/ ×\d+$/, ""), points: row.points });
  }
  return [...merged.values()].sort((left, right) => right.points - left.points).slice(0, limit);
}

/** The page a shared roll opens on: rwgdle.app/s/<word>. */
export function shareLink(origin: string, word: string): string {
  return `${origin}/s/${encodeURIComponent(word.toLowerCase())}`;
}

/** What a player sends a friend: the word, the score, the best cards, and a link to try it. */
export function buildShareMessage(input: {
  word: string;
  total: number;
  tierLabel: string;
  beaten: number;
  cards: ShareCard[];
  link: string;
}): { text: string; withoutLink: string } {
  const lines = [
    `🎲 My RWGdle word of the day is ${input.word.toUpperCase()}, for ${input.total.toLocaleString("en-US")} points!`,
    `🏆 ${input.tierLabel} · ${formatStanding(input.beaten)}`,
  ];
  if (input.cards.length > 0) {
    lines.push(`🃏 ${input.cards.map((card) => `${card.name} ×${card.points.toLocaleString("en-US")}`).join(" · ")}`);
  }
  lines.push("Can you do better?");
  const withoutLink = lines.join("\n");
  return { text: `${withoutLink} 👉 ${input.link}`, withoutLink };
}
