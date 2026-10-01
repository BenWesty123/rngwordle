import type { Tile } from "@/lib/tiles";
import { cn } from "@/lib/utils";

/** One Scrabble tile. No hooks, so the leaderboard can render it on the server. */
export function TileBox({
  tile,
  length,
  lit = false,
  dim = false,
  fresh = false,
  shaking = false,
  small = false,
  dropDelay,
}: {
  tile: Tile;
  length: number;
  lit?: boolean;
  dim?: boolean;
  fresh?: boolean;
  shaking?: boolean;
  /** Multiplier cards use a smaller tile so long words stay on one line. */
  small?: boolean;
  /** Stagger for a row that drops in all at once, in ms. */
  dropDelay?: number;
}) {
  return (
    <li
      className={cn(
        "tile-face relative flex items-center justify-center rounded-[5px] font-display uppercase transition-[transform,opacity,filter] duration-300",
        length > 16 ? "h-8 w-7 text-base" : small ? "h-9 w-7 text-lg sm:w-8" : "h-11 w-9 text-xl sm:h-12 sm:w-10 sm:text-2xl",
        tile.rare && "tile-rare",
        tile.twin && "ring-2 ring-[oklch(0.5_0.07_58/0.35)] ring-inset",
        lit && "tile-lit",
        dim && "tile-dim",
        (fresh || dropDelay != null) && "tile-drop",
        shaking && "tile-jiggle",
      )}
      style={dropDelay != null ? { animationDelay: `${dropDelay}ms` } : shaking ? { animationDelay: `${-tile.value * 37}ms` } : undefined}
      title={tile.rare ? "Rare letter" : tile.twin ? "Double letter" : undefined}
      data-letter={tile.letter}
      data-points={tile.value}
    >
      {tile.letter}
      <span className="absolute right-1 bottom-0.5 font-mono text-[9px] leading-none not-italic opacity-60">{tile.value}</span>
    </li>
  );
}
