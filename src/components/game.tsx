"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { SiteHeader } from "@/components/site-header";
import { UsernameForm } from "@/components/username-form";
import { Button } from "@/components/ui/button";
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
  const [dealing, setDealing] = useState(false);
  const [rollError, setRollError] = useState<string | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const spinTimer = useRef<number | null>(null);
  const { account, refresh, rememberToday } = useAccount();
  const snapshot = useSyncExternalStore(subscribeRoll, readRollSnapshot, serverRollSnapshot);
  const guestRoll = snapshot ? parseRoll(snapshot) : null;
  const roll =
    account.status === "player"
      ? account.today
        ? { date: utcDateKey(), word: account.today.word }
        : null
      : account.status === "guest"
        ? guestRoll
        : null;
  const daily = account.status === "player" && account.today != null && roll?.word === account.today.word;

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

  function startSpin(word: string) {
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

  async function onGenerate() {
    armScoreAudio();
    if (spinTimer.current !== null || dealing) return;
    if (account.status === "player") {
      setDealing(true);
      setRollError(null);
      try {
        const response = await fetch("/api/rolls", { method: "POST" });
        const body = (await response.json()) as {
          word?: string;
          score?: string;
          playedAt?: number;
          error?: string;
        };
        if (!response.ok || !body.word || typeof body.score !== "string" || typeof body.playedAt !== "number") {
          setRollError(body.error ?? "Today's roll didn't save.");
          return;
        }
        rememberToday({ word: body.word, score: body.score, playedAt: body.playedAt });
        setReplayKey((key) => key + 1);
        setCopied(false);
        setCopyError(false);
        startSpin(body.word);
      } catch {
        setRollError("Today's roll didn't save.");
      } finally {
        setDealing(false);
      }
      return;
    }
    if (account.status !== "guest" || !dictionary) return;
    const word = randomWord(dictionary);
    const next = { date: utcDateKey(), word };
    writeRoll(next);
    setCopied(false);
    setCopyError(false);
    setRollError(null);
    startSpin(word);
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
        <SiteHeader
          trailing={
            roll && scored && standing ? (
              <Button
                type="button"
                className="h-9 shrink-0"
                disabled={dealing || spinWord !== null || (account.status === "guest" && !dictionary)}
                onClick={() => void onGenerate()}
              >
                {dealing ? "Dealing…" : "Generate again"}
              </Button>
            ) : null
          }
        />

        {account.status === "loading" ? (
          <p className="py-16 text-sm text-muted-foreground">Checking this browser…</p>
        ) : account.status === "error" ? (
          <div className="py-16" role="alert">
            <p className="text-sm text-foreground">Couldn’t check this account.</p>
            <Button type="button" className="mt-5 h-12" onClick={() => void refresh()}>
              Try again
            </Button>
          </div>
        ) : account.status === "needs-name" ? (
          <UsernameForm />
        ) : roll && scored && standing ? (
          <Result
            roll={roll}
            scored={scored}
            standing={standing}
            spinWord={spinWord}
            copied={copied}
            copyError={copyError}
            onCopy={onCopy}
            daily={daily}
            replayKey={replayKey}
            rollError={rollError}
          />
        ) : (
          <EmptyState
            dictionary={dictionary}
            dictionaryError={dictionaryError}
            account={account.status}
            dealing={dealing}
            rollError={rollError}
            onGenerate={() => void onGenerate()}
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
  account,
  dealing,
  rollError,
  onGenerate,
  onRetry,
}: {
  dictionary: string[] | null;
  dictionaryError: string | null;
  account: "guest" | "player";
  dealing: boolean;
  rollError: string | null;
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
        {account === "player"
          ? "Generate deals today’s word and saves it under your name. One roll per UTC day. Come back tomorrow for another."
          : "Generate deals this browser a random English word. Guest rolls are unlimited and stay off the board. Log in to save one roll each UTC day."}
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
          disabled={dealing || (account === "guest" && !dictionary)}
          onClick={onGenerate}
        >
          {dealing ? "Dealing…" : account === "player" || dictionary ? "Generate" : "Opening the dictionary…"}
        </Button>
      )}
      {rollError ? (
        <p className="mt-4 max-w-md text-sm text-foreground" role="alert">
          {rollError}
        </p>
      ) : null}
      <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
        {wordCount
          ? `${wordCount.toLocaleString("en-US")} words in the pot. `
          : "A full dictionary is in the pot. "}
        {account === "player"
          ? "Logged-out play stays unlimited, and those rolls are not on the board."
          : "The latest guest word stays in this browser until you roll again."}
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
  daily,
  replayKey,
  rollError,
}: {
  roll: StoredRoll;
  scored: ReturnType<typeof scoreWord>;
  standing: ReturnType<typeof standingFor>;
  spinWord: string | null;
  copied: boolean;
  copyError: boolean;
  onCopy: (text: string) => void;
  daily: boolean;
  replayKey: number;
  rollError: string | null;
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
        {spinning ? "Shuffling the tiles…" : daily ? "Today's saved roll" : "Your word"}
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

      {!spinning ? <WordDefinition word={scored.word} /> : null}
      {rollError ? (
        <p className="mt-4 text-center text-sm text-foreground" role="alert">
          {rollError}
        </p>
      ) : null}

      {!spinning ? (
        <>
          <ScoreReveal
            key={`${scored.word}-${replayKey}`}
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

function WordDefinition({ word }: { word: string }) {
  const [gloss, setGloss] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancel = false;
    setGloss(undefined);
    fetch(`/api/definition?word=${encodeURIComponent(word)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("missing"))))
      .then((body: { definition?: unknown }) => {
        if (cancel) return;
        setGloss(typeof body.definition === "string" ? body.definition : null);
      })
      .catch(() => {
        if (!cancel) setGloss(null);
      });
    return () => {
      cancel = true;
    };
  }, [word]);
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
  const pileRef = useRef<HTMLOListElement>(null);
  const pileTops = useRef(new Map<string, number>());
  const baseDone = letters >= scored.tiles.length;
  const done = baseDone && settled >= steps.length;
  const tileTarget = scored.tiles.slice(0, letters).reduce((sum, tile) => sum + tile.value, 0);
  const target = baseDone ? runningTotal(scored.tileSum, steps, applied) : tileTarget;
  const live = standingFor(target);
  const tone = TIER_STYLE[live.tier.id];
  const activeStep = baseDone && applied > settled ? (steps[applied - 1] ?? null) : null;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      if (tile && !reduce) playLetterPoints(tile.value, runningBefore);
      heard.current = current + 1;
      setLetters(heard.current);
      if (heard.current >= tiles.length) window.clearInterval(id);
    }, 460);
    return () => {
      window.clearInterval(id);
      stopScoreAudio();
    };
  }, [scored.tiles.length, steps.length]);

  useEffect(() => {
    if (!baseDone) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tier = standingFor(scored.total).tier.id;
    if (!reduce) {
      prepareMultiplierScore(
        stepsRef.current.map((step) => step.points ?? 0),
        tier,
      );
    }
    if (steps.length === 0) {
      if (!reduce) playVerdict();
      return;
    }
    const heard = { current: 0 };
    const id = window.setInterval(() => {
      const pending = stepsRef.current;
      const current = heard.current;
      if (current < pending.length) {
        if (!reduce) playMultiplier(current);
        heard.current = current + 1;
        setApplied(heard.current);
        setSettled(current);
        return;
      }
      setSettled(pending.length);
      window.clearInterval(id);
    }, 1450);
    return () => window.clearInterval(id);
  }, [baseDone, scored.total, steps.length]);

  useLayoutEffect(() => {
    const list = pileRef.current;
    if (!list) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    for (const item of [...list.children]) {
      if (!(item instanceof HTMLElement)) continue;
      const key = item.dataset.pileKey;
      if (!key) continue;
      const top = item.getBoundingClientRect().top;
      const previous = pileTops.current.get(key);
      next.set(key, top);
      if (reduce || previous == null) continue;
      const delta = previous - top;
      if (Math.abs(delta) < 0.5) continue;
      item.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], {
        duration: 450,
        easing: "ease-out",
      });
    }
    pileTops.current = next;
  }, [applied]);

  useEffect(() => {
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
      </div>

      {baseDone ? (
        <section className="mt-8" aria-label="Multipliers">
          {applied > 0 ? (
            <ol ref={pileRef} className="card-pile flex flex-col gap-2">
              {steps
                .slice(0, applied)
                .map((row, stepIndex) => ({ row, stepIndex }))
                .reverse()
                .map(({ row, stepIndex }) => {
                  const isNewest = stepIndex === applied - 1;
                  return (
                    <li
                      key={`${row.id}-${stepIndex}`}
                      data-pile-key={`${row.id}-${stepIndex}`}
                      className={cn("relative", isNewest && "z-10")}
                    >
                      <MultiplierCard word={scored.word} row={row} featured={isNewest} />
                    </li>
                  );
                })}
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
