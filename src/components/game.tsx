"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy } from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { SiteHeader } from "@/components/site-header";
import { UsernameForm } from "@/components/username-form";
import { Button } from "@/components/ui/button";
import { utcDateKey } from "@/lib/day";
import { flickerWord, loadDictionary } from "@/lib/dictionary";
import { armScoreAudio, playMultiplier, playVerdict, prepareMultiplierScore, stopScoreAudio } from "@/lib/score-sound";
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

const BOX_REVEAL_MS = 200;

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
    account.status === "player" || account.status === "needs-name"
      ? account.today
        ? { date: utcDateKey(), word: account.today.word }
        : null
      : account.status === "guest"
        ? guestRoll
        : null;
  const daily =
    (account.status === "player" || account.status === "needs-name") &&
    account.today != null &&
    roll?.word === account.today.word;

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
    if (account.status !== "guest" && account.status !== "player" && account.status !== "needs-name") return;
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
        setRollError(body.error ?? "That roll didn't save.");
        return;
      }
      if (account.status === "guest") writeRoll({ date: utcDateKey(), word: body.word });
      else rememberToday({ word: body.word, score: body.score, playedAt: body.playedAt });
      setReplayKey((key) => key + 1);
      setCopied(false);
      setCopyError(false);
      startSpin(body.word);
    } catch {
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

  const scored = roll ? scoreWord(roll.word) : null;
  const standing = scored ? standingFor(scored.total) : null;
  const glow = EMPTY_GLOW;

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-[28rem]", glow)} />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
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
        ) : roll && scored && standing ? (
          <>
            {account.status === "needs-name" ? <UsernameForm compact /> : null}
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
          </>
        ) : (
          <>
            {account.status === "needs-name" ? <UsernameForm compact /> : null}
            <EmptyState
            dictionary={dictionary}
            dictionaryError={dictionaryError}
            account={account.status === "needs-name" ? "needs-name" : account.status}
            dealing={dealing}
            rollError={rollError}
            onGenerate={() => void onGenerate()}
            onRetry={() => {
              setDictionaryError(null);
              setDictionaryAttempt((attempt) => attempt + 1);
            }}
          />
          </>
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
  account: "guest" | "player" | "needs-name";
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
          ? "Generate saves one roll under your name for this UTC day. Generating again shows that same word."
          : account === "needs-name"
            ? "Generate saves one roll today as Anonymous until you pick a username."
            : "Generate saves a roll on the board as Anonymous. Log in when you want a username on your daily roll."}
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
          disabled={dealing}
          onClick={onGenerate}
        >
          {dealing ? "Dealing…" : "Generate"}
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
        {account === "guest"
          ? "The latest word stays in this browser until you roll again. Each one is on the board."
          : "Logged-out rolls are on the board as Anonymous."}
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
  const share = buildShareText({
    date: roll.date,
    scored,
    tierLabel: standing.tier.label,
    beaten: standing.beaten,
    wordCount: standing.wordCount,
  });

  return (
    <div className="flex flex-1 flex-col pt-2">
      <h1 className="text-center text-sm text-muted-foreground">
        {spinning ? "Shuffling the tiles…" : daily ? "Today's saved roll" : "Your word"}
      </h1>
      {spinning ? (
        <p
          aria-hidden
          className={cn(
            "mt-4 text-center font-display leading-none tracking-tight break-all italic",
            wordSize(spinWord.length),
          )}
        >
          {spinWord}
        </p>
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
          copied={copied}
          copyError={copyError}
          onCopy={onCopy}
        />
      ) : null}
      {!spinning ? <WordDefinition word={scored.word} /> : null}
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
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const finished = useRef(false);
  const [display, setDisplay] = useState(scored.tileSum);
  const displayRef = useRef(scored.tileSum);
  const pileRef = useRef<HTMLOListElement>(null);
  const pileTops = useRef(new Map<string, number>());
  if (reduce && shown !== steps.length) setShown(steps.length);
  const visible = reduce ? steps.length : shown;
  const done = visible >= steps.length;
  const previous = runningTotal(scored.tileSum, steps, Math.max(0, visible - 1));
  const target = runningTotal(scored.tileSum, steps, visible);
  const live = standingFor(target);
  const tone = TIER_STYLE[live.tier.id];
  const currentStep = visible > 0 && visible <= steps.length ? (steps[visible - 1] ?? null) : null;

  useLayoutEffect(() => {
    if (reduce) {
      finished.current = true;
      return;
    }
    if (finished.current) return;
    const tier = standingFor(scored.total).tier.id;
    const pending = stepsRef.current;
    prepareMultiplierScore(
      pending.map((step) => step.points ?? 0),
      tier,
    );
    if (pending.length === 0) {
      playVerdict();
      finished.current = true;
      return;
    }
    let count = 0;
    const id = window.setInterval(() => {
      const boxes = stepsRef.current;
      if (count >= boxes.length) {
        finished.current = true;
        window.clearInterval(id);
        return;
      }
      playMultiplier(count);
      count += 1;
      setShown(count);
      if (count >= boxes.length) {
        finished.current = true;
        window.clearInterval(id);
      }
    }, BOX_REVEAL_MS);
    return () => {
      window.clearInterval(id);
      stopScoreAudio();
    };
  }, [reduce, scored.total, steps.length]);

  useLayoutEffect(() => {
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
    const wordLine = list.querySelector("article p");
    if (!(wordLine instanceof HTMLElement)) return;
    const rect = wordLine.getBoundingClientRect();
    const margin = 8;
    if (rect.top < margin || rect.bottom > window.innerHeight - margin) {
      wordLine.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [visible, reduce]);

  useEffect(() => {
    const from = displayRef.current;
    if (from === target) return;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (start === 0) start = now;
      const t = Math.min(1, (now - start) / BOX_REVEAL_MS);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (target - from) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-[28rem] transition-opacity duration-700",
          tone.glow,
        )}
      />

      <div className="mt-3 text-center">
        <p className="sr-only">Score</p>
        <p key={visible} className={cn("score-rise font-mono tabular-nums leading-none", scoreSize(display))}>
          {display.toLocaleString("en-US")}
        </p>
        <p className="mt-2 text-sm text-foreground" aria-live="polite">
          {currentStep && !done
            ? currentStep.name
            : done
              ? steps.length > 0
                ? "Every multiplier that hit"
                : "No multiplier hit"
              : "The base, before any multiplier."}
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
          Beats {formatBeaten(live.beaten)} of {live.wordCount.toLocaleString("en-US")} words
        </p>
      </div>

      <section className="mt-3" aria-label="Multipliers" data-boxes={visible} data-box-count={steps.length}>
        {visible > 0 ? (
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
                    <MultiplierCard word={scored.word} row={row} featured={isNewest} />
                  </li>
                );
              })}
          </ol>
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
          "text-center font-display leading-none tracking-tight break-words text-foreground italic",
          cardWordSize(word.length, featured),
        )}
        aria-label={word}
      >
        {[...word].map((letter, index) => (
          <span key={index} className={lit.has(index) ? "text-amber-100" : undefined}>
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

function cardWordSize(length: number, featured: boolean): string {
  if (length > 18) return featured ? "text-3xl" : "text-2xl";
  if (length > 12) return featured ? "text-4xl" : "text-3xl";
  if (length > 8) return featured ? "text-5xl" : "text-4xl";
  return featured ? "text-6xl" : "text-5xl";
}

function wordSize(length: number): string {
  if (length <= 6) return "text-6xl sm:text-8xl";
  if (length <= 10) return "text-5xl sm:text-7xl";
  if (length <= 14) return "text-4xl sm:text-6xl";
  if (length <= 18) return "text-3xl sm:text-5xl";
  return "text-2xl break-all sm:text-4xl";
}
