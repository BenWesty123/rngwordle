"""Build origin tags for ENABLE words from English Wiktionary.

Streams the kaikki.org wiktextract JSONL (CC BY-SA). Borrowed-from,
inherited-from, and derived-from templates count. Cognates ("akin to",
template cog) do not. A hop through Middle English or modern English is
followed to that word's own templates. Those stages are not origins.
The dumps are not vendored.

    curl -fsL "https://kaikki.org/dictionary/Middle%20English/kaikki.org-dictionary-MiddleEnglish.jsonl" \
      -o /tmp/middle-english.jsonl
    curl -fsL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl \
      | python3 scripts/build-origins.py

Prints a JSON object of ENABLE word -> sorted language codes on stdout.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENABLE = ROOT / "data" / "enable1.txt"

TEMPLATES = {
    "bor",
    "bor+",
    "inh",
    "inh+",
    "lbor",
    "slbor",
    "obor",
    "ubor",
    "borrowed",
    "inherited",
    "der",
    "der+",
}

# Follow these. They are not From cards.
SKIP_LANGS = {"en", "enm", "en-gb", "en-us"}
INDEX_LANGS = SKIP_LANGS


def enable_words() -> set[str]:
    words: set[str] = set()
    for line in ENABLE.read_text().splitlines():
        word = line.strip().lower()
        if re.fullmatch(r"[a-z]{2,}", word):
            words.add(word)
    return words


def fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return (
        text.replace("þ", "th")
        .replace("ð", "th")
        .replace("æ", "ae")
        .replace("œ", "oe")
        .replace("ł", "l")
        .replace("ø", "o")
    )


def language_code(raw: object) -> str | None:
    if raw is None:
        return None
    code = str(raw).split("<", 1)[0].split(":", 1)[0].strip().lower()
    if not re.fullmatch(r"[a-z0-9-]{2,16}", code):
        return None
    return code


def lemmas(raw: object) -> list[str]:
    if raw is None:
        return []
    text = str(raw).split("<", 1)[0].strip().lower()
    found: list[str] = []
    for part in text.split(","):
        part = part.split("|", 1)[0].strip()
        if part and part not in {"-", "—"}:
            found.append(part)
    return found


def ingest(obj: dict, index: dict[tuple[str, str], tuple[set[str], set[tuple[str, str]]]]) -> None:
    lang = str(obj.get("lang_code") or "")
    if lang not in INDEX_LANGS:
        return
    name = str(obj.get("word") or "").strip().lower()
    if not name:
        return
    direct, hops = index.setdefault((lang, fold(name)), (set(), set()))
    for template in obj.get("etymology_templates") or []:
        if template.get("name") not in TEMPLATES:
            continue
        args = template.get("args") or {}
        code = language_code(args.get("2"))
        if code is None or code in {"mul", "und"}:
            continue
        if code in SKIP_LANGS:
            for cited in lemmas(args.get("3")):
                hops.add((code, fold(cited)))
            continue
        direct.add(code)


def load_middle_english(index: dict[tuple[str, str], tuple[set[str], set[tuple[str, str]]]]) -> None:
    path = Path("/tmp/middle-english.jsonl")
    if not path.exists():
        print("missing /tmp/middle-english.jsonl", file=sys.stderr)
        return
    for line in path.read_text().splitlines():
        try:
            ingest(json.loads(line), index)
        except json.JSONDecodeError:
            continue


def main() -> None:
    words = enable_words()
    # (lang, folded lemma) -> (direct source codes, follow hops)
    index: dict[tuple[str, str], tuple[set[str], set[tuple[str, str]]]] = {}
    load_middle_english(index)

    for line in sys.stdin:
        if "etymology_templates" not in line:
            continue
        if '"lang_code": "en' not in line and '"lang_code":"en' not in line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if str(obj.get("lang_code") or "") != "en":
            continue
        ingest(obj, index)

    index = {key: entry for key, entry in index.items() if entry[0] or entry[1]}

    def resolve(lang: str, name: str, seen: set[tuple[str, str]]) -> set[str]:
        key = (lang, fold(name))
        if key in seen:
            return set()
        entry = index.get(key)
        if entry is None:
            return set()
        direct, hops = entry
        found = set(direct)
        seen.add(key)
        for hop_lang, hop_name in hops:
            found |= resolve(hop_lang, hop_name, seen)
        seen.remove(key)
        return found

    payload: dict[str, list[str]] = {}
    for word in sorted(words):
        langs = resolve("en", word, set())
        if langs:
            payload[word] = sorted(langs)
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    print(f"indexed {len(index)} headwords, enable with origins {len(payload)}", file=sys.stderr)


if __name__ == "__main__":
    main()
