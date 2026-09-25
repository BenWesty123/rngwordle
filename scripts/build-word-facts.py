"""Build src/data/word-facts.json from Webster 1913 etymologies and ENABLE1.

The parquet is the public-domain EnglishWordOrigins table (Webster's Revised
Unabridged Dictionary, 1913, via Project Gutenberg). It is not vendored.
Download it beside this script as /tmp/english_vocabulary_origins.parquet
before rerunning.

Tags are the immediate source, not a cognate mentioned with "akin to":
the etymology starts with that language, or says "fr." / "from" it.
Sound-word is Webster's own "imitative" / "onomatopoeia" note.
Rewind is a semordnilap: the reverse is a different word in ENABLE1.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PARQUET = Path("/tmp/english_vocabulary_origins.parquet")
ENABLE = ROOT / "data" / "enable1.txt"
OUT = ROOT / "src" / "data" / "word-facts.json"

LANG = {
    "greek": "Gr",
    "italian": "It",
    "norse": "Icel",
    "dutch": "D",
    "arabic": "Ar",
    "sanskrit": "Skr",
    "persian": "Per",
    "hindi": "Hind",
    "hebrew": "Heb",
    "chinese": "Chin",
    "japanese": "Jap",
}

# Kept out even if Webster says "imitative": the note describes another word,
# or a guess that is not the word sounding like its meaning.
SOUND_DENY = {
    "bob",
    "cockade",
    "cook",
    "curr",
    "motto",
    "pash",
    "plump",
    "simmer",
    "slap",
    "squab",
    "twiddle",
    "yang",
}


def enable_words() -> list[str]:
    words = []
    for line in ENABLE.read_text().splitlines():
        word = line.strip().lower()
        if re.fullmatch(r"[a-z]{2,}", word):
            words.append(word)
    return words


def norm_key(head: str, wordset: set[str]) -> str | None:
    h = head.lower().strip()
    if re.fullmatch(r"[a-z]+", h) and h in wordset:
        return h
    if re.fullmatch(r"[a-z]+(-[a-z]+)+", h):
        key = h.replace("-", "")
        if key in wordset:
            return key
    return None


def head_text(text: str) -> str:
    return re.split(r"\ba[ks]in to\b", text, maxsplit=1, flags=re.I)[0]


def lang_hit(text: str, code: str) -> bool:
    trimmed = head_text(text)
    if re.match(rf"(?:(?:OE|AS|OF|F|L|LL|NL)\.\s+\S+(?:,\s+\S+){{0,3}}\s+)?{code}\.", trimmed):
        return True
    if re.search(rf"\b(?:fr|from)\.?\s+{code}\.", trimmed):
        return True
    if code == "Gr" and re.match(r"(?:LL|NL|L|F|OF)\.\s+\S+,\s*Gr\.", trimmed):
        return True
    return False


def is_sound(word: str, text: str) -> bool:
    if word in SOUND_DENY:
        return False
    # "imitative" only. "imitation" (as in "formed in imitation of million") does not count.
    return bool(re.search(r"\bonomatopoe|\bimitative\b", text, re.I))


def main() -> None:
    words = enable_words()
    wordset = set(words)
    frame = pd.read_parquet(PARQUET)
    first: dict[str, str] = {}
    for head, etymology in zip(frame.headword, frame.etymology.fillna(""), strict=False):
        key = norm_key(str(head), wordset)
        if key and key not in first:
            first[key] = re.sub(r"\s+", " ", str(etymology).replace("\n", " ")).strip()

    tagged: dict[str, set[str]] = defaultdict(set)
    for word, text in first.items():
        for name, code in LANG.items():
            if lang_hit(text, code):
                tagged[word].add(name)
        if is_sound(word, text):
            tagged[word].add("sound")

    for word in words:
        reverse = word[::-1]
        if len(word) >= 3 and reverse != word and reverse in wordset:
            tagged[word].add("rewind")

    payload = {
        "source": "Webster's Revised Unabridged Dictionary (1913), public domain",
        "words": {word: sorted(tags) for word, tags in sorted(tagged.items()) if tags},
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n")

    counts: dict[str, int] = defaultdict(int)
    for tags in payload["words"].values():
        for tag in tags:
            counts[tag] += 1
    east = sum(1 for tags in payload["words"].values() if "chinese" in tags or "japanese" in tags)
    ditto = sum(1 for word in words if len(word) >= 4 and len(word) % 2 == 0 and word[: len(word) // 2] == word[len(word) // 2 :])
    print("words tagged", len(payload["words"]))
    for name in [*LANG, "sound", "rewind"]:
        print(f"{name:12} {counts[name]}")
    print(f"{'east-asia':12} {east}")
    print(f"{'ditto':12} {ditto}")
    print("sound sample", ", ".join(sorted(w for w, t in payload["words"].items() if "sound" in t)))


if __name__ == "__main__":
    main()
