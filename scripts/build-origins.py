"""Build origin tags for ENABLE words from English Wiktionary.

Streams the kaikki.org wiktextract JSONL (CC BY-SA). Only borrowed-from and
inherited-from templates are kept. Cognates ("akin to", template cog) and
plain derived-from links are ignored. The dump is not vendored.

    curl -fsL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl \
      | python3 scripts/build-origins.py

Prints a JSON object of word -> sorted language codes on stdout.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENABLE = ROOT / "data" / "enable1.txt"

# Immediate source on {{bor|en|la|...}} / {{inh|en|ang|...}} and the borrowing family.
# bor/inh are preferred. der is the usual "from Latin/Greek" link on an English entry.
# cog / ncog ("akin to", "not cognate with") are not an origin.
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

# English stages are not a foreign origin. Unknown codes are not a language.
SKIP_LANGS = {"en", "enm", "mul", "und", "en-gb", "en-us"}


def enable_words() -> set[str]:
    words: set[str] = set()
    for line in ENABLE.read_text().splitlines():
        word = line.strip().lower()
        if re.fullmatch(r"[a-z]{2,}", word):
            words.add(word)
    return words


def headword(word: str, words: set[str]) -> str | None:
    text = word.strip().lower()
    if re.fullmatch(r"[a-z]+", text) and text in words:
        return text
    if re.fullmatch(r"[a-z]+(-[a-z]+)+", text):
        key = text.replace("-", "")
        if key in words:
            return key
    return None


def source_lang(args: dict) -> str | None:
    raw = args.get("2")
    if raw is None:
        return None
    code = str(raw).split("<", 1)[0].split(":", 1)[0].strip().lower()
    if not re.fullmatch(r"[a-z0-9-]{2,12}", code):
        return None
    if code in SKIP_LANGS:
        return None
    return code


def main() -> None:
    words = enable_words()
    found: dict[str, set[str]] = {}
    for line in sys.stdin:
        if '"lang_code": "en"' not in line and '"lang_code":"en"' not in line:
            continue
        if "etymology_templates" not in line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if obj.get("lang_code") != "en":
            continue
        head = headword(str(obj.get("word") or ""), words)
        if head is None:
            continue
        langs = found.setdefault(head, set())
        for template in obj.get("etymology_templates") or []:
            if template.get("name") not in TEMPLATES:
                continue
            code = source_lang(template.get("args") or {})
            if code:
                langs.add(code)
    payload = {word: sorted(langs) for word, langs in sorted(found.items()) if langs}
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
