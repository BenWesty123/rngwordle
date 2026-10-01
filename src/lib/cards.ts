import { cardKey } from "@/lib/card-key"
import { cardRarity, type CardRarity } from "@/lib/card-rarity"
import {
  CONSONANT_CHAIN_MULTIPLIERS,
  FACTOR_MULTIPLIERS,
  lengthMultiplier,
  LENGTH_COUNTS,
  PER_HIT_MULTIPLIERS,
  scoreWord,
  stackMultiplier,
  STACK_MATCHES,
  VOWEL_CHAIN_MULTIPLIERS,
  type FactorId,
  type PerHitFactorId,
  type StackedFactorId,
} from "@/lib/scoring"

/** The card collection. Server-only: it reads the scorer for names and multipliers. */

export const CARD_CATEGORIES = [
  "Mirrors and flips",
  "Word families",
  "Letter patterns",
  "Vowels and consonants",
  "Codes and keyboards",
  "Hidden inside",
  "Origins",
] as const

export type CardCategory = (typeof CARD_CATEGORIES)[number]

export type Card = {
  id: string
  name: string
  category: CardCategory
  /** How to earn it, in one line. */
  blurb: string
  /** What it pays, such as ×19, ×2 each, or ×5+. */
  value: string
  rarity: CardRarity
}

/**
 * What the collection page gets for one card. A locked card carries only its
 * opaque key, rarity, theme, and name length; card is filled in once found.
 */
export type CatalogEntry = {
  key: string
  rarity: CardRarity
  category: CardCategory
  nameLength: number
  card?: Card
}

export function catalogEntry(card: Card, found: boolean): CatalogEntry {
  const entry: CatalogEntry = { key: cardKey(card.id), rarity: card.rarity, category: card.category, nameLength: card.name.length }
  if (found) entry.card = card
  return entry
}

/** Cards a player has found that were not there before this word. */
export function newCards(word: string, earlierWords: readonly string[]): string[] {
  const earlier = new Set(earlierWords.flatMap((earlierWord) => cardsInWord(earlierWord)))
  return cardsInWord(word).filter((id) => !earlier.has(id))
}

const INFO: Record<string, { category: CardCategory; blurb: string }> = {
  length: { category: "Letter patterns", blurb: "A rare length: very short or very long." },
  mirror: { category: "Mirrors and flips", blurb: "Reads the same backwards." },
  "hidden-mirror": { category: "Mirrors and flips", blurb: "A palindrome of 5+ letters hides inside." },
  rewind: { category: "Mirrors and flips", blurb: "Backwards, it spells a different word." },
  ditto: { category: "Mirrors and flips", blurb: "The second half repeats the first, like bonbon." },
  "looking-glass": { category: "Mirrors and flips", blurb: "A palindrome that also reads right in a mirror, like OTTO." },
  "upside-down": { category: "Mirrors and flips", blurb: "Reads the same turned upside down, like SOLOS." },
  "inside-out": { category: "Mirrors and flips", blurb: "Move the first letter to the end to make a new word." },
  inside: { category: "Word families", blurb: "Every dictionary word hiding inside it." },
  anagram: { category: "Word families", blurb: "Every other word made of the same letters." },
  "letter-sandwich": { category: "Word families", blurb: "Remove the first and last letters to leave a word." },
  "front-or-back": { category: "Word families", blurb: "Drop the first letter or the last: both leave words." },
  "shrinking-word": { category: "Word families", blurb: "Delete one letter at a time through a chain of 5 words." },
  "swap-shop": { category: "Word families", blurb: "Swap two neighbouring letters to make a word." },
  "alphabet-step": { category: "Word families", blurb: "Nudge one letter to its alphabet neighbour to make a word." },
  "lonely-word": { category: "Word families", blurb: "No other word is one letter change away." },
  popular: { category: "Word families", blurb: "8 or more words are one letter change away." },
  "double-or-nothing": { category: "Word families", blurb: "Double a letter, or undo a double, to make a word." },
  "woven-together": { category: "Word families", blurb: "The odd and even letters each spell a word." },
  "building-blocks": { category: "Word families", blurb: "4 or more growing prefixes are all words." },
  "alphabet-twins": { category: "Word families", blurb: "Another word uses the same letters in different amounts." },
  twins: { category: "Letter patterns", blurb: "A letter sits next to itself." },
  "double-twins": { category: "Letter patterns", blurb: "Two doubled pairs in a row, like coffee." },
  "triple-twins": { category: "Letter patterns", blurb: "Three doubled pairs in a row, like bookkeeper." },
  "no-repeats": { category: "Letter patterns", blurb: "Every letter is different." },
  "even-company": { category: "Letter patterns", blurb: "Every letter appears exactly twice." },
  "perfectly-shared": { category: "Letter patterns", blurb: "Every letter appears equally often, in a way no other card covers." },
  contraband: { category: "Letter patterns", blurb: "Contains J, Q, X, or Z." },
  "alphabet-soup": { category: "Letter patterns", blurb: "4+ letters in alphabetical order." },
  "backwards-alphabet": { category: "Letter patterns", blurb: "Letters in reverse alphabetical order." },
  "letter-collector": { category: "Letter patterns", blurb: "Six alphabet neighbours appear, like A to F." },
  "alphabet-staircase": { category: "Letter patterns", blurb: "Three alphabet letters in a row, like HIJ." },
  "next-door": { category: "Letter patterns", blurb: "The first and last letters are alphabet neighbours." },
  bookends: { category: "Letter patterns", blurb: "Starts and ends with the same two letters." },
  "a-to-z": { category: "Letter patterns", blurb: "Starts with A and ends with Z." },
  "lone-q": { category: "Letter patterns", blurb: "A Q with no U after it." },
  bingo: { category: "Letter patterns", blurb: "Exactly 7 letters: a full Scrabble rack." },
  "flat-type": { category: "Letter patterns", blurb: "No letter climbs above or dips below the line." },
  "quiet-letters": { category: "Letter patterns", blurb: "A silent start like KN or PS, or a silent MB ending." },
  "a-cappella": { category: "Vowels and consonants", blurb: "Every letter is a vowel." },
  "bone-dry": { category: "Vowels and consonants", blurb: "No vowels at all." },
  "vowel-sweep": { category: "Vowels and consonants", blurb: "Uses all five vowels." },
  "vowel-rich": { category: "Vowels and consonants", blurb: "More vowels than consonants." },
  "one-vowel-wonder": { category: "Vowels and consonants", blurb: "3 or more vowels, all the same one." },
  "perfect-balance": { category: "Vowels and consonants", blurb: "As many vowels as consonants." },
  alternator: { category: "Vowels and consonants", blurb: "Vowels and consonants take turns." },
  "consonant-chain": { category: "Vowels and consonants", blurb: "3 or more consonants in a row." },
  "vowel-chain": { category: "Vowels and consonants", blurb: "2 or more vowels in a row." },
  "a-to-u": { category: "Vowels and consonants", blurb: "A, E, I, O, U appear in that order." },
  "u-to-a": { category: "Vowels and consonants", blurb: "U, O, I, E, A appear in that order." },
  "i-before-e": { category: "Vowels and consonants", blurb: "Breaks the I-before-E rule." },
  "roman-word": { category: "Codes and keyboards", blurb: "Only Roman numeral letters: I V X L C D M." },
  "periodic-spelling": { category: "Codes and keyboards", blurb: "Spelled with chemical element symbols." },
  "calculator-word": { category: "Codes and keyboards", blurb: "Spells itself on an upside-down calculator." },
  "sheet-music": { category: "Codes and keyboards", blurb: "Only the notes A to G, and it plays a tune." },
  "morse-mirror": { category: "Codes and keyboards", blurb: "Its Morse code reads the same backwards." },
  "all-dots": { category: "Codes and keyboards", blurb: "Only dots in Morse: E, I, S, and H." },
  typewriter: { category: "Codes and keyboards", blurb: "Typed on the top row of keys alone." },
  "home-row": { category: "Codes and keyboards", blurb: "Typed on the home row of keys alone." },
  "left-handed": { category: "Codes and keyboards", blurb: "Touch-typed with the left hand alone." },
  "right-handed": { category: "Codes and keyboards", blurb: "Touch-typed with the right hand alone." },
  "hand-to-hand": { category: "Codes and keyboards", blurb: "Your hands take turns on every letter." },
  "keyboard-walk": { category: "Codes and keyboards", blurb: "Each letter touches the next key over." },
  "hidden-number": { category: "Hidden inside", blurb: "A number from one to twelve hides inside." },
  "hidden-animal": { category: "Hidden inside", blurb: "An animal hides inside." },
  ing: { category: "Hidden inside", blurb: "Ends in -ing." },
  ish: { category: "Hidden inside", blurb: "Ends in -ish." },
  ist: { category: "Hidden inside", blurb: "Ends in -ist." },
  "sound-word": { category: "Hidden inside", blurb: "Sounds like what it means, like buzz." },
}

function originBlurb(name: string): string {
  if (name === "From East Asia") return "Wiktionary traces it to Chinese or Japanese."
  return `Wiktionary traces it to ${name.replace(/^From /, "")}.`
}

/** What a card pays, and the smallest value it can score at, for its rarity band. */
function valueOf(id: string): { label: string; lowest: number } {
  if (id === "length") {
    const scoring = Object.keys(LENGTH_COUNTS)
      .map((length) => lengthMultiplier(Number(length)))
      .filter((value) => value > 1)
    return { label: `×${Math.min(...scoring)} to ×${Math.max(...scoring)}`, lowest: Math.min(...scoring) }
  }
  if (id === "consonant-chain" || id === "vowel-chain") {
    const table = id === "consonant-chain" ? CONSONANT_CHAIN_MULTIPLIERS : VOWEL_CHAIN_MULTIPLIERS
    const lowest = Math.min(...Object.values(table).filter((value) => value > 1))
    return { label: `×${lowest}+`, lowest }
  }
  if (id in PER_HIT_MULTIPLIERS) {
    const each = PER_HIT_MULTIPLIERS[id as PerHitFactorId]
    return { label: `×${each} each`, lowest: each }
  }
  if (id in STACK_MATCHES) {
    const lowest = stackMultiplier(id as StackedFactorId, 1)
    return { label: `×${lowest}+`, lowest }
  }
  const value = FACTOR_MULTIPLIERS[id as FactorId]
  return { label: `×${value}`, lowest: value }
}

let catalog: Card[] | null = null

/** Every card a roll can earn. A card that can never score (×1) is left out. */
export function cardCatalog(): Card[] {
  if (catalog) return catalog
  const named = scoreWord("xq").rows.filter((row) => row.id !== "tiles")
  catalog = named.flatMap((row) => {
    const { label, lowest } = valueOf(row.id)
    if (lowest <= 1) return []
    const name = row.name.replace(/ ×\d+$/, "")
    const info = INFO[row.id] ?? (row.id.startsWith("from-") ? { category: "Origins" as const, blurb: originBlurb(name) } : null)
    if (!info) throw new Error(`Card ${row.id} has no catalog entry`)
    return [{ id: row.id, name, category: info.category, blurb: info.blurb, value: label, rarity: cardRarity(lowest) }]
  })
  return catalog
}

/** Card ids a word scores. */
export function cardsInWord(word: string): string[] {
  return [...new Set(scoreWord(word).rows.filter((row) => row.scored && row.id !== "tiles").map((row) => row.id))]
}
