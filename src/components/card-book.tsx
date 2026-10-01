"use client"

import { useState } from "react"
import Link from "next/link"
import { Lock } from "lucide-react"
import { useLocalCards } from "@/lib/card-collection"
import { RARITY_BADGE, RARITY_BORDER, RARITY_ORDER } from "@/lib/card-rarity"
import type { Card, CardCategory } from "@/lib/cards"
import { cn } from "@/lib/utils"

/** Cards from a player's saved rolls: card id → first word that earned it, and how many rolls did. */
export type SavedFinds = Record<string, { first: string; count: number }>

const CATEGORY_ORDER: CardCategory[] = [
  "Mirrors and flips",
  "Word families",
  "Letter patterns",
  "Vowels and consonants",
  "Codes and keyboards",
  "Hidden inside",
  "Origins",
]

type Filter = "all" | "found" | "missing"

export function CardBook({
  catalog,
  saved,
  rollCount,
  signedIn,
}: {
  catalog: Card[]
  saved: SavedFinds
  rollCount: number
  signedIn: boolean
}) {
  const local = useLocalCards()
  const [filter, setFilter] = useState<Filter>("all")

  const found = (id: string): { first: string; count: number } | null =>
    saved[id] ?? (local[id] ? { first: local[id]!, count: 1 } : null)

  const foundCount = catalog.filter((card) => found(card.id)).length
  const share = catalog.length > 0 ? foundCount / catalog.length : 0
  const shown = catalog.filter((card) => (filter === "all" ? true : filter === "found" ? found(card.id) : !found(card.id)))

  return (
    <main className="mx-auto w-full max-w-5xl">
      <div className="mt-10 text-center">
        <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Your collection</p>
        <h1 className="mt-2 font-display text-5xl leading-[0.95] tracking-tight italic sm:text-6xl">Cards</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-pretty text-muted-foreground">
          {signedIn
            ? `Every card from your ${rollCount === 1 ? "saved roll" : `${rollCount.toLocaleString("en-US")} saved rolls`}, plus any found in this browser.`
            : "Cards found in this browser. Log in and every roll you save adds to your collection on any device."}
        </p>
      </div>

      <section className="mx-auto mt-8 max-w-xl" aria-label="Progress">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-3xl tabular-nums">
            {foundCount}
            <span className="text-lg text-muted-foreground"> / {catalog.length}</span>
          </p>
          <p className="text-sm text-muted-foreground">{Math.round(share * 100)}% found</p>
        </div>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={catalog.length}
          aria-valuenow={foundCount}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${share * 100}%` }} />
        </div>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {RARITY_ORDER.map((rarity) => {
            const all = catalog.filter((card) => card.rarity === rarity)
            const have = all.filter((card) => found(card.id)).length
            return (
              <li key={rarity} className={cn("rounded-full border px-2.5 py-1 text-xs tabular-nums", RARITY_BADGE[rarity])}>
                {rarity} {have}/{all.length}
              </li>
            )
          })}
        </ul>
      </section>

      <div className="mt-6 flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-card/70 p-1" role="tablist" aria-label="Show">
          {(["all", "found", "missing"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm capitalize transition-colors",
                filter === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {foundCount === 0 && filter !== "missing" ? (
        <div className="mx-auto mt-8 max-w-md rounded-3xl border border-dashed border-border px-6 py-8 text-center">
          <p className="font-display text-2xl tracking-tight italic">No cards yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">Every multiplier a roll scores goes into your collection.</p>
          <Link href="/" className="mt-4 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
            Roll a word
          </Link>
        </div>
      ) : null}

      {CATEGORY_ORDER.map((category) => {
        const cards = shown
          .filter((card) => card.category === category)
          .sort((left, right) => RARITY_ORDER.indexOf(left.rarity) - RARITY_ORDER.indexOf(right.rarity))
        if (cards.length === 0) return null
        const have = catalog.filter((card) => card.category === category && found(card.id)).length
        const total = catalog.filter((card) => card.category === category).length
        return (
          <section key={category} className="mt-10" aria-label={category}>
            <h2 className="flex items-baseline justify-between border-b border-border pb-2">
              <span className="font-display text-2xl tracking-tight italic">{category}</span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {have}/{total}
              </span>
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <li key={card.id}>
                  <CollectedCard card={card} found={found(card.id)} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </main>
  )
}

function CollectedCard({ card, found }: { card: Card; found: { first: string; count: number } | null }) {
  if (!found) return <LockedCard card={card} />
  return (
    <article
      className={cn("relative flex h-full flex-col rounded-2xl border bg-card px-4 pt-4 pb-3.5 shadow-sm", RARITY_BORDER[card.rarity])}
      data-found=""
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium", RARITY_BADGE[card.rarity])}>
          {card.rarity}
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">{card.value}</span>
      </div>
      <h3 className="mt-3 font-display text-xl leading-tight tracking-tight italic">{card.name}</h3>
      <p className="mt-1 text-sm text-pretty text-muted-foreground">{card.blurb}</p>
      <p className="mt-auto pt-3 text-xs text-muted-foreground">
        First found in <span className="font-display text-sm text-foreground italic">{found.first}</span>
        {found.count > 1 ? ` · ${found.count} rolls` : ""}
      </p>
    </article>
  )
}

/**
 * A card not found yet shows only its rarity. The name, value, and how to earn it
 * stay hidden behind blurred bars, so a roll is the only way to learn what it is.
 */
function LockedCard({ card }: { card: Card }) {
  // Bar widths follow the hidden text's length, so the grid doesn't look stamped out.
  const nameWidth = `${Math.min(85, 30 + card.name.length * 3)}%`
  return (
    <article
      className="relative flex h-full min-h-36 flex-col overflow-hidden rounded-2xl border border-dashed border-border bg-card/30 px-4 pt-4 pb-3.5"
      aria-label={`Locked ${card.rarity} card`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] leading-none font-medium opacity-70", RARITY_BADGE[card.rarity])}>
          {card.rarity}
        </span>
        <span className="font-mono text-sm font-semibold text-muted-foreground tabular-nums" aria-hidden>
          ×?
        </span>
      </div>
      <div aria-hidden className="mt-3.5 space-y-2 select-none">
        <span className="block h-4 rounded-full bg-muted-foreground/25 blur-[3px]" style={{ width: nameWidth }} />
        <span className="block h-2.5 w-full rounded-full bg-muted-foreground/15 blur-[3px]" />
        <span className="block h-2.5 w-2/3 rounded-full bg-muted-foreground/15 blur-[3px]" />
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 bottom-1 font-display text-6xl leading-none text-muted-foreground/15 italic select-none"
      >
        ?
      </span>
      <p className="mt-auto pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Lock className="size-3" aria-hidden /> Roll to unlock
        </span>
      </p>
    </article>
  )
}
