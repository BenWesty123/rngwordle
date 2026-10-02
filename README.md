# RWGdle

Press Generate and the dictionary deals you a random English word. The score — with every factor that made it — is the game.

Every generate is saved on the leaderboard. Logged-out rows are named Anonymous. Log in to put a username on your one roll per UTC day.

## Run

```bash
npm install
npm run precompute
npm test
npm run dev
```

Open [http://127.0.0.1:4721](http://127.0.0.1:4721). The dev server listens on `0.0.0.0:4721`.

`npm run precompute` rebuilds `public/words.txt` and `src/data/histogram.json` from `data/enable1.txt`. Commit those generated files with any scoring change so the tiers stay honest. You only need to rerun it after editing the scorer or the word list.

## Cloudflare

The Worker config is `wrangler.jsonc` and `open-next.config.ts`. D1 binding name: `DB`. Database name: `rngwordle`. Email binding name: `EMAIL`, from `login@rwgdle.app`. Schema: `migrations/0001_accounts.sql`. `npm run dev` does not use that database or send mail. It keeps using `data/local.sqlite` and prints the login link in the server log. `npm run deploy` builds with OpenNext and deploys the Worker, including the `EMAIL` binding.

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
| Perfectly shared | Every distinct letter occurs the same number of times. A count of one counts, so a word with no repeated letters hits. A single-letter word hits when it is in the list. noon hits, because n and o each occur twice. book misses, because the counts differ. Only a–z letters count, ignoring case. One card per word, and it lights the whole word | 34,909 | ×2 |
| Inside | A dictionary word of at least 3 letters sits inside. The whole word does not count. Each match multiplies once, including a word nested in a longer match | 167,370 | ×2 |
| Letter sandwich | Removing the first and last letters leaves an ENABLE word of at least 3 letters. Shorter words miss. The card lights that middle and names it | 7,298 | ×4 |
| Front or back | The word with its first letter removed and the word with its last letter removed are both ENABLE words. If only one is a word, it misses. The card names both and lights the whole word | 5,031 | ×5 |
| Shrinking word | A chain of at least 5 ENABLE words, counting this word, each made by deleting one letter from anywhere in the previous word. The card names the chain and lights the whole word | 9,924 | ×4 |
| Inside out | Moving the first letter to the end makes a different ENABLE word. The same spelling again misses. The card names that word and lights the whole rolled word | 1,061 | ×7 |
| Swap shop | Swapping two different adjacent letters makes a different ENABLE word. Each pair is its own card, lighting those two letters and naming the word. Identical letters and non-adjacent swaps do not count | 2,815 | ×5 |
| Alphabet step | Changing exactly one letter to its immediate alphabetical neighbour makes a different ENABLE word. A only steps to B, and Z only steps to Y. Each change is its own card, lighting that letter and naming the word | 16,735 | ×3 |
| Lonely word | No other ENABLE word is one insertion, deletion, or substitution away. The word itself does not count. Swapping letters does not count. The empty string is not a word, so a one-letter word can still hit. The card lights the whole word | 35,181 | ×2 |
| Double or nothing | Doubling one single letter, or undoing one exact doubled pair, makes another ENABLE word. Both words score. The shorter word lights the single letter and names the longer word. The longer word lights the pair and names the shorter word. A run of three or more does not count | 5,429 | ×5 |
| Two words woven together | Odd positions spell one ENABLE word and even positions spell another, counting from 1. Both strands are at least 2 letters, so a word shorter than 4 misses. One card names the odd word, then the even word, and lights the whole word | 1,490 | ×6 |
| Building blocks | At least 4 neighbouring prefixes are ENABLE words. A prefix is the opening letters, growing one at a time. The run may start after the first letter. The word itself counts. One-letter words count when they are in the list. One card lists that run, shortest first, and lights the longest prefix in it. A longer run does not raise the multiplier | 4,186 | ×5 |
| Anagram | A different dictionary word uses exactly the same letters. The word itself does not count. Each anagram multiplies once. This one is ×4 per anagram, not the rarity formula | 28,648 | ×4 |
| Alphabet twins | Another word uses exactly the same distinct letters with different counts. Anagrams do not count. The card names the partners, eight of them if there are more, and lights the whole word | 127,151 | ×2 |
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
| Letter collector | At least 6 alphabet letters in a row appear in the word, in any order. A repeated letter does not extend the stretch, and a gap breaks it, so A, B, C, E, F is not one stretch. The card lights every occurrence of the letters in the longest stretch, or the one that starts earlier when two tie, and names that stretch, such as A–F | 145 | ×9 |
| Alphabet staircase | At least 3 letters sit next to each other and each is the next letter of the alphabet, like HIJ in hijack or RST in first. Descending runs do not count. A repeated letter breaks the run, and the alphabet does not wrap. A longer run, such as ABCD, still counts once. One card lights every such run | 1,502 | ×6 |
| Roman word | Every letter is a Roman-numeral symbol: I, V, X, L, C, D, or M. This tests the letters, not whether the word is a valid numeral, and the letters need not be in numeral order. One- and two-letter words count when they are in the list. The empty string is not a word. The card lights the whole word | 28 | ×11 |
| Periodic spelling | The whole word can be split into the 118 official IUPAC element symbols. Every symbol is 1 or 2 letters, matched without caring about case. Temporary 3-letter names do not count. Any complete split hits, so the word does not need just one. Leftover letters miss. One card per word. When several splits exist, the card shows the one with the fewest symbols, then the lexicographically earliest sequence, with en dashes, such as Ba–Na–Na. The card lights the whole word | 28,923 | ×2 |
| Bone dry | No A, E, I, O, or U | 121 | ×9 |
| Mirror | Palindrome, at least 3 letters | 101 | ×10 |
| Hidden mirror | A contiguous run of at least 5 letters is a palindrome, and the whole word is not. The run is shorter than the word. A shorter run does not count. The card lights the longest such run, or the leftmost when several tie | 3,148 | ×5 |
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

Definitions are the first plain English sentence from the [kaikki.org](https://kaikki.org/dictionary/English/index.html) English Wiktionary dump, cut to one sentence and 180 characters, and shipped in `src/data/definitions.json`. Wiktionary text is available under [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/). A roll asks `/api/definition` for that one sentence. The glosses ship as static assets split by the word's first two letters (`public/definitions/ab.json`), not part of the Worker script, so a lookup reads one small shard. The page does not call Wiktionary. A word with no gloss says “No definition on file.” 167,356 of the 172,823 ENABLE words have one. Rebuild with `curl -fsL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl | python3 scripts/build-definitions.py`, then `npm run split-definitions`. The dump itself is not vendored.

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
| Common | Beats under 35% |

## Accounts

There is no password. Log in opens over the page you are on. Enter an email, and the game emails a one-time link from `login@rwgdle.app`. The popup does not show the link. The link lasts 30 minutes and works once. Opening it does not use it: `/auth/verify` says the link stays unused until it is confirmed, by a script in the browser that asked or by the Log in button anywhere else, and that is a normal form POST. Mail scanners run neither. Another request for the same address within a minute does not send again; the popup counts down to Resend. The tab that asked waits for the link: tapping it anywhere, in another app or on another device, logs that tab in too. Opened in the same browser, the link logs in with no extra tap. In any other browser it asks once and names the device that asked, so a link nobody requested cannot log in someone else. Sessions last a year and each visit renews them. After it logs you in, pick a username: 3–20 characters, letters, numbers, and underscores, unique ignoring case.

Accounts, login links, sessions, and saved rolls use the same tables in two places. `next dev` writes `data/local.sqlite` (gitignored) when the Cloudflare D1 binding is absent. The Worker uses the D1 binding `DB` (`database_name` `rngwordle`). The schema is `migrations/0001_accounts.sql`: text ids, integer unix milliseconds, a digit-string score, and `UNIQUE (account_id, utc_day)`. A roll with no account leaves `account_id` null, which SQLite does not treat as one shared key, so each anonymous generate adds a row. The app rebuilds an older rolls table that required an account the first time it opens the database. Each statement is prepared on its own: D1's exec() treats every line as a separate query, so a formatted CREATE TABLE stops there with incomplete input. No API keys. The Worker sends the login link with the `EMAIL` binding. `npm run dev` prints that link in the server log instead.

## Leaderboard

The leaderboard is at `/leaderboard`. The shared boards and today's top roll are cached for 30 seconds per Cloudflare location, and indexes on the score order (`rolls_rank`, `rolls_day_rank`) let a board read only the rows it shows. Four views, top 100 each, highest score first: today (UTC day), this week (Monday 00:00 UTC through now), this month (calendar month UTC), and all time. Each row is rank, username, word, and score. Anonymous rows are included. A tie goes to the earlier roll. An empty period says so.

A logged-in player with a username can switch that leaderboard to Friends. It ranks their rolls plus accepted friends, for the same four periods. Anonymous players have no friends list.

## Friends

Open Friends, type the other player's exact username, and send a request. They accept on their own Friends page. Until then it stays pending. The requester can cancel. The other player can decline. Either player can remove an accepted friend. No email is sent. You need a username first, and you cannot add yourself. An unknown username, a request to yourself, and a duplicate request each show an error. The `friendships` table is created the first time the app opens the database, the same way an older rolls table is rebuilt, so an existing D1 database grows it without pasted SQL.

## Rolls

Generate asks the server to deal. The server uses the same list and the same scorer. On the Worker that list is the `/words.txt` asset, because the Worker does not keep the app directory as its working directory. A logged-out browser gets one leaderboard roll per UTC day, saved with no account as Anonymous and tracked by a hashed cookie (`rngworlde_guest`, table `guest_days`); its `{ date, word }` stays in this browser under `rngworlde.roll.v1`. Further rolls that day are practice rolls: dealt and scored, but not saved, not on the leaderboard, and no cards. Rolls are rate limited per visitor (60 a minute, Cloudflare `ROLL_LIMITER`), and login emails too (5 a minute via `LOGIN_LIMITER`, 30 a day in `login_requests`). A logged-in roll is saved once per account per UTC day. The row uses the username if they have one, and Anonymous if they do not. Another generate that day shows the saved word and does not replace it.
