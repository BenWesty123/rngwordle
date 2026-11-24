import { RARITY_BADGE, type CardRarity } from "@/lib/card-rarity"
import { cn } from "@/lib/utils"

const RARITY_SIZE = {
  Common: "px-1.5 py-0.5 text-[10px]",
  Uncommon: "px-2 py-0.5 text-[11px]",
  Rare: "px-2.5 py-1 text-xs",
  Epic: "px-3 py-1.5 text-sm",
  Legendary: "px-3.5 py-1.5 text-base",
} as const

export function CardRarityPill({ rarity }: { rarity: CardRarity }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center rounded-full border leading-none font-medium", RARITY_BADGE[rarity], RARITY_SIZE[rarity])}
      data-rarity={rarity}
    >
      {rarity}
    </span>
  )
}
