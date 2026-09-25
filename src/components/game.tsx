"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchRemoteDefinition } from "@/lib/definition";
import { utcDateKey } from "@/lib/day";
import { flickerWord, loadDictionary, randomWord } from "@/lib/dictionary";
import { armScoreAudio, playLetterPoints, playMultiplier, playVerdict, prepareMultiplierScore, stopScoreAudio } from "@/lib/score-sound";
import { formatRowValue, scoreWord, type LedgerRow } from "@/lib/scoring";
import { buildShareText, formatBeaten } from "@/lib/share";
import { standingFor } from "@/lib/standing";
import {
  parseRoll,
  readRollSnapshot,
  serverRollSnapshot,
  subscribeRoll,
  writeRoll,
  type StoredRoll,
} from "@/lib/storage";
import type { TierId } from "@/lib/tiers";
import { cn } from "@/lib/utils";

const TIER_STYLE: Record<TierId, { badge: string; glow: string }> = {
  trash: {
    badge: "border-stone-400/30 bg-stone-400/10 text-stone-300",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(168,162,158,0.16),transparent_58%)]",
  },
  common: {
    badge: "border-zinc-300/25 bg-zinc-300/10 text-zinc-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(212,212,216,0.12),transparent_58%)]",
  },
  uncommon: {
    badge: "border-emerald-300/35 bg-emerald-300/10 text-emerald-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(110,231,183,0.16),transparent_58%)]",
  },
  rare: {
    badge: "border-sky-300/40 bg-sky-300/10 text-sky-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(125,211,252,0.18),transparent_58%)]",
  },
  epic: {
    badge: "border-violet-300/40 bg-violet-300/10 text-violet-200",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(196,181,253,0.2),transparent_60%)]",
  },
  mythic: {
    badge: "border-amber-200/50 bg-amber-200/15 text-amber-100",
    glow: "bg-[radial-gradient(ellipse_at_top,rgba(252,211,77,0.26),transparent_62%)]",
  },
};

export function Game() {
  const [dictionary, setDictionary] = useState<string[] | null>(null);
  const [dictionaryError, setDictionaryError] = useState<string | null>(null);
  const [dictionaryAttempt, setDictionaryAttempt] = useState(0);
  const [spinWord, setSpinWord] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const spinTimer = useRef<number | null>(null);
  const snapshot = useSyncExternalStore(subscribeRoll, readRollSnapshot, serverRollSnapshot);
  const roll = snapshot ? parseRoll(snapshot) : null;

  useEffect(() => {
    let cancelled = false;
    loadDictionary().then(
      (words) => {
        if (!cancelled) setDictionary(words);
      },
      () => {
        if (!cancelled) setDictionaryError("The word list didn't load.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [dictionaryAttempt]);

  useEffect(() => {
    return () => {
      if (spinTimer.current !== null) window.clearInterval(spinTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  function onGenerate() {
    armScoreAudio();
    if (!dictionary || spinTimer.current !== null) return;
    const word = randomWord(dictionary);
    const next = { date: utcDateKey(), word };
    writeRoll(next);
    setCopied(false);
    setCopyError(false);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    setSpinWord(flickerWord(word.length));
    let frame = 0;
    spinTimer.current = window.setInterval(() => {
      frame += 1;
      if (frame >= 14) {
        if (spinTimer.current !== null) window.clearInterval(spinTimer.current);
        spinTimer.current = null;
        setSpinWord(null);
        return;
      }
      setSpinWord(flickerWord(word.length));
    }, 45);
  }

  async function onCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyError(false);
      return;
    } catch {
      // Some browsers only allow the older selection copy.
    }
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const copiedText = document.execCommand("copy");
      area.remove();
      if (copiedText) {
        setCopied(true);
        setCopyError(false);
        return;
      }
    } catch {
      // The share text stays on screen for a manual copy.
    }
    setCopied(false);
    setCopyError(true);
  }

  const scored = roll ? scoreWord(roll.word) : null;
  const standing = scored ? standingFor(scored.total) : null;
  const glow = EMPTY_GLOW;

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-[28rem]", glow)} />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
        <header>
          <p className="text-[11px] tracking-[0.32em] text-muted-foreground uppercase">RNGWorlde</p>
        </header>

        {roll && scored && standing ? (
          <Result
            roll={roll}
            scored={scored}
            standing={standing}
            spinWord={spinWord}
            dictionaryReady={dictionary !== null}
            onGenerate={onGenerate}
            copied={copied}
            copyError={copyError}
            onCopy={onCopy}
          />
        ) : (
          <EmptyState
            dictionary={dictionary}
            dictionaryError={dictionaryError}
            onGenerate={onGenerate}
            onRetry={() => {
              setDictionaryError(null);
              setDictionaryAttempt((attempt) => attempt + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}

const EMPTY_GLOW = "bg-[radial-gradient(ellipse_at_top,rgba(240,226,200,0.12),transparent_55%)]";

function EmptyState({
  dictionary,
  dictionaryError,
  onGenerate,
  onRetry,
}: {
  dictionary: string[] | null;
  dictionaryError: string | null;
  onGenerate: () => void;
  onRetry: () => void;
}) {
  const wordCount = dictionary?.length;
  return (
    <div className="flex flex-1 flex-col justify-center py-16">
      <h1 className="max-w-md font-display text-5xl leading-[0.95] tracking-tight text-balance italic sm:text-6xl">
        Draw a word.
      </h1>
      <p className="mt-6 max-w-md text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
        Generate deals this browser a random English word. It is not the world’s word. It is yours.
        The score, and the reasons for it, are the whole game. Roll again whenever you want.
      </p>
      {dictionaryError ? (
        <div className="mt-8 max-w-md" role="alert">
          <p className="text-sm text-foreground">{dictionaryError}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The list lives with the app. Reload it and deal when you’re ready.
          </p>
          <Button type="button" className="mt-5 h-12 w-full text-base sm:h-14" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          className="mt-8 h-12 w-full text-base sm:h-14"
          disabled={!dictionary}
          onClick={onGenerate}
        >
          {dictionary ? "Generate" : "Opening the dictionary…"}
        </Button>
      )}
      <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
        {wordCount
          ? `${wordCount.toLocaleString("en-US")} words in the pot. `
          : "A full dictionary is in the pot. "}
        Guest only. The latest word stays in this browser until you roll again.
      </p>
    </div>
  );
}

function Result({
  roll,
  scored,
  standing,
  spinWord,
  dictionaryReady,
  onGenerate,
  copied,
  copyError,
  onCopy,
}: {
  roll: StoredRoll;
  scored: ReturnType<typeof scoreWord>;
  standing: ReturnType<typeof standingFor>;
  spinWord: string | null;
  dictionaryReady: boolean;
  onGenerate: () => void;
  copied: boolean;
  copyError: boolean;
  onCopy: (text: string) => void;
}) {
  const spinning = spinWord !== null;
  const shown = spinWord ?? scored.word;
  const share = buildShareText({
    date: roll.date,
    scored,
    tierLabel: standing.tier.label,
    beaten: standing.beaten,
    wordCount: standing.wordCount,
  });

  return (
    <div className="flex flex-1 flex-col pt-12 sm:pt-16">
      <p className="text-center text-sm text-muted-foreground">
        {spinning ? "Shuffling the tiles…" : "Your word"}
      </p>
      {spinning ? (
        <p
          aria-hidden
          className={cn(
            "mt-4 text-center font-display leading-none tracking-tight break-all italic",
            wordSize(shown.length),
          )}
        >
          {shown}
        </p>
      ) : (
        <h1
          className={cn(
            "mt-4 text-center font-display leading-none tracking-tight break-all italic",
            wordSize(shown.length),
          )}
        >
          {shown}
        </h1>
      )}

      {!spinning ? (
        <WordDefinition
          word={scored.word}
          saved={roll.definition}
          onSave={(definition) => {
            if (roll.word !== scored.word || roll.definition !== undefined) return;
            writeRoll({ ...roll, definition });
          }}
        />
      ) : null}

      {!spinning ? (
        <>
          <ScoreReveal
            key={scored.word}
            scored={scored}
            dictionaryReady={dictionaryReady}
            onGenerate={onGenerate}
            share={share}
            copied={copied}
            copyError={copyError}
            onCopy={onCopy}
          />
        </>
      ) : null}
    </div>
  );
}

function WordDefinition({
  word,
  saved,
  onSave,
}: {
  word: string;
  saved: string | null | undefined;
  onSave: (definition: string | null) => void;
}) {
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  useEffect(() => {
    if (saved !== undefined) return;
    let cancel = false;
    fetchRemoteDefinition(word)
      .then((gloss) => {
        if (!cancel) onSaveRef.current(gloss);
      })
      .catch(() => {
        if (!cancel) onSaveRef.current(null);
      });
    return () => {
      cancel = true;
    };
  }, [saved, word]);

  const gloss = saved;
  if (gloss === undefined) return null;
  return (
    <p className="mx-auto mt-4 max-w-md text-center text-sm text-pretty text-muted-foreground">
      {gloss ?? "No definition on file"}
    </p>
  );
}

function ScoreReveal({
  scored,
  dictionaryReady,
  onGenerate,
  share,
  copied,
  copyError,
  onCopy,
}: {
  scored: ReturnType<typeof scoreWord>;
  dictionaryReady: boolean;
  onGenerate: () => void;
  share: string;
  copied: boolean;
  copyError: boolean;
  onCopy: (text: string) => void;
}) {
  const steps = scored.rows.filter((row) => row.id !== "tiles" && row.scored && (row.points ?? 0) > 1);
  const stepsRef = useRef(steps);
  const tilesRef = useRef(scored.tiles);
  const [letters, setLetters] = useState(0);
  const [applied, setApplied] = useState(0);
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const timer = useRef<number | null>(null);
  const baseDone = letters >= scored.tiles.length;
  const done = baseDone && applied >= steps.length;
  const tileTarget = scored.tiles.slice(0, letters).reduce((sum, tile) => sum + tile.value, 0);
  const target = baseDone ? runningTotal(scored.tileSum, steps, applied) : tileTarget;
  const live = standingFor(target);
  const tone = TIER_STYLE[live.tier.id];
  const visibleRows = done ? scored.rows : [scored.rows[0]!, ...steps.slice(0, applied)];

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const id = window.setTimeout(() => {
        setLetters(tilesRef.current.length);
        setApplied(steps.length);
      }, 0);
      return () => window.clearTimeout(id);
    }
    const heard = { current: 0 };
    const id = window.setInterval(() => {
      const current = heard.current;
      if (current >= tilesRef.current.length) {
        window.clearInterval(id);
        return;
      }
      const tiles = tilesRef.current;
      const tile = tiles[current];
      const runningBefore = tiles.slice(0, current).reduce((sum, item) => sum + item.value, 0);
      if (tile) playLetterPoints(tile.value, runningBefore);
      heard.current = current + 1;
      setLetters(heard.current);
      if (heard.current >= tiles.length) window.clearInterval(id);
    }, 460);
    timer.current = id;
    return () => {
      window.clearInterval(id);
      stopScoreAudio();
    };
  }, [scored.tiles.length, steps.length]);

  useEffect(() => {
    if (!baseDone) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const tier = standingFor(scored.total).tier.id;
    prepareMultiplierScore(
      stepsRef.current.map((step) => step.points ?? 0),
      tier,
    );
    if (steps.length === 0) {
      playVerdict();
      return;
    }
    const heard = { current: 0 };
    const id = window.setInterval(() => {
      const pending = stepsRef.current;
      const current = heard.current;
      if (current >= pending.length) {
        window.clearInterval(id);
        return;
      }
      playMultiplier(current);
      heard.current = current + 1;
      setApplied(heard.current);
      if (heard.current >= pending.length) window.clearInterval(id);
    }, 1450);
    timer.current = id;
    return () => window.clearInterval(id);
  }, [baseDone, scored.total, steps.length]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      displayRef.current = target;
      const id = window.setTimeout(() => setDisplay(target), 0);
      return () => window.clearTimeout(id);
    }
    const from = displayRef.current;
    if (from === target) return;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (start === 0) start = now;
      const t = Math.min(1, (now - start) / (baseDone ? 700 : 280));
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (target - from) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, baseDone]);

  function skip() {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    stopScoreAudio();
    setLetters(scored.tiles.length);
    setApplied(steps.length);
  }

  const previous = runningTotal(scored.tileSum, steps, Math.max(0, applied - 1));
  const currentStep = baseDone && applied > 0 ? steps[applied - 1] : null;
  const addedTile = applied === 0 && letters > 0 ? scored.tiles[letters - 1] : null;

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-[28rem] transition-opacity duration-700",
          tone.glow,
        )}
      />
      <ul className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label="Scrabble tiles">
        {scored.tiles.map((tile, index) => (
          <li
            key={`${tile.letter}-${index}`}
            className={cn(
              "relative flex items-center justify-center rounded-[4px] border bg-card font-display uppercase transition-opacity duration-300",
              scored.length > 16 ? "h-8 w-7 text-sm" : "h-11 w-9 text-lg sm:h-12 sm:w-10",
              tile.rare ? "border-amber-200/70 text-amber-100" : "border-foreground/15 text-foreground",
              tile.twin && "ring-1 ring-foreground/30 ring-inset",
              index >= letters && "opacity-30",
              index === letters - 1 && applied === 0 && "score-rise ring-1 ring-amber-200/80",
            )}
            title={tile.rare ? "Rare letter" : tile.twin ? "Double letter" : undefined}
          >
            {tile.letter}
            <span className="absolute top-0.5 right-1 font-mono text-[9px] text-muted-foreground">{tile.value}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 text-center">
        <p className="sr-only">Score</p>
        <p key={`${letters}-${applied}`} className={cn("score-rise font-mono tabular-nums", scoreSize(display))}>
          {display.toLocaleString("en-US")}
        </p>
        <p className="mt-3 text-sm text-foreground" aria-live="polite">
          {currentStep
            ? currentStep.match
              ? `${currentStep.match} · ${currentStep.name}`
              : currentStep.name
            : addedTile
              ? `${addedTile.letter.toUpperCase()} adds ${addedTile.value}`
              : "Scrabble tiles"}
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
          {currentStep
            ? `${previous.toLocaleString("en-US")} × ${currentStep.points} = ${target.toLocaleString("en-US")}`
            : baseDone
              ? "The base, before any multiplier."
              : "Adding the letter scores."}
        </p>
        <p
          className={cn(
            "mt-4 inline-flex rounded-full border px-3 py-1 text-[11px] tracking-[0.22em] uppercase",
            tone.badge,
          )}
        >
          {live.tier.label}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Beats {formatBeaten(live.beaten)} of {live.wordCount.toLocaleString("en-US")} words
        </p>
        <p className="mt-2 text-sm text-foreground/90">{live.tier.blurb}</p>
        {!done ? (
          <Button type="button" variant="outline" className="mt-5 h-8" onClick={skip}>
            Skip
          </Button>
        ) : null}
        <Button
          type="button"
          className="mt-8 h-12 w-full text-base sm:h-14"
          disabled={!dictionaryReady}
          onClick={onGenerate}
        >
          {dictionaryReady ? "Generate again" : "Opening the dictionary…"}
        </Button>
      </div>

      <section className="mt-10" aria-label="Score breakdown">
        <h2 className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Breakdown</h2>
        <ul className="mt-2 divide-y divide-border">
          {breakdownItems(visibleRows).map((item) =>
            item.kind === "inside" ? (
              <li
                key={`inside-${item.rows[0]?.index}`}
                className={cn(
                  "flex items-baseline justify-between gap-4 py-3",
                  !done && item.rows.at(-1)?.index === visibleRows.length - 1 && "row-in",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="mr-2 inline-block size-1.5 translate-y-[-1px] rounded-full bg-amber-200 align-middle" />
                    {item.rows[0]?.row.name}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Words inside">
                    {item.rows.map(({ row, index }) => (
                      <li
                        key={index}
                        className={cn(
                          "rounded-full border border-foreground/15 bg-card px-2 py-0.5 font-mono text-xs text-foreground",
                          !done && index === visibleRows.length - 1 && "ring-1 ring-amber-200/80",
                        )}
                      >
                        {row.match}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="max-w-[7.5rem] shrink-0 text-right font-mono text-sm leading-relaxed text-foreground tabular-nums">
                  {item.rows.map(({ row }) => formatPoints(row)).join(" ")}
                </p>
              </li>
            ) : (
              <li
                key={`${item.row.id}-${item.index}`}
                className={cn(
                  "flex items-baseline justify-between gap-4 py-3",
                  !done && item.index === visibleRows.length - 1 && item.row.id !== "tiles" && "row-in",
                )}
              >
                <div className="min-w-0">
                  <p className={cn("text-sm", item.row.scored ? "text-foreground" : "text-muted-foreground")}>
                    {item.row.scored && item.row.id !== "tiles" ? (
                      <span className="mr-2 inline-block size-1.5 translate-y-[-1px] rounded-full bg-amber-200 align-middle" />
                    ) : null}
                    {item.row.name}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-pretty text-muted-foreground">{item.row.detail}</p>
                </div>
                <p
                  className={cn(
                    "shrink-0 font-mono text-sm tabular-nums",
                    item.row.scored ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.row.id === "tiles" && !baseDone ? tileTarget.toLocaleString("en-US") : formatPoints(item.row)}
                </p>
              </li>
            ),
          )}
        </ul>
        <div className="flex items-baseline justify-between border-t border-foreground/20 pt-3">
          <p className="text-sm">{done ? "Total" : "So far"}</p>
          <p className="font-mono text-lg tabular-nums">{target.toLocaleString("en-US")}</p>
        </div>
        {!done ? (
          <p className="mt-3 text-xs text-muted-foreground">The misses stay folded until the last multiplier lands.</p>
        ) : null}
      </section>

      {done ? (
        <section className="row-in mt-10" aria-label="Share">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Share</h2>
            <Button type="button" variant="outline" className="h-8" onClick={() => onCopy(share)}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {copyError ? (
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              Clipboard blocked. Select the text below and copy it yourself.
            </p>
          ) : null}
          <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-card px-3 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/90">
            {share}
          </pre>
        </section>
      ) : null}
    </>
  );
}

type BreakdownItem =
  | { kind: "row"; row: LedgerRow; index: number }
  | { kind: "inside"; rows: { row: LedgerRow; index: number }[] };

function breakdownItems(rows: LedgerRow[]): BreakdownItem[] {
  const items: BreakdownItem[] = [];
  rows.forEach((row, index) => {
    if (row.id === "inside" && row.scored && row.match) {
      const last = items.at(-1);
      if (last?.kind === "inside") last.rows.push({ row, index });
      else items.push({ kind: "inside", rows: [{ row, index }] });
      return;
    }
    items.push({ kind: "row", row, index });
  });
  return items;
}

function runningTotal(tileSum: number, steps: LedgerRow[], count: number): number {
  let total = tileSum;
  for (let index = 0; index < count; index += 1) total *= steps[index]?.points ?? 1;
  return total;
}

function formatPoints(row: LedgerRow): string {
  return formatRowValue(row);
}

function scoreSize(total: number): string {
  const digits = String(total).length;
  if (digits <= 3) return "text-5xl sm:text-6xl";
  if (digits <= 5) return "text-4xl sm:text-5xl";
  return "text-3xl sm:text-4xl";
}

function wordSize(length: number): string {
  if (length <= 6) return "text-6xl sm:text-8xl";
  if (length <= 10) return "text-5xl sm:text-7xl";
  if (length <= 14) return "text-4xl sm:text-6xl";
  if (length <= 18) return "text-3xl sm:text-5xl";
  return "text-2xl break-all sm:text-4xl";
}
