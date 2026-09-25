"""Copy origin tags from a base word onto inflected ENABLE forms.

Prefer Wiktionary's form-of link (this entry is a form of another English
word). A regular stem is used only when that link is missing, the entry has
no etymology templates of its own, exactly one ENABLE stem regenerates
the surface, and that stem's own Wiktionary entry lists this form.
A coincidental stem that is a different word does not. Compounds and
derivations such as computer and email are not
inflections and are left alone. A word that already has origin languages
keeps them, so a dialectal form-of does not replace a real etymology.

    curl -fsL https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl \
      | python3 scripts/copy-inflection-origins.py

Reads and rewrites src/data/word-facts.json. Sound-word and rewind tags stay.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FACTS_PATH = ROOT / "src" / "data" / "word-facts.json"
ENABLE_PATH = ROOT / "data" / "enable1.txt"
CACHE_PATH = Path("/tmp/en-inflections.json")

KEEP = ("sound", "rewind")
VOWELS = set("aeiou")
SIBILANT_ENDINGS = ("ch", "sh", "s", "x", "z")

SOURCE = (
    "English Wiktionary etymology templates (borrowed, inherited, or derived), "
    "via kaikki.org wiktextract, following hops through Middle English and modern English. "
    "Inflected forms inherit the lemma's origins from Wiktionary form-of links, "
    "or from one unambiguous regular stem when that link is missing. "
    "CC BY-SA. Sound-word and rewind tags are unchanged."
)


def enable_words() -> set[str]:
    words: set[str] = set()
    for line in ENABLE_PATH.read_text().splitlines():
        word = line.strip().lower()
        if re.fullmatch(r"[a-z]{2,}", word):
            words.add(word)
    return words


def origin_list(tags: list[str]) -> list[str]:
    return [tag for tag in tags if tag not in KEEP]


def kept_list(tags: list[str]) -> list[str]:
    return [tag for tag in tags if tag in KEEP]


def consider(cands: set[str], stem: str, enable: set[str], minimum: int = 2) -> None:
    if len(stem) >= minimum and stem in enable:
        cands.add(stem)


def stem_candidates(word: str, enable: set[str]) -> set[str]:
    """Regular plural, third-person, past, and -ing stems. Not -er or -est."""
    cands: set[str] = set()
    n = len(word)

    if n >= 4 and word.endswith("s") and not word.endswith("ss"):
        stem = word[:-1]
        if not stem.endswith(SIBILANT_ENDINGS) and not (
            stem.endswith("y") and len(stem) >= 2 and stem[-2] not in VOWELS
        ):
            consider(cands, stem, enable)

    if n >= 4 and word.endswith("es"):
        stem = word[:-2]
        if stem.endswith(SIBILANT_ENDINGS) or stem.endswith("o"):
            consider(cands, stem, enable)

    if n >= 5 and word.endswith("ies"):
        consider(cands, word[:-3] + "y", enable)

    if n >= 5 and word.endswith("ves"):
        consider(cands, word[:-3] + "f", enable)
        consider(cands, word[:-3] + "fe", enable)

    if n >= 4 and word.endswith("ed"):
        consider(cands, word[:-2], enable, minimum=3)
        if (
            n >= 6
            and word[-3] == word[-4]
            and word[-3] not in VOWELS
        ):
            stem = word[:-3]
            if len(stem) >= 2 and stem[-1] not in VOWELS and stem[-2] in VOWELS:
                consider(cands, stem, enable)
        if word.endswith("ied"):
            consider(cands, word[:-3] + "y", enable)
        if word[:-1].endswith("e"):
            consider(cands, word[:-1], enable)

    if n >= 5 and word.endswith("ing"):
        consider(cands, word[:-3], enable)
        if n >= 6 and word[-4] == word[-5] and word[-4] not in VOWELS:
            stem = word[:-4]
            if len(stem) >= 2 and stem[-1] not in VOWELS and stem[-2] in VOWELS:
                consider(cands, stem, enable)
        consider(cands, word[:-3] + "e", enable)

    cands.discard(word)
    return cands


# The headword sits with the entry language. Earlier "word" fields are descendants.
HEADWORD = re.compile(
    r'"word": "((?:\\.|[^"\\])*)", "lang": "English", "lang_code": "en"'
    r'|"word":"((?:\\.|[^"\\])*)","lang":"English","lang_code":"en"'
)


def headword(line: str) -> str | None:
    match = HEADWORD.search(line)
    if match is None:
        return None
    raw = match.group(1) or match.group(2)
    if "\\" in raw:
        try:
            raw = json.loads(f'"{raw}"')
        except json.JSONDecodeError:
            return None
    word = raw.strip().lower()
    if re.fullmatch(r"[a-z]+", word):
        return word
    return None


def clean_lemma(raw: object) -> str | None:
    if not isinstance(raw, str):
        return None
    text = raw.split("#", 1)[0].split("<", 1)[0].strip().lower()
    if re.fullmatch(r"[a-z]+", text):
        return text
    return None


def extract(enable: set[str]) -> tuple[dict[str, set[str]], set[str], dict[str, set[str]]]:
    links: dict[str, set[str]] = {}
    has_ety: set[str] = set()
    forms_of: dict[str, set[str]] = {}
    seen = 0
    for line in sys.stdin:
        seen += 1
        if seen % 1_000_000 == 0:
            print(f"scanned {seen} lines", file=sys.stderr)
        if '"lang": "English"' not in line and '"lang":"English"' not in line:
            continue
        word = headword(line)
        if word is None or word not in enable:
            continue
        if re.search(r'"etymology_templates":\s*\[\s*\{', line):
            has_ety.add(word)
        want_form = '"form_of"' in line
        want_forms = '"forms"' in line
        if not want_form and not want_forms:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if str(obj.get("lang_code") or "") != "en":
            continue
        if want_form:
            for sense in obj.get("senses") or []:
                if not isinstance(sense, dict):
                    continue
                for item in sense.get("form_of") or []:
                    if not isinstance(item, dict):
                        continue
                    base = clean_lemma(item.get("word"))
                    if base and base != word:
                        links.setdefault(word, set()).add(base)
        if want_forms:
            for item in obj.get("forms") or []:
                if not isinstance(item, dict):
                    continue
                form = clean_lemma(item.get("form"))
                if form and form in enable and form != word:
                    forms_of.setdefault(word, set()).add(form)
    print(
        f"scanned {seen} lines, form-of entries {len(links)}, "
        f"with etymology templates {len(has_ety)}, lemmas listing forms {len(forms_of)}",
        file=sys.stderr,
    )
    return links, has_ety, forms_of


def tags_from_bases(
    bases: set[str],
    origins: dict[str, list[str]],
    links: dict[str, set[str]],
) -> tuple[list[str], bool]:
    """Return origin tags copied from the bases, and whether a base is still unresolved."""
    collected: list[str] = []
    seen: set[str] = set()
    ready: list[str] = []
    waiting = False
    for base in sorted(bases):
        tags = origins.get(base)
        if tags:
            ready.append(base)
            for tag in tags:
                if tag not in seen:
                    seen.add(tag)
                    collected.append(tag)
        elif base in links:
            waiting = True
    if len(ready) == 1 and len(bases) == 1:
        return list(origins[ready[0]]), waiting
    return collected, waiting


def inherit_forms(
    origins: dict[str, list[str]],
    links: dict[str, set[str]],
) -> int:
    """Copy lemma origins onto form-of entries that have none. Follow chains."""
    pending = [word for word, bases in links.items() if bases and not origins.get(word)]
    copied = 0
    for _ in range(8):
        progressed = 0
        still: list[str] = []
        for word in pending:
            if origins.get(word):
                continue
            collected, waiting = tags_from_bases(links[word], origins, links)
            if waiting:
                still.append(word)
                continue
            if not collected:
                continue
            origins[word] = collected
            copied += 1
            progressed += 1
        pending = still
        if progressed == 0:
            break
    for word in pending:
        if origins.get(word):
            continue
        collected, _waiting = tags_from_bases(links[word], origins, links)
        if not collected:
            continue
        origins[word] = collected
        copied += 1
    return copied


def regular_bases(word: str, enable: set[str], depth: int = 3) -> set[str]:
    """Stems reachable by regular suffixes only, a few steps out."""
    found: set[str] = set()
    frontier = {word}
    for _ in range(depth):
        nxt: set[str] = set()
        for item in frontier:
            for stem in stem_candidates(item, enable):
                if stem not in found:
                    found.add(stem)
                    nxt.add(stem)
        frontier = nxt
        if not frontier:
            break
    return found


def form_listers(forms_of: dict[str, set[str]]) -> dict[str, set[str]]:
    listed: dict[str, set[str]] = {}
    for lemma, forms in forms_of.items():
        for form in forms:
            listed.setdefault(form, set()).add(lemma)
    return listed


def inherit_stems(
    origins: dict[str, list[str]],
    links: dict[str, set[str]],
    has_ety: set[str],
    enable: set[str],
    listed_by: dict[str, set[str]],
) -> list[tuple[str, str]]:
    """One unambiguous regular stem, and only when Wiktionary gave no form-of link.

    The stem's entry has to be the only one that lists this surface. A stem that
    is itself an irregular form of some other word is rejected, so broke does not
    lend break's history to broking, and glee does not claim gleed.
    """
    assigned: list[tuple[str, str]] = []
    for word in sorted(enable):
        if origins.get(word) or word in links or word in has_ety:
            continue
        stems = stem_candidates(word, enable)
        if len(stems) != 1:
            continue
        stem = next(iter(stems))
        if listed_by.get(word) != {stem}:
            continue
        if stem in links and not links[stem] <= regular_bases(word, enable):
            continue
        tags = origins.get(stem)
        if not tags:
            continue
        origins[word] = list(tags)
        assigned.append((word, stem))
    return assigned


def apply_origins(
    facts: dict[str, list[str]],
    links: dict[str, set[str]],
    has_ety: set[str],
    enable: set[str],
    forms_of: dict[str, set[str]] | None = None,
) -> tuple[dict[str, list[str]], dict[str, int | list[tuple[str, str]]]]:
    listed = forms_of or {}
    listers = form_listers(listed)
    origins = {word: origin_list(tags) for word, tags in facts.items() if origin_list(tags)}
    form_copies = inherit_forms(origins, links)
    stems: list[tuple[str, str]] = []
    for _ in range(4):
        batch = inherit_stems(origins, links, has_ety, enable, listers)
        if not batch:
            break
        stems += batch

    merged: dict[str, list[str]] = {}
    for word in set(facts) | {word for word, tags in origins.items() if tags}:
        previous = facts.get(word, [])
        own = origin_list(previous)
        if own:
            merged[word] = previous
            continue
        inherited = origins.get(word) or []
        if not inherited and word not in facts:
            continue
        keep = kept_list(previous)
        if inherited:
            merged[word] = keep + inherited
        elif previous:
            merged[word] = previous

    stats: dict[str, int | list[tuple[str, str]]] = {
        "form_copies": form_copies,
        "stem_copies": len(stems),
        "stems": stems,
    }
    return merged, stats


def self_check(enable: set[str]) -> None:
    sample = enable | {
        "book",
        "books",
        "run",
        "running",
        "compute",
        "computed",
        "computer",
        "computers",
        "email",
        "emails",
        "care",
        "car",
        "caring",
        "see",
        "seed",
        "box",
        "boxes",
        "baby",
        "babies",
        "leaf",
        "leave",
        "leaves",
        "stop",
        "stopped",
        "make",
        "making",
        "hop",
        "hope",
        "hoped",
        "walk",
        "walked",
        "go",
        "goes",
        "use",
        "us",
        "uses",
        "used",
        "herd",
        "he",
        "bus",
        "buses",
        "fly",
        "flies",
        "carry",
        "carried",
        "sit",
        "sitting",
        "feed",
        "feeding",
        "come",
        "coming",
        "ice",
        "iced",
        "agree",
        "agreed",
        "church",
        "churches",
        "potato",
        "potatoes",
        "wolf",
        "wolves",
    }
    assert stem_candidates("books", sample) == {"book"}
    assert stem_candidates("running", sample) == {"run"}
    assert stem_candidates("computed", sample) == {"compute"}
    assert stem_candidates("computer", sample) == set()
    assert stem_candidates("email", sample) == set()
    assert stem_candidates("caring", sample) == {"car", "care"}
    assert stem_candidates("boxes", sample) == {"box"}
    assert stem_candidates("babies", sample) == {"baby"}
    assert stem_candidates("leaves", sample) == {"leaf", "leave"}
    assert stem_candidates("stopped", sample) == {"stop"}
    assert stem_candidates("making", sample) == {"make"}
    assert stem_candidates("hoped", sample) == {"hop", "hope"}
    assert stem_candidates("walked", sample) == {"walk"}
    assert stem_candidates("goes", sample) == {"go"}
    assert stem_candidates("uses", sample) == {"us", "use"}
    assert stem_candidates("used", sample) == {"use"}
    assert stem_candidates("buses", sample) == {"bus"}
    assert stem_candidates("flies", sample) == {"fly"}
    assert stem_candidates("carried", sample) == {"carry"}
    assert stem_candidates("sitting", sample) == {"sit"}
    assert stem_candidates("feeding", sample) == {"feed"}
    assert stem_candidates("coming", sample) == {"come"}
    assert stem_candidates("iced", sample) == {"ice"}
    assert stem_candidates("agreed", sample) == {"agree"}
    assert stem_candidates("churches", sample) == {"church"}
    assert stem_candidates("potatoes", sample) == {"potato"}
    assert stem_candidates("wolves", sample) == {"wolf"}
    assert stem_candidates("herd", sample) == set()
    assert "se" not in stem_candidates("seed", sample | {"se", "see"}) or stem_candidates(
        "seed", sample | {"se", "see"}
    ) == {"see"}

    book = ["old-english", "proto-germanic", "proto-west-germanic", "german"]
    compute = ["latin", "french"]
    see = ["latin", "french", "old-english"]
    facts = {
        "book": list(book),
        "compute": list(compute),
        "run": ["old-english", "norse"],
        "care": ["latin"],
        "car": ["latin", "french"],
        "see": list(see),
        "seed": ["rewind", "old-english", "proto-germanic"],
        "blarg": ["greek"],
    }
    links = {
        "books": {"book"},
        "computed": {"compute"},
        "running": {"run"},
        "caring": {"care"},
        "seed": {"see"},
        "leaves": {"leaf", "leave"},
    }
    has_ety = {"computer", "email", "seed", "thing"}
    merged, stats = apply_origins(facts, links, has_ety, sample)
    assert merged["books"] == book
    assert merged["computed"] == compute
    assert merged["running"] == ["old-english", "norse"]
    assert merged["caring"] == ["latin"]
    assert merged["seed"] == ["rewind", "old-english", "proto-germanic"]
    assert "computer" not in merged
    assert "email" not in merged
    assert "computers" not in merged
    # Ambiguous stem, no form-of link.
    lonely = apply_origins(facts, {}, set(), sample)[0]
    assert "caring" not in lonely
    # Stem fallback when the link is missing, the stem is unique, and the lemma lists it.
    blarg_enable = sample | {"blarg", "blargs", "glee", "gleed"}
    blargs = apply_origins(
        {**facts, "glee": ["old-english"]},
        {},
        set(),
        blarg_enable,
        {"blarg": {"blargs"}},
    )[0]
    assert blargs["blargs"] == ["greek"]
    assert "gleed" not in blargs
    # gleed is an alternative of glede, and glee also lists that spelling.
    two = apply_origins(
        {**facts, "glee": ["old-english"], "glede": ["old-english"]},
        {},
        set(),
        sample | {"glee", "glede", "gleed"},
        {"glee": {"gleed"}, "glede": {"gleed"}},
    )[0]
    assert "gleed" not in two
    # broking is the broker's trade, not an inflection of broke/break.
    broking = apply_origins(
        {**facts, "break": ["old-english"], "broke": ["old-english"]},
        {"broke": {"break"}},
        set(),
        sample | {"break", "broke", "broking"},
        {"broke": {"broking"}},
    )[0]
    assert "broking" not in broking
    # A dialectal form-of does not replace a word that already has origins.
    baked = apply_origins(
        {**facts, "bake": ["old-english"]},
        {**links, "book": {"bake"}},
        has_ety,
        sample,
    )[0]
    assert baked["book"] == book
    assert stats["form_copies"] == 4
    print("stem self-check ok", file=sys.stderr)


def load_cache() -> tuple[dict[str, set[str]], set[str], dict[str, set[str]]]:
    raw = json.loads(CACHE_PATH.read_text())
    links = {word: set(bases) for word, bases in raw["links"].items()}
    forms_of = {word: set(forms) for word, forms in raw.get("formsOf", {}).items()}
    return links, set(raw["hasEty"]), forms_of


def save_cache(links: dict[str, set[str]], has_ety: set[str], forms_of: dict[str, set[str]]) -> None:
    payload = {
        "links": {word: sorted(bases) for word, bases in sorted(links.items())},
        "hasEty": sorted(has_ety),
        "formsOf": {word: sorted(forms) for word, forms in sorted(forms_of.items())},
    }
    CACHE_PATH.write_text(json.dumps(payload))
    print(f"cached links at {CACHE_PATH}", file=sys.stderr)


def main() -> None:
    enable = enable_words()
    self_check(enable)
    facts_doc = json.loads(FACTS_PATH.read_text())
    facts: dict[str, list[str]] = facts_doc["words"]
    if "--apply-only" in sys.argv:
        links, has_ety, forms_of = load_cache()
    else:
        links, has_ety, forms_of = extract(enable)
        if "book" not in links.get("books", set()):
            raise SystemExit("form-of extract missed books -> book; word-facts left unchanged")
        if "compute" not in links.get("computed", set()):
            raise SystemExit("form-of extract missed computed -> compute; word-facts left unchanged")
        save_cache(links, has_ety, forms_of)

    seed_before = list(facts.get("seed", []))
    book_before = origin_list(facts["book"])
    compute_before = origin_list(facts["compute"])
    run_before = origin_list(facts["run"])
    merged, stats = apply_origins(facts, links, has_ety, enable, forms_of)

    def origins_of(word: str) -> list[str]:
        return origin_list(merged.get(word, []))

    if origins_of("books") != book_before:
        raise SystemExit(f"books {origins_of('books')} != book {book_before}")
    if origins_of("computed") != compute_before:
        raise SystemExit(f"computed {origins_of('computed')} != compute {compute_before}")
    if origins_of("running") != run_before:
        raise SystemExit(f"running {origins_of('running')} != run {run_before}")
    if origins_of("computer") or origins_of("email"):
        raise SystemExit(
            f"invented origins computer={origins_of('computer')} email={origins_of('email')}"
        )
    if merged.get("seed") != seed_before:
        raise SystemExit(f"seed changed from {seed_before} to {merged.get('seed')}")

    covered = sum(1 for tags in merged.values() if origin_list(tags))
    facts_doc["source"] = SOURCE
    facts_doc["words"] = {word: merged[word] for word in sorted(merged)}
    FACTS_PATH.write_text(json.dumps(facts_doc, indent=2, ensure_ascii=False) + "\n")
    print(
        json.dumps(
            {
                "covered": covered,
                "formCopies": stats["form_copies"],
                "stemCopies": stats["stem_copies"],
                "books": origins_of("books"),
                "book": book_before,
                "computed": origins_of("computed"),
                "compute": compute_before,
                "running": origins_of("running"),
                "caring": origins_of("caring"),
                "computer": origins_of("computer"),
                "email": origins_of("email"),
                "seed": origin_list(merged["seed"]),
            }
        ),
        file=sys.stderr,
    )
    stems = stats["stems"]
    assert isinstance(stems, list)
    Path("/tmp/stem-fallbacks.tsv").write_text(
        "".join(f"{word}\t{stem}\n" for word, stem in stems)
    )


if __name__ == "__main__":
    main()
