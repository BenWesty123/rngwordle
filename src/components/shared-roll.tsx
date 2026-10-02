"use client"

import Link from "next/link"
import { TileBox } from "@/components/tile"
import { cardRarity, RARITY_STAMP } from "@/lib/card-rarity"
import { useScored } from "@/lib/score-client"
import { formatStanding, topCards } from "@/lib/share"
import { standingFor } from "@/lib/standing"
import { TIER_STYLE } from "@/lib/tier-style"
import { tilesFor } from "@/lib/tiles"
import { cn } from "@/lib/utils"

/**
 * The page a shared link opens. The tiles show straight away; the score and best
 * cards follow from /api/score. The point is the button: roll your own.
 */
export function SharedRoll({ word }: { word: string }) {
  const tiles = tilesFor(word)
  const state = useScored(word)
  const scored = state && state !== "error" ? state : null
  const standing = scored ? standingFor(scored.total) : null
  const tone = standing ? TIER_STYLE[standing.tier.id] : null
  const cards = scored ? topCards(scored) : []

  return (
    <main className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      {tone ? <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-[32rem]", tone.glow)} /> : null}
      <p className="relative text-[11px] tracking-[0.28em] text-muted-foreground uppercase">A friend&apos;s word of the day</p>
      <ul className="relative mt-5 flex flex-wrap justify-center gap-1.5" aria-label={word}>
        {tiles.map((tile, index) => (
          <TileBox key={`${tile.letter}-${index}`} tile={tile} length={tiles.length} dropDelay={index * 70} />
        ))}
      </ul>

      <div className="relative mt-6 flex min-h-28 flex-col items-center">
        {scored && standing && tone ? (
          <div className="row-in flex flex-col items-center">
            <p className="font-mono text-5xl leading-none tabular-nums sm:text-6xl">{scored.total.toLocaleString("en-US")}</p>
            <p className={cn("mt-4 inline-flex rounded-full border px-3 py-1 text-[11px] tracking-[0.22em] uppercase", tone.badge)}>
              {standing.tier.label}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{formatStanding(standing.beaten)}</p>
            {cards.length > 0 ? (
              <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Best cards">
                {cards.map((card) => (
                  <li
                    key={card.name}
                    className={cn("rounded-md border-2 bg-background px-2.5 py-1 text-sm font-medium", RARITY_STAMP[cardRarity(card.points)])}
                  >
                    {card.name} <span className="font-mono">×{card.points.toLocaleString("en-US")}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : state === "error" ? null : (
          <p className="text-sm text-muted-foreground" role="status">
            Adding up the score…
          </p>
        )}
      </div>

      <div className="relative mt-10 flex w-full max-w-xs flex-col items-center">
        <p className="font-display text-2xl tracking-tight italic">Can you do better?</p>
        <Link
          href="/"
          className="mt-4 inline-flex h-14 w-full items-center justify-center rounded-lg bg-primary text-base font-medium text-primary-foreground shadow-lg shadow-black/20 transition-colors hover:bg-primary/85"
        >
          Roll your own word
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">Free, and no sign-up needed.</p>
        <Link href="/leaderboard" className="mt-5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          See today&apos;s leaderboard
        </Link>
      </div>
    </main>
  )
}
