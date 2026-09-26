"""Build one plain English gloss per ENABLE word from English Wiktionary.

Streams the kaikki.org wiktextract JSONL (CC BY-SA). The dump is not vendored.

    curl -fsL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl \
      | python3 scripts/build-definitions.py

Keeps the first plain sentence for each ENABLE headword, capped the same way
as plainDefinition in src/lib/definition.ts. An exact lowercase headword wins
over a capitalized page with the same letters.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENABLE = ROOT / "data" / "enable1.txt"
OUT = ROOT / "src" / "data" / "definitions.json"


def enable_words() -> set[str]:
    words: set[str] = set()
    for line in ENABLE.read_text().splitlines():
        word = line.strip().lower()
        if re.fullmatch(r"[a-z]{2,}", word):
            words.add(word)
    return words


def plain_definition(html: str) -> str:
    text = re.sub(r"<[^>]+>", "", html)
    text = (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&apos;", "'")
    )
    text = re.sub(r"\s+", " ", text).strip()
    match = re.search(r"[.!?](?:\s|$)", text)
    sentence = text if match is None else text[: match.start() + 1]
    if len(sentence) > 180:
        return sentence[:177].rstrip() + "…"
    return sentence


def first_gloss(obj: dict) -> str | None:
    for sense in obj.get("senses") or []:
        glosses = sense.get("glosses") if isinstance(sense, dict) else None
        if not isinstance(glosses, list):
            continue
        for gloss in glosses:
            if not isinstance(gloss, str):
                continue
            plain = plain_definition(gloss)
            if len(plain) >= 4:
                return plain
    return None


def main() -> None:
    words = enable_words()
    exact: dict[str, str] = {}
    fallback: dict[str, str] = {}
    lines = 0
    source = open(sys.argv[1], encoding="utf-8") if len(sys.argv) > 1 else sys.stdin
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT
    try:
        for line in source:
            lines += 1
            if lines % 20000 == 0:
                print(f"lines {lines} exact {len(exact)} fallback {len(fallback)}", file=sys.stderr)
            if '"lang_code": "en"' not in line or '"glosses"' not in line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("lang_code") != "en":
                continue
            head = str(obj.get("word") or "").strip()
            key = head.lower()
            if key not in words:
                continue
            if head == key and key in exact:
                continue
            if head != key and (key in exact or key in fallback):
                continue
            gloss = first_gloss(obj)
            if gloss is None:
                continue
            if head == key:
                exact[key] = gloss
            else:
                fallback[key] = gloss
            if len(exact) == len(words):
                break
    finally:
        if source is not sys.stdin:
            source.close()

    merged = dict(fallback)
    merged.update(exact)
    out.write_text(json.dumps(merged, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    missing = len(words) - len(merged)
    print(
        f"definitions {len(merged)} exact {len(exact)} fallback {len(fallback)} "
        f"missing {missing} enable {len(words)} lines {lines}"
    )


if __name__ == "__main__":
    main()
