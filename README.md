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
| No repeats | Every letter is different | 34,816 | ×2 |
| Inside | A dictionary word of at least 3 letters sits inside. The whole word does not count. Each match multiplies once, including a word nested in a longer match | 167,370 | ×2 |
| Next door | First and last letters are neighbours in the alphabet | 16,304 | ×3 |
| Contraband | Contains J, Q, X, or Z | 16,286 | ×3 |
| Ing | Ends in -ing, and the word is longer than the ending | 12,564 | ×3 |
| Flat type | No ascenders (b, d, f, h, k, l, t) and no descenders (g, j, p, q, y). The dot on i does not count | 6,069 | ×4 |
| Vowel rich | More A, E, I, O, U than consonants | 5,979 | ×4 |
| Vowel sweep | A, E, I, O, and U all appear | 2,462 | ×6 |
| I before E | “ei” with no c in front, or “ie” right after c | 2,169 | ×6 |
| Ist | Ends in -ist, and the word is longer than the ending | 1,197 | ×6 |
| Quiet letters | Starts with kn, gn, wr, ps, or rh, or ends in mb | 1,088 | ×7 |
| Ish | Ends in -ish, and the word is longer than the ending | 554 | ×7 |
| Alphabet soup | At least 4 letters, each the same as or later than the last | 411 | ×8 |
| Bone dry | No A, E, I, O, or U | 121 | ×9 |
| Mirror | Palindrome, at least 3 letters | 101 | ×10 |
| Lone Q | A Q that is not followed by U | 29 | ×11 |
| A to U | A, E, I, O, U appear in that order | 28 | ×11 |
| A cappella | Every letter is A, E, I, O, or U | 5 | ×14 |
| Rewind | Backwards, it is a different word in this list. A palindrome stays Mirror | 844 | ×7 |
| Ditto | The second half repeats the first, at least 4 letters | 59 | ×10 |
| From Greek | Webster 1913 traces the word to Greek | 1,227 | ×6 |
| From Italian | Webster 1913 traces the word to Italian | 369 | ×8 |
| From Dutch | Webster 1913 traces the word to Dutch | 119 | ×9 |
| From Norse | Webster 1913 traces the word to Norse (cited there as Icelandic) | 86 | ×10 |
| From Arabic | Webster 1913 traces the word to Arabic | 102 | ×10 |
| Sound word | Webster 1913 marks the word as imitative | 49 | ×11 |
| From Persian | Webster 1913 traces the word to Persian | 48 | ×11 |
| From Hindi | Webster 1913 traces the word to Hindustani | 42 | ×11 |
| From Sanskrit | Webster 1913 traces the word to Sanskrit | 31 | ×11 |
| From Hebrew | Webster 1913 traces the word to Hebrew | 24 | ×12 |
| From East Asia | Webster 1913 traces the word to Chinese or Japanese | 13 | ×12 |

There is no API that covers every word in this list with a reliable origin. The origin and sound-word rows use the public-domain etymologies in Webster’s Revised Unabridged Dictionary (1913), parsed as the EnglishWordOrigins table from Project Gutenberg. About 19,000 of the 172,823 words have an etymology there. A miss means that etymology does not trace the word, not that the origin is impossible. Cognates mentioned only with “akin to” do not count. Latin and French are in that dictionary and were left off the card because they would fire on thousands of ordinary learned words. Spanish is in the data too, and was left off so the card would not grow by another common European loan.

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
