import blockedWords from "@/data/blocked-words.json"

/**
 * Slurs from data/blocked-words.txt (precompute writes the JSON). The game never
 * deals them; this module keeps them out of usernames, boards, and share links too.
 */
const BLOCKED = new Set(blockedWords as string[])

/** Usernames often use slurs the dictionary doesn't list. */
const USERNAME_ONLY = ["nigga", "niggas"]

/**
 * Matched anywhere inside a username, even run together with other words.
 * Only long, unambiguous slurs: short ones (coon, spic) live inside ordinary
 * words like raccoon and spicy, so those must stand alone as a piece of the name.
 */
const ANYWHERE = ["nigger", "nigga", "faggot", "wetback", "jigaboo", "golliwog", "pickaninny", "poofter", "redskin"]

/** Look-alike characters people swap in to dodge filters. */
const LOOKALIKE: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "l",
}

/** Each letter may repeat, but never drop below its count in the slur, so "niger" (the river) isn't "nigger". */
function stretchy(word: string): RegExp {
  let pattern = ""
  for (let index = 0; index < word.length; ) {
    let end = index + 1
    while (word[end] === word[index]) end += 1
    pattern += `${word[index]}{${end - index},}`
    index = end
  }
  return new RegExp(pattern)
}

const ANYWHERE_PATTERNS = ANYWHERE.map(stretchy)

export function isBlockedWord(word: string): boolean {
  return BLOCKED.has(word.toLowerCase())
}

export function isBlockedUsername(name: string): boolean {
  const plain = [...name.toLowerCase()].map((char) => LOOKALIKE[char] ?? char).join("")
  const pieces = plain.split(/[^a-z]+/).filter(Boolean)
  for (const piece of pieces) {
    if (BLOCKED.has(piece) || USERNAME_ONLY.includes(piece)) return true
  }
  const joined = pieces.join("")
  return ANYWHERE_PATTERNS.some((pattern) => pattern.test(joined))
}

/** What a board shows for a username that's not allowed. */
export const HIDDEN_NAME = "Hidden player"

export function displayName(username: string): string {
  return isBlockedUsername(username) ? HIDDEN_NAME : username
}
