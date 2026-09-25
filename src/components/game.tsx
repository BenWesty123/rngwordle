"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchRemoteDefinition } from "@/lib/definition";
import { utcDateKey } from "@/lib/day";
import { flickerWord, loadDictionary, randomWord } from "@/lib/dictionary";
import { armScoreAudio, playLetterPoints, playMultiplier, playVerdict, prepareMultiplierScore, stopScoreAudio } from "@/lib/score-sound";
import { scoreWord, type LedgerRow } from "@/lib/scoring";
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
        <header className="flex items-center justify-between gap-4">
          <p className="text-[11px] tracking-[0.32em] text-muted-foreground uppercase">RNGWorlde</p>
          {roll && scored && standing ? (
            <Button
              type="button"
              className="h-9 shrink-0"
              disabled={!dictionary || spinWord !== null}
              onClick={onGenerate}
            >
              {dictionary ? "Generate again" : "Opening the dictionary…"}
            </Button>
          ) : null}
        </header>

        {roll && scored && standing ? (
          <Result
            roll={roll}
            scored={scored}
            standing={standing}
            spinWord={spinWord}
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
  copied,
  copyError,
  onCopy,
}: {
  roll: StoredRoll;
  scored: ReturnType<typeof scoreWord>;
  standing: ReturnType<typeof standingFor>;
  spinWord: string | null;
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
  share,
  copied,
  copyError,
  onCopy,
}: {
  scored: ReturnType<typeof scoreWord>;
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
  const [settled, setSettled] = useState(0);
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const timer = useRef<number | null>(null);
  const baseDone = letters >= scored.tiles.length;
  const done = baseDone && settled >= steps.length;
  const tileTarget = scored.tiles.slice(0, letters).reduce((sum, tile) => sum + tile.value, 0);
  const target = baseDone ? runningTotal(scored.tileSum, steps, applied) : tileTarget;
  const live = standingFor(target);
  const tone = TIER_STYLE[live.tier.id];
  const activeStep = baseDone && applied > settled ? (steps[applied - 1] ?? null) : null;
  const stacked = steps.slice(0, settled);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const id = window.setTimeout(() => {
        setLetters(tilesRef.current.length);
        setApplied(steps.length);
        setSettled(steps.length);
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
      if (current < pending.length) {
        playMultiplier(current);
        heard.current = current + 1;
        setApplied(heard.current);
        setSettled(current);
        return;
      }
      setSettled(pending.length);
      window.clearInterval(id);
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
    setSettled(steps.length);
  }

  const previous = runningTotal(scored.tileSum, steps, Math.max(0, applied - 1));
  const currentStep = activeStep;
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
            ? currentStep.name
            : addedTile
              ? `${addedTile.letter.toUpperCase()} adds ${addedTile.value}`
              : done
                ? steps.length > 0
                  ? "Every multiplier that hit"
                  : "No multiplier hit"
                : baseDone
                  ? "The base, before any multiplier."
                  : "Scrabble tiles"}
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
          {currentStep
            ? `${previous.toLocaleString("en-US")} × ${currentStep.points} = ${target.toLocaleString("en-US")}`
            : done
              ? ""
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
      </div>

      {baseDone ? (
        <section className="mt-8" aria-label="Multipliers">
          {activeStep ? (
            <MultiplierCard key={`active-${applied}`} word={scored.word} row={activeStep} featured />
          ) : null}
          {stacked.length > 0 ? (
            <ol className={cn("flex flex-col gap-2", activeStep && "mt-3")}>
              {stacked.map((row, index) => (
                <li key={`${row.id}-${index}`} className="card-drop">
                  <MultiplierCard word={scored.word} row={row} />
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}

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

function MultiplierCard({ word, row, featured = false }: { word: string; row: LedgerRow; featured?: boolean }) {
  const lit = new Set(row.highlight ?? []);
  return (
    <article
      className={cn(
        "rounded-2xl border bg-card px-4 py-4",
        featured ? "card-pop border-amber-200/40 shadow-lg" : "border-border",
      )}
      aria-live={featured ? "polite" : undefined}
    >
      <p
        className={cn(
          "flex flex-wrap justify-center gap-x-0.5 font-display tracking-tight",
          featured ? "text-3xl" : "text-xl",
        )}
        aria-label={word}
      >
        {[...word].map((letter, index) => (
          <span key={index} className={lit.has(index) ? "text-amber-100" : "text-muted-foreground/40"}>
            {letter}
          </span>
        ))}
      </p>
      <p className={cn("mt-3 text-center", featured ? "text-base" : "text-sm")}>{row.name}</p>
      {row.reason ? (
        <p className="mt-1 text-center text-xs leading-relaxed text-pretty text-muted-foreground">{row.reason}</p>
      ) : null}
    </article>
  );
}

function runningTotal(tileSum: number, steps: LedgerRow[], count: number): number {
  let total = tileSum;
  for (let index = 0; index < count; index += 1) total *= steps[index]?.points ?? 1;
  return total;
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
