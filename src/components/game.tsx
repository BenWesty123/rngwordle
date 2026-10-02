"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useAccount } from "@/components/account-provider";
import { SiteHeader } from "@/components/site-header";
import { UsernameForm } from "@/components/username-form";
import { Button } from "@/components/ui/button";
import { utcDateKey } from "@/lib/day";
import { flickerWord } from "@/lib/dictionary";
import { armScoreAudio, playLetterPoints, playMultiplier, playSheetMusic, playVerdict, prepareMultiplierScore, stopScoreAudio } from "@/lib/score-sound";
import { primeScore, retryScore, useScored } from "@/lib/score-client";
import { rememberCards, unseenCards } from "@/lib/card-collection";
import { buildShareMessage, formatStanding, shareLink, topCards } from "@/lib/share";
import { ShareBar } from "@/components/share-bar";
import { standingFor } from "@/lib/standing";
import { tilesFor, type LedgerRow, type ScoredWord, type Tile } from "@/lib/tiles";
import {
  parseRoll,
  readRollSnapshot,
  serverRollSnapshot,
  subscribeRoll,
  writeRoll,
} from "@/lib/storage";
import type { TierId } from "@/lib/tiers";
import { cn } from "@/lib/utils";
import { TileBox } from "@/components/tile";
import { TIER_STYLE } from "@/lib/tier-style";
import { cardRarity, RARITY_BADGE, RARITY_STAMP } from "@/lib/card-rarity";

const TILE_REVEAL_MS = 460;
const BOX_REVEAL_MS = 1450;


export function Game() {
  const [spinWord, setSpinWord] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [dealt, setDealt] = useState(false);
  const [rollError, setRollError] = useState<string | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  // Cards a fresh roll unlocked for the first time, for the "New card!" ribbon.
  const [freshCards, setFreshCards] = useState<{ word: string; ids: string[] } | null>(null);
  // A guest's extra roll after today's leaderboard roll: shown, but not saved and no cards.
  const [practiceWord, setPracticeWord] = useState<string | null>(null);
  const spinTimer = useRef<number | null>(null);
  const { account, refresh, rememberToday } = useAccount();
  const snapshot = useSyncExternalStore(subscribeRoll, readRollSnapshot, serverRollSnapshot);
  const guestRoll = snapshot ? parseRoll(snapshot) : null;
  const todayKey = utcDateKey();
  const savedRoll =
    account.status === "player" || account.status === "needs-name"
      ? account.today
        ? { date: todayKey, word: account.today.word }
        : null
      : account.status === "guest" && guestRoll?.date === todayKey
        ? guestRoll
        : null;
  const practice = account.status === "guest" && practiceWord !== null;
  const roll = practice ? { date: todayKey, word: practiceWord } : savedRoll;
  const daily =
    (account.status === "player" || account.status === "needs-name") &&
    account.today != null &&
    roll?.word === account.today.word;

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

  /** Shuffle the tiles before the reveal. A short settle when the bag already shook while dealing. */
  function startSpin(word: string, frames = 14) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    setSpinWord(flickerWord(word.length));
    let frame = 0;
    spinTimer.current = window.setInterval(() => {
      frame += 1;
      if (frame >= frames) {
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
    if (account.status !== "guest" && account.status !== "player" && account.status !== "needs-name") return;
    setDealt(true);
    setDealing(true);
    setRollError(null);
    // The bag starts shaking on the click; any wait for the server shakes with it.
    const startedAt = performance.now();
    try {
      const response = await fetch("/api/rolls", { method: "POST" });
      const body = (await response.json()) as {
        word?: string;
        score?: string;
        playedAt?: number;
        scored?: ScoredWord;
        newCards?: string[];
        practice?: boolean;
        error?: string;
      };
      if (!response.ok || !body.word || typeof body.score !== "string" || typeof body.playedAt !== "number") {
        setDealt(false);
        setRollError(body.error ?? "That roll didn't save.");
        return;
      }
      // Players get new cards from the server, which knows every past roll. Guests check this browser.
      // Practice rolls don't count, so they unlock nothing.
      const ids = body.practice ? [] : (body.newCards ?? (body.scored ? unseenCards(body.scored) : []));
      setFreshCards({ word: body.word, ids });
      if (body.scored) primeScore(body.scored);
      if (body.practice) setPracticeWord(body.word);
      else if (account.status === "guest") {
        setPracticeWord(null);
        writeRoll({ date: utcDateKey(), word: body.word });
      } else rememberToday({ word: body.word, score: body.score, playedAt: body.playedAt });
      setReplayKey((key) => key + 1);
      setCopied(false);
      setCopyError(false);
      startSpin(body.word, performance.now() - startedAt >= 500 ? 6 : 14);
    } catch {
      setDealt(false);
      setRollError("That roll didn't save.");
    } finally {
      setDealing(false);
    }
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

  const scoredState = useScored(roll?.word ?? null);
  const scored = scoredState && scoredState !== "error" ? scoredState : null;

  // Every card a shown roll scores goes into this browser's collection.
  useEffect(() => {
    if (scored && !practice) rememberCards(scored);
  }, [scored, practice]);
  const standing = scored ? standingFor(scored.total) : null;
  const glow = EMPTY_GLOW;

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-[28rem]", glow)} />
      <div className="relative mx-auto flex min-h-dvh w-full flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <SiteHeader
          trailing={
            roll && scored && standing ? (
              <Button
                type="button"
                className="h-9 shrink-0"
                disabled={dealing || spinWord !== null}
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
        ) : dealing ? (
          <ShakingBag length={roll?.word.length ?? 8} label="Shaking the bag…" />
        ) : roll && scored && standing ? (
          <>
            {account.status === "needs-name" ? <UsernameForm compact /> : null}
            <Result
              scored={scored}
              standing={standing}
              spinWord={spinWord}
              copied={copied}
              copyError={copyError}
              onCopy={onCopy}
              daily={daily}
              practice={practice}
              replayKey={replayKey}
              rollError={rollError}
              freshCards={freshCards?.word === roll.word ? freshCards.ids : []}
            />
          </>
        ) : roll && scoredState === "error" ? (
          <div className="flex flex-1 flex-col items-center justify-center" role="alert">
            <p className="text-sm text-foreground">Your roll&apos;s score didn&apos;t load.</p>
            <Button type="button" variant="outline" className="mt-3 h-9" onClick={() => retryScore(roll.word)}>
              Try again
            </Button>
          </div>
        ) : roll ? (
          <ShakingBag length={roll.word.length} label="Finding your roll…" />
        ) : dealt ? (
          <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground" role="status">
            Dealing…
          </p>
        ) : (
          <>
            {account.status === "needs-name" ? <UsernameForm compact /> : null}
            <FirstToday rollError={rollError} onGenerate={() => void onGenerate()} />
          </>
        )}
      </div>
    </div>
  );
}

const EMPTY_GLOW = "bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)]";

/**
 * Rattling tiles while the server deals or a saved roll loads. Laid out like the
 * reveal's own shuffle, so the hand-over to the real word doesn't jump.
 */
function ShakingBag({ length, label }: { length: number; label: string }) {
  const reduce = useReducedMotion();
  const [letters, setLetters] = useState(() => flickerWord(length));
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setLetters(flickerWord(length)), 45);
    return () => window.clearInterval(id);
  }, [length, reduce]);
  return (
    <div className="flex flex-1 flex-col pt-2" role="status">
      <h1 className="text-center text-sm text-muted-foreground">{label}</h1>
      {reduce ? null : (
        <ul aria-hidden className="mt-4 flex flex-wrap justify-center gap-1.5">
          {tilesFor(letters).map((tile, index) => (
            <TileBox key={index} tile={tile} length={length} shaking />
          ))}
        </ul>
      )}
    </div>
  );
}

type TodayTop = { word: string; username: string; score: string };

function FirstToday({ rollError, onGenerate }: { rollError: string | null; onGenerate: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [top, setTop] = useState<TodayTop | null | undefined>(undefined);
  const [topError, setTopError] = useState(false);

  useEffect(() => {
    let cancel = false;
    setTop(undefined);
    setTopError(false);
    fetch("/api/today")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("missing"))))
      .then((body: { top?: TodayTop | null }) => {
        if (cancel) return;
        setTop(body.top ?? null);
      })
      .catch(() => {
        if (!cancel) setTopError(true);
      });
    return () => {
      cancel = true;
    };
  }, [attempt]);

  const tiles = top ? tilesFor(top.word) : null;
  const standing = top ? standingFor(Number(top.score.replace(/\D/g, ""))) : null;
  const tone = standing ? TIER_STYLE[standing.tier.id] : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 sm:py-14">
      {tone ? (
        <div
          aria-hidden
          className={cn("pointer-events-none absolute inset-x-0 top-0 h-[32rem] transition-opacity duration-700", tone.glow)}
        />
      ) : null}

      <article className="relative w-full max-w-2xl text-center" aria-label="Today's highest rated word">
        <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Today&apos;s best roll</p>
        {topError ? (
          <div className="mt-6" role="alert">
            <p className="text-sm text-foreground">Today&apos;s highest roll didn&apos;t load.</p>
            <Button type="button" variant="outline" className="mt-3 h-9" onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </Button>
          </div>
        ) : top === undefined ? (
          <div className="mt-6 flex flex-col items-center" role="status" aria-label="Loading today's highest roll">
            <div className="flex gap-1.5">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} className="h-11 w-9 animate-pulse rounded-[4px] border border-foreground/10 bg-card sm:h-12 sm:w-10" />
              ))}
            </div>
            <span className="mt-6 h-10 w-40 animate-pulse rounded-md bg-card" />
          </div>
        ) : top === null || !tiles || !standing || !tone ? (
          <div className="mt-6" role="status">
            <p className="font-display text-4xl tracking-tight italic sm:text-5xl">Nobody yet.</p>
            <p className="mt-3 text-sm text-muted-foreground">No saved rolls today. Yours could be the one to beat.</p>
          </div>
        ) : (
          <div className="row-in mt-5 flex flex-col items-center">
            <ul className="flex flex-wrap justify-center gap-1.5" aria-label={top.word}>
              {tiles.map((tile, index) => (
                <TileBox key={`${tile.letter}-${index}`} tile={tile} length={tiles.length} dropDelay={index * 70} />
              ))}
            </ul>
            <p className="mt-6 font-mono text-5xl leading-none tabular-nums sm:text-6xl">{top.score}</p>
            <p
              className={cn(
                "mt-4 inline-flex rounded-full border px-3 py-1 text-[11px] tracking-[0.22em] uppercase",
                tone.badge,
              )}
            >
              {standing.tier.label}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Rolled by <span className="text-foreground">{top.username}</span>
              <span aria-hidden> · </span>
              {formatStanding(standing.beaten)}
            </p>
          </div>
        )}
      </article>

      <div className="relative mt-10 flex w-full max-w-xs flex-col items-center">
        <Button type="button" className="h-12 w-full text-base shadow-lg shadow-black/30 sm:h-14" onClick={onGenerate}>
          Generate word
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          {top ? "Think you can beat it?" : "Every roll goes on the leaderboard."}
        </p>
        {rollError ? (
          <p className="mt-3 text-center text-sm text-foreground" role="alert">
            {rollError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Result({
  scored,
  standing,
  spinWord,
  copied,
  copyError,
  onCopy,
  daily,
  practice,
  replayKey,
  rollError,
  freshCards,
}: {
  scored: ScoredWord;
  standing: ReturnType<typeof standingFor>;
  spinWord: string | null;
  copied: boolean;
  copyError: boolean;
  onCopy: (text: string) => void;
  daily: boolean;
  practice: boolean;
  replayKey: number;
  rollError: string | null;
  freshCards: string[];
}) {
  const spinning = spinWord !== null;
  const link = shareLink(typeof window === "undefined" ? "https://rwgdle.app" : window.location.origin, scored.word);
  const share = buildShareMessage({
    word: scored.word,
    total: scored.total,
    tierLabel: standing.tier.label,
    beaten: standing.beaten,
    cards: topCards(scored),
    link,
  });

  return (
    <div className="flex flex-1 flex-col pt-2">
      <h1 className="text-center text-sm text-muted-foreground">
        {spinning ? "Shaking the bag…" : practice ? "Practice roll" : daily ? "Today's saved roll" : "Your word"}
      </h1>
      {practice && !spinning ? (
        <p className="mx-auto mt-1 max-w-sm text-center text-xs text-pretty text-muted-foreground">
          Today&apos;s leaderboard roll is already saved. Practice rolls are just for fun: they don&apos;t count or collect cards.
        </p>
      ) : null}
      {spinning ? (
        <ul aria-hidden className="mt-4 flex flex-wrap justify-center gap-1.5">
          {tilesFor(spinWord).map((tile, index) => (
            <TileBox key={index} tile={tile} length={spinWord.length} shaking />
          ))}
        </ul>
      ) : null}

      {rollError ? (
        <p className="mt-4 text-center text-sm text-foreground" role="alert">
          {rollError}
        </p>
      ) : null}

      {!spinning ? (
        <ScoreReveal
          key={`${scored.word}-${replayKey}`}
          scored={scored}
          share={share}
          link={link}
          copied={copied}
          copyError={copyError}
          onCopy={onCopy}
          freshCards={freshCards}
          shareable={!practice}
        />
      ) : null}
    </div>
  );
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function WordDefinition({ word, show, reduce }: { word: string; show: boolean; reduce: boolean }) {
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
  if (!show || gloss === undefined) return null;
  return (
    <p
      className={cn(
        "mx-auto mt-4 max-w-md text-center text-sm text-pretty text-muted-foreground",
        !reduce && "definition-in",
      )}
      data-definition=""
    >
      {gloss ?? "No definition on file"}
    </p>
  );
}

function ScoreReveal({
  scored,
  share,
  link,
  copied,
  copyError,
  onCopy,
  freshCards,
  shareable,
}: {
  scored: ScoredWord;
  share: { text: string; withoutLink: string };
  link: string;
  copied: boolean;
  copyError: boolean;
  onCopy: (text: string) => void;
  freshCards: string[];
  /** Practice rolls aren't the day's roll, so there's nothing to share. */
  shareable: boolean;
}) {
  const steps = scored.rows.filter((row) => row.id !== "tiles" && row.scored && (row.points ?? 0) > 1);
  // The ribbon goes on the first card of each newly unlocked kind (Inside can show several).
  const ribbonAt = new Set(
    freshCards.map((id) => steps.findIndex((step) => step.id === id)).filter((index) => index >= 0),
  );
  const stepsRef = useRef(steps);
  const tilesRef = useRef(scored.tiles);
  const wordRef = useRef(scored.word);
  const reduce = useReducedMotion();
  const [letters, setLetters] = useState(0);
  const [shown, setShown] = useState(0);
  const [settled, setSettled] = useState(0);
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const tileRowRef = useRef<HTMLUListElement>(null);
  const pileRef = useRef<HTMLOListElement>(null);
  const pileTops = useRef(new Map<string, number>());
  if (reduce && letters !== scored.tiles.length) setLetters(scored.tiles.length);
  if (reduce && shown !== steps.length) setShown(steps.length);
  if (reduce && settled !== steps.length) setSettled(steps.length);
  const visibleLetters = reduce ? scored.tiles.length : letters;
  const visible = reduce ? steps.length : shown;
  const baseDone = visibleLetters >= scored.tiles.length;
  const done = baseDone && settled >= steps.length;
  const tileTarget = scored.tiles.slice(0, visibleLetters).reduce((sum, tile) => sum + tile.value, 0);
  const previous = runningTotal(scored.tileSum, steps, Math.max(0, visible - 1));
  const target = baseDone ? runningTotal(scored.tileSum, steps, visible) : tileTarget;
  const live = standingFor(target);
  const tone = TIER_STYLE[live.tier.id];
  const finalTier = live.tier.id;
  const currentStep = baseDone && visible > settled ? (steps[visible - 1] ?? null) : null;
  const addedTile = !baseDone && visibleLetters > 0 ? scored.tiles[visibleLetters - 1] : null;

  useLayoutEffect(() => {
    if (reduce) return;
    const tiles = tilesRef.current;
    if (tiles.length === 0) return;
    let heard = 0;
    const id = window.setInterval(() => {
      const pile = tilesRef.current;
      if (heard >= pile.length) {
        window.clearInterval(id);
        return;
      }
      const tile = pile[heard];
      const runningBefore = pile.slice(0, heard).reduce((sum, item) => sum + item.value, 0);
      if (tile) playLetterPoints(tile.value, runningBefore);
      heard += 1;
      setLetters(heard);
      if (heard >= pile.length) window.clearInterval(id);
    }, TILE_REVEAL_MS);
    return () => {
      window.clearInterval(id);
      stopScoreAudio();
    };
  }, [reduce, scored.tiles.length]);

  useLayoutEffect(() => {
    if (reduce || !baseDone) return;
    const tier = standingFor(scored.total).tier.id;
    const pending = stepsRef.current;
    prepareMultiplierScore(
      pending.map((step) => step.points ?? 0),
      tier,
    );
    if (pending.length === 0) {
      playVerdict();
      return;
    }
    let heard = 0;
    const id = window.setInterval(() => {
      const boxes = stepsRef.current;
      if (heard < boxes.length) {
        // Sheet music plays the word as a tune instead of the usual chord.
        if (boxes[heard]?.id === "sheet-music") playSheetMusic(wordRef.current);
        else playMultiplier(heard);
        heard += 1;
        setShown(heard);
        setSettled(heard - 1);
        return;
      }
      setSettled(boxes.length);
      window.clearInterval(id);
    }, BOX_REVEAL_MS);
    return () => {
      window.clearInterval(id);
      stopScoreAudio();
    };
  }, [baseDone, reduce, scored.total, steps.length]);

  useLayoutEffect(() => {
    const row = tileRowRef.current;
    if (row && visibleLetters > 0) {
      const rect = row.getBoundingClientRect();
      if (rect.top < 8 || rect.bottom > window.innerHeight - 8) {
        row.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
    const list = pileRef.current;
    if (!list) return;
    const next = new Map<string, number>();
    for (const item of [...list.children]) {
      if (!(item instanceof HTMLElement)) continue;
      const key = item.dataset.pileKey;
      if (!key) continue;
      const top = item.getBoundingClientRect().top;
      const earlier = pileTops.current.get(key);
      next.set(key, top);
      if (reduce || earlier == null) continue;
      const delta = earlier - top;
      if (Math.abs(delta) < 0.5) continue;
      item.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], {
        duration: 450,
        easing: "ease-out",
      });
    }
    pileTops.current = next;
  }, [visibleLetters, visible, reduce]);

  useEffect(() => {
    if (reduce) {
      displayRef.current = scored.total;
      setDisplay(scored.total);
      return;
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
  }, [target, reduce, baseDone, scored.total]);

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-[28rem] transition-opacity duration-700",
          tone.glow,
        )}
      />

      <div className={cn(done && !reduce && (finalTier === "mythic" || finalTier === "epic") && "screen-shake")}>
      <ul
        ref={tileRowRef}
        className={cn("mt-3 flex flex-wrap justify-center gap-1.5", done && finalTier === "trash" && "tiles-slump")}
        aria-label="Scrabble tiles"
        data-tiles={visibleLetters}
        data-tile-count={scored.tiles.length}
      >
        {scored.tiles.slice(0, visibleLetters).map((tile, index) => (
          <TileBox
            key={`${tile.letter}-${index}`}
            tile={tile}
            length={scored.length}
            fresh={index === visibleLetters - 1 && !baseDone}
          />
        ))}
      </ul>
      <WordDefinition word={scored.word} show={baseDone} reduce={reduce} />

      <div className="mt-5 text-center">
        <p className="sr-only">Score</p>
        <div className="relative inline-block">
          <p key={`${visibleLetters}-${visible}`} className={cn("score-pop font-mono tabular-nums leading-none", scoreSize(display))}>
            {display.toLocaleString("en-US")}
          </p>
          {done && !reduce ? <SparkleBurst tier={finalTier} /> : null}
        </div>
        <p className="mt-2 text-sm text-foreground" aria-live="polite">
          {currentStep && !done
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
        {currentStep && !done ? (
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
            {`${previous.toLocaleString("en-US")} × ${currentStep.points} = ${target.toLocaleString("en-US")}`}
          </p>
        ) : null}
        <p
          className={cn(
            "mt-2 inline-flex rounded-full border px-3 py-1 text-[11px] tracking-[0.22em] uppercase",
            tone.badge,
          )}
        >
          {live.tier.label}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatStanding(live.beaten)}
        </p>
      </div>
      </div>
      {done && !reduce && (finalTier === "mythic" || finalTier === "epic") ? <Confetti tier={finalTier} /> : null}

      {done && shareable ? (
        <ShareBar
          message={share.text}
          messageWithoutLink={share.withoutLink}
          link={link}
          onCopy={onCopy}
          copied={copied}
          copyError={copyError}
        />
      ) : null}

      <section className="mx-auto mt-3 w-full max-w-xl" aria-label="Multipliers" data-boxes={visible} data-box-count={steps.length}>
        {baseDone && visible > 0 ? (
          <ol ref={pileRef} className="card-pile flex flex-col gap-2">
            {steps
              .slice(0, visible)
              .map((row, stepIndex) => ({ row, stepIndex }))
              .reverse()
              .map(({ row, stepIndex }) => {
                const isNewest = stepIndex === visible - 1;
                return (
                  <li
                    key={`${row.id}-${stepIndex}`}
                    data-pile-key={`${row.id}-${stepIndex}`}
                    className={cn("relative", isNewest && "z-10")}
                  >
                    <MultiplierCard tiles={scored.tiles} row={row} featured={isNewest} isNew={ribbonAt.has(stepIndex)} />
                  </li>
                );
              })}
          </ol>
        ) : null}
      </section>

      {done && ribbonAt.size > 0 ? (
        <Link
          href="/cards"
          className="row-in mx-auto mt-8 flex w-full max-w-xl items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-medium transition-colors hover:bg-primary/15"
        >
          <Sparkles className="size-4 text-primary" aria-hidden />
          {ribbonAt.size === 1 ? "1 new card unlocked" : `${ribbonAt.size} new cards unlocked`}
          <span className="text-muted-foreground">· View collection →</span>
        </Link>
      ) : null}

    </>
  );
}


function MultiplierCard({
  tiles,
  row,
  featured = false,
  isNew = false,
}: {
  tiles: Tile[];
  row: LedgerRow;
  featured?: boolean;
  /** First time this player has ever found this card. */
  isNew?: boolean;
}) {
  const lit = new Set(row.highlight ?? []);
  const partial = lit.size > 0 && lit.size < tiles.length;
  const rarity = row.points != null && row.points > 1 ? cardRarity(row.points) : null;
  return (
    <article
      className={cn(
        "relative rounded-2xl border bg-card px-4 pt-5 pb-4",
        featured ? "card-pop border-amber-600/40 shadow-lg dark:border-amber-200/40" : "border-border",
      )}
      aria-live={featured ? "polite" : undefined}
    >
      {isNew ? (
        <span
          className={cn(
            "absolute -top-3 left-3 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] leading-none font-semibold tracking-wide text-primary-foreground uppercase shadow-md",
            featured && "ribbon-in",
          )}
        >
          <Sparkles className="size-3" aria-hidden />
          New card!
        </span>
      ) : null}
      {rarity ? (
        <span
          aria-hidden
          className={cn(
            "stamp absolute -top-3 right-3 rounded-md border-2 bg-background px-2 py-0.5 font-mono text-lg leading-none font-bold tabular-nums",
            RARITY_STAMP[rarity],
            featured && "stamp-in",
          )}
        >
          ×{row.points}
        </span>
      ) : null}
      <ul className="flex flex-wrap justify-center gap-1.5" aria-label={`${row.name} tiles`}>
        {tiles.map((tile, index) => (
          <TileBox
            key={`${tile.letter}-${index}`}
            tile={tile}
            length={tiles.length}
            lit={partial && lit.has(index)}
            dim={partial && !lit.has(index)}
            small
          />
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        <span className={featured ? "text-base" : "text-sm"}>{row.name}</span>
        {row.points != null && row.points > 1 ? (
          <FactorBadge points={row.points} />
        ) : null}
      </p>
      {row.reason ? (
        <p className="mt-1 text-center text-sm leading-relaxed text-pretty text-muted-foreground">{row.reason}</p>
      ) : null}
    </article>
  );
}

function FactorBadge({ points }: { points: number }) {
  const label = cardRarity(points);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium",
        RARITY_BADGE[label],
      )}
      data-rarity={label}
    >
      {label}
    </span>
  );
}

/** Stable scatter for decorative pieces, so render stays pure. */
function scatter(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const CONFETTI_COLORS: Record<"mythic" | "epic", string[]> = {
  mythic: ["#fcd34d", "#fbbf24", "#d97706", "#f59e0b", "#b45309"],
  epic: ["#c4b5fd", "#8b5cf6", "#e879f9", "#fcd34d", "#6d28d9"],
};

function Confetti({ tier }: { tier: "mythic" | "epic" }) {
  const count = tier === "mythic" ? 90 : 60;
  const colors = CONFETTI_COLORS[tier];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: count }, (_, index) => {
        const wide = scatter(index, 4) > 0.5;
        return (
          <span
            key={index}
            className="confetti-piece rounded-[1px]"
            style={
              {
                left: `${scatter(index, 1) * 100}%`,
                width: wide ? 10 : 6,
                height: wide ? 6 : 12,
                background: colors[index % colors.length],
                "--dx": `${(scatter(index, 2) - 0.5) * 220}px`,
                "--spin": `${(scatter(index, 3) - 0.5) * 1440}deg`,
                "--fall": `${2 + scatter(index, 5) * 1.8}s`,
                "--delay": `${scatter(index, 6) * 0.5}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

const SPARKLES: Partial<Record<TierId, { count: number; color: string; reach: number }>> = {
  // Mid-tone colours so the sparkles show on both Daylight and Card Table.
  mythic: { count: 16, color: "#f59e0b", reach: 150 },
  epic: { count: 14, color: "#8b5cf6", reach: 130 },
  rare: { count: 12, color: "#0ea5e9", reach: 110 },
  uncommon: { count: 8, color: "#10b981", reach: 80 },
};

function SparkleBurst({ tier }: { tier: TierId }) {
  const burst = SPARKLES[tier];
  if (!burst) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: burst.count }, (_, index) => {
        const angle = (index / burst.count) * Math.PI * 2 + scatter(index, 7) * 0.4;
        const reach = burst.reach * (0.6 + scatter(index, 8) * 0.4);
        return (
          <span
            key={index}
            className="sparkle text-lg leading-none"
            style={
              {
                color: burst.color,
                textShadow: `0 0 10px ${burst.color}`,
                "--dx": `${Math.cos(angle) * reach}px`,
                "--dy": `${Math.sin(angle) * reach * 0.6}px`,
                "--spin": `${(scatter(index, 9) - 0.5) * 360}deg`,
                "--delay": `${scatter(index, 10) * 0.15}s`,
              } as CSSProperties
            }
          >
            ✦
          </span>
        );
      })}
    </span>
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
