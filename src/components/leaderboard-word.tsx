"use client"

import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { retryScore, useScored } from "@/lib/score-client"
import { formatRowValue } from "@/lib/tiles"
import { cn } from "@/lib/utils"

export function LeaderboardWord({ word, className, children }: {
  word: string
  className?: string
  children?: ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        aria-label={`Show cards for ${word}`}
        className={cn("cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4", className)}
      >
        {children ?? word}
      </DialogTrigger>
      <DialogContent className="max-h-[80dvh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="font-display text-3xl break-words italic">{word}</DialogTitle>
          <DialogDescription>Cards triggered by this word.</DialogDescription>
        </DialogHeader>
        <TriggeredCards word={word} />
      </DialogContent>
    </Dialog>
  )
}

function TriggeredCards({ word }: { word: string }) {
  const scored = useScored(word)
  const cards = scored && scored !== "error"
    ? scored.rows.filter((row) => row.scored && row.id !== "tiles")
    : []

  return (
    <div className="min-h-0 overflow-y-auto overscroll-contain">
      {scored === "error" ? (
        <div>
          <p role="status">Couldn’t load the cards.</p>
          <button type="button" className="mt-2 cursor-pointer underline underline-offset-4" onClick={() => retryScore(word)}>
            Try again
          </button>
        </div>
      ) : !scored ? (
        <p role="status">Loading cards…</p>
      ) : cards.length === 0 ? (
        <p>This word triggered no cards.</p>
      ) : (
        <ul className="grid gap-2">
          {cards.map((card, index) => (
            <li key={`${card.id}-${index}`} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{card.name}</span>
                <span className="shrink-0 font-mono text-foreground tabular-nums">{formatRowValue(card)}</span>
              </div>
              {card.reason ? <p className="mt-1 text-muted-foreground">{card.reason}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
