"""Build short Webster 1913 glosses for ENABLE words.

The parquet is public-domain EnglishWordOrigins (Webster's Revised Unabridged
Dictionary, 1913). It is not vendored. Place it at
/tmp/english_vocabulary_origins.parquet before rerunning.

Each gloss is the first sense, plain text, not the whole entry. Rows whose
definition is a broken fragment are listed in definition-gaps.json so the app
can look up that one rolled word elsewhere.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PARQUET = Path("/tmp/english_vocabulary_origins.parquet")
ENABLE = ROOT / "data" / "enable1.txt"
OUT = ROOT / "src" / "data" / "definitions.json"
GAPS = ROOT / "src" / "data" / "definition-gaps.json"


def enable_words() -> set[str]:
    words = set()
    for line in ENABLE.read_text().splitlines():
        word = line.strip().lower()
        if re.fullmatch(r"[a-z]{2,}", word):
            words.add(word)
    return words


def norm_key(head: str, words: set[str]) -> str | None:
    key = head.lower().strip()
    if re.fullmatch(r"[a-z]+", key) and key in words:
        return key
    if re.fullmatch(r"[a-z]+(-[a-z]+)+", key):
        flat = key.replace("-", "")
        if flat in words:
            return flat
    return None


def gloss(raw: str) -> str | None:
    text = re.sub(r"\s+", " ", str(raw).replace("\n", " ")).strip()
    if not text or text.lower() == "nan":
        return None
    text = text.split(" / ")[0].strip()
    text = re.sub(r"^\d+\.\s*", "", text)
    stop = re.search(r"[.!?](?:\s|$)", text)
    if stop:
        text = text[: stop.end()].strip()
    if len(text) > 180:
        cut = text[:180]
        space = cut.rfind(" ")
        text = (cut[:space] if space > 40 else cut).rstrip(" ,;") + "…"
    if len(text) < 4 or not re.search(r"[A-Za-z]", text):
        return None
    if len(text) < 12 and not re.search(r"[.!?]$", text):
        return None
    return text


def main() -> None:
    words = enable_words()
    frame = pd.read_parquet(PARQUET, columns=["headword", "etymology", "definition"])
    definitions: dict[str, str] = {}
    seen_ety: set[str] = set()
    for head, etymology, definition in zip(
        frame.headword, frame.etymology.fillna(""), frame.definition.fillna(""), strict=False
    ):
        key = norm_key(str(head), words)
        if key is None or key in definitions:
            continue
        if str(etymology).strip():
            seen_ety.add(key)
        short = gloss(str(definition))
        if short:
            definitions[key] = short
    gaps = sorted(seen_ety - definitions.keys())
    OUT.write_text(json.dumps(definitions, ensure_ascii=False, separators=(",", ":")))
    GAPS.write_text(json.dumps(gaps, indent=2) + "\n")
    print(f"definitions {len(definitions)} gaps {len(gaps)} enable {len(words)}")
    print("gaps", ", ".join(gaps))


if __name__ == "__main__":
    main()
