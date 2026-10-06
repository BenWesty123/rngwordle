import type { Tile } from "@/lib/tiles";
import { cn } from "@/lib/utils";

/** Shared with the empty slots that hold a short word in the fixed track. */
export function tileSizeClass(length: number, small = false): string {
  if (length > 16) return "h-8 w-7 text-base";
  if (small) return "h-9 w-7 text-lg sm:w-8";
  return "h-11 w-9 text-xl sm:h-12 sm:w-10 sm:text-2xl";
}

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
  concealed = false,
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
  /** Flicker glyphs that haven't resolved into the word yet. */
  concealed?: boolean;
}) {
  return (
    <li
      aria-hidden={concealed || undefined}
      className={cn(
        "tile-face relative flex items-center justify-center rounded-[5px] font-display uppercase transition-[opacity,filter] duration-300",
        tileSizeClass(length, small),
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
