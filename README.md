# RNGWorlde

Press Generate and the dictionary deals you a random English word. The score — with every factor that made it — is the game. Roll again whenever you want.

There is no shared answer and no account. The latest word is stored in this browser’s `localStorage`.

## Run

```bash
npm install
npm run precompute
npm test
npm run dev
```

Open [http://127.0.0.1:4721](http://127.0.0.1:4721). The dev server listens on `0.0.0.0:4721`.

`npm run precompute` rebuilds `public/words.txt` and `src/data/histogram.json` from `data/enable1.txt`. Commit those generated files with any scoring change so the tiers stay honest. You only need to rerun it after editing the scorer or the word list.

## Word list

The list is **ENABLE1** (Enhanced North American Benchmark Lexicon), a public-domain word list compiled by Alan Beale for word games. It is vendored as `data/enable1.txt` from the public-domain `enable1.txt` in [dolph/dictionary](https://github.com/dolph/dictionary).

ENABLE1 is already lowercase `a–z` dictionary words: no proper nouns, no abbreviations, no punctuation. The precompute step keeps entries of at least two letters and drops anything that isn’t plain letters. The bundled list runs from 2-letter words through 28-letter words (172,823 words), so both ends of the length multiplier have something to do.

## Scoring

The base is the Scrabble tile sum. Everything else multiplies it. The breakdown shows each multiplier, and a miss stays an em dash.

**Tile pile.** Standard English Scrabble values: A E I O U L N S T R = 1, D G = 2, B C M P = 3, F H V W Y = 4, K = 5, J X = 8, Q Z = 10. Y is always a consonant here.

**Length.** ×1 at 9 letters, the average and the median in this list. Each step shorter doubles the multiplier. Each step longer adds 1.

| Letters | Multiplier |
| --- | --- |
| 2 | ×128 |
| 3 | ×64 |
| 4 | ×32 |
| 5 | ×16 |
| 6 | ×8 |
| 7 | ×4 |
| 8 | ×2 |
| 9 | ×1 |
| 10 | ×2 |
| 11 | ×3 |
| 12 | ×4 |
| 15 | ×7 |
| 20 | ×12 |

**Factors.** A hit multiplies the running total once. The multiplier is `round(3 × log10(list size / matches))`, at least ×2, counted on all 172,823 words.

| Name | When it hits | Matches | Multiplier |
| --- | --- | --- | --- |
| Twins | A letter repeated back to back | 41,209 | ×2 |
| Double twins | Two runs of exactly two identical letters sitting against each other, like ffee in coffee. A run of three or more of the same letter is not a pair. Three pairs in a row also hit | 223 | ×9 |
| Triple twins | Three runs of exactly two identical letters in a row, like ookkee in bookkeeper. A run of three or more of the same letter is not a pair | 4 | ×14 |
| No repeats | Every letter is different | 34,816 | ×2 |
| Even company | Every distinct letter appears exactly twice. A letter that appears once, or three or more times, misses. The card lights the whole word | 92 | ×10 |
| Inside | A dictionary word of at least 3 letters sits inside. The whole word does not count. Each match multiplies once, including a word nested in a longer match | 167,370 | ×2 |
| Anagram | A different dictionary word uses exactly the same letters. The word itself does not count. Each anagram multiplies once. This one is ×4 per anagram, not the rarity formula | 28,648 | ×4 |
| Next door | First and last letters are neighbours in the alphabet | 16,304 | ×3 |
| Bookends | The first two letters match the last two, in the same order. At least 4 letters, so the two spans do not overlap. The card lights those four letters | 415 | ×8 |
| Contraband | Contains J, Q, X, or Z | 16,286 | ×3 |
| Ing | Ends in -ing, and the word is longer than the ending | 12,564 | ×3 |
| Flat type | No ascenders (b, d, f, h, k, l, t) and no descenders (g, j, p, q, y). The dot on i does not count | 6,069 | ×4 |
| Vowel rich | More A, E, I, O, U than consonants | 5,979 | ×4 |
| One vowel wonder | At least 3 vowels, and every one of them is the same vowel. Y does not count | 2,856 | ×5 |
| Perfect balance | An equal number of vowels and consonants. Y counts as a consonant. A word with no vowels misses | 17,684 | ×3 |
| Alternator | Vowels and consonants alternate through the whole word. Y counts as a consonant. A one-letter word misses | 11,453 | ×4 |
| Consonant chain | Longest unbroken run of consonants, when that run is at least 2. Vowels are A, E, I, O, U. Y is a consonant. A run of 1 gets no card. The card lights that run and shows its length. Multipliers, from how rare a run at least that long is: 2 → ×2, 3 → ×3, 4 → ×4, 5 → ×6, 6 → ×8, 7 → ×11, 8 → ×12, 9 → ×13. Length 3 was tied with length 2 and raised by 1 | 151,998 | by length |
| Vowel chain | Longest unbroken run of A, E, I, O, or U, when that run is at least 2. Y is a consonant. A run of 1 gets no card. The card lights that run and shows its length. Multipliers: 2 → ×2, 3 → ×6, 4 → ×10, 5 → ×14 | 63,104 | by length |
| Vowel sweep | A, E, I, O, and U all appear | 2,462 | ×6 |
| I before E | “ei” with no c in front, or “ie” right after c | 2,169 | ×6 |
| Ist | Ends in -ist, and the word is longer than the ending | 1,197 | ×6 |
| Quiet letters | Starts with kn, gn, wr, ps, or rh, or ends in mb | 1,088 | ×7 |
| Ish | Ends in -ish, and the word is longer than the ending | 554 | ×7 |
| Alphabet soup | At least 4 letters, each the same as or later than the last | 411 | ×8 |
| Backwards alphabet | The whole word runs in non-increasing alphabetical order. Each letter is the same as or earlier than the one before it. Repeats are allowed. One-letter words miss. The card lights the whole word | 432 | ×8 |
| Bone dry | No A, E, I, O, or U | 121 | ×9 |
| Mirror | Palindrome, at least 3 letters | 101 | ×10 |
| Lone Q | A Q that is not followed by U | 29 | ×11 |
| A to U | A, E, I, O, U appear in that order | 28 | ×11 |
| A cappella | Every letter is A, E, I, O, or U | 5 | ×14 |
| Rewind | Backwards, it is a different word in this list. A palindrome stays Mirror | 844 | ×7 |
| Ditto | The second half repeats the first, at least 4 letters | 59 | ×10 |
| From Latin | Wiktionary traces a borrowing, inheritance, or derivation to Latin | 30,078 | ×2 |
| From French | Wiktionary traces it to French, including Old French and Anglo-Norman | 24,550 | ×3 |
| From Old English | Wiktionary traces it to Old English | 12,877 | ×3 |
| From Greek | Wiktionary traces it to Greek | 7,238 | ×4 |
| From Proto-Indo-European | Wiktionary traces it to Proto-Indo-European | 10,667 | ×4 |
| From Proto-Germanic | Wiktionary traces it to Proto-Germanic | 10,509 | ×4 |
| From Proto-West Germanic | Wiktionary traces it to Proto-West Germanic | 7,831 | ×4 |
| From German | Wiktionary traces it to German | 3,003 | ×5 |
| From Italian | Wiktionary traces it to Italian | 2,147 | ×6 |
| From Norse | Wiktionary traces it to Old Norse or North Germanic | 2,861 | ×5 |
| From Dutch | Wiktionary traces it to Dutch | 2,403 | ×6 |
| From Spanish | Wiktionary traces it to Spanish | 1,581 | ×6 |
| From Arabic | Wiktionary traces it to Arabic | 923 | ×7 |
| From East Asia | Wiktionary traces it to Chinese or Japanese | 811 | ×7 |
| From Frankish | Wiktionary traces it to Frankish | 1,267 | ×6 |
| From Low German | Wiktionary traces it to Low German or Old Saxon | 1,041 | ×7 |
| From Irish | Wiktionary traces it to Irish | 760 | ×7 |
| From Hindi | Wiktionary traces it to Hindi or Hindustani | 492 | ×8 |
| From Hebrew | Wiktionary traces it to Hebrew | 499 | ×8 |
| From Portuguese | Wiktionary traces it to Portuguese | 493 | ×8 |
| From Sanskrit | Wiktionary traces it to Sanskrit | 427 | ×8 |
| From Persian | Wiktionary traces it to Persian | 439 | ×8 |
| From Scots | Wiktionary traces it to Scots | 513 | ×8 |
| From Russian | Wiktionary traces it to Russian | 309 | ×8 |
| From Yiddish | Wiktionary traces it to Yiddish | 323 | ×8 |
| From Proto-Celtic | Wiktionary traces it to Proto-Celtic | 387 | ×8 |
| From Ottoman Turkish | Wiktionary traces it to Ottoman Turkish or Turkish | 254 | ×8 |
| From Scottish Gaelic | Wiktionary traces it to Scottish Gaelic | 305 | ×8 |
| From Proto-Italic | Wiktionary traces it to Proto-Italic | 371 | ×8 |
| From Gaulish | Wiktionary traces it to Gaulish | 279 | ×8 |
| From Swedish | Wiktionary traces it to Swedish | 214 | ×9 |
| Sound word | Webster 1913 marks the word as imitative | 49 | ×11 |
| From Afrikaans | Wiktionary traces it to Afrikaans | 100 | ×10 |

Origin tags are built offline from English Wiktionary, using the [kaikki.org](https://kaikki.org/dictionary/English/index.html) wiktextract dump, and shipped with the game. Wiktionary text is available under [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/). Only borrowed-from, inherited-from, and derived-from templates count. A cognate mentioned as “akin to” does not. A hop through Middle English, or through another modern English stage, is followed to that word’s own borrowed, inherited, or derived templates. There is no From Middle English card. An inflected form inherits the lemma’s origin languages. That copy uses Wiktionary’s form-of link when the entry says this word is a form of another English word. A regular stem is used only when that link is missing and exactly one ENABLE stem is unambiguous. Compounds such as computer and email stay without an origin from this pass. 57,920 of the 172,823 ENABLE words have at least one of these origins. A miss means Wiktionary has no usable origin for that language. The sound-word row is still the public-domain note in Webster’s Revised Unabridged Dictionary (1913).

Rewind and Ditto need no outside list. Rewind is a semordnilap. Ditto is a tautonym. Palindromes were already Mirror. Noun, verb, and adjective still need part-of-speech tags this list does not have. No vowels is already Bone dry, and a doubled letter is already Twins.

**Rarity.** The total is ranked against the precomputed score of every bundled word. “Beats n%” means the share of the list with a strictly lower score. Ties do not count as beaten.

| Tier | Standing |
| --- | --- |
| Mythic | Beats at least 99% |
| Epic | Beats at least 95% |
| Rare | Beats at least 85% |
| Uncommon | Beats at least 65% |
| Common | Beats at least 35% |
| Trash | Beats under 35% |

## Rolls

Generate picks uniformly from the list (rejection sampling on `crypto.getRandomValues`) and stores the latest `{ date, word }` under `rngworlde.roll.v1`, so a refresh keeps the word on screen. There is no daily limit. Nothing is sent to a server.
