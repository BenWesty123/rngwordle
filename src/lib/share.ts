import { formatRowValue, type ScoredWord } from "@/lib/tiles";

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

export function buildShareText(input: {
  date: string;
  scored: ScoredWord;
  tierLabel: string;
  beaten: number;
  wordCount: number;
}): string {
  const lines = [
    `RWGdle · ${input.date}`,
    input.scored.word.toUpperCase(),
    `${input.scored.total.toLocaleString("en-US")} · ${input.tierLabel}`,
    formatStanding(input.beaten),
    "",
    ...input.scored.rows.map((row) =>
      row.match ? `${row.name}: ${row.match} ${formatRowValue(row)}` : `${row.name}: ${formatRowValue(row)}`,
    ),
  ];
  return lines.join("\n");
}
