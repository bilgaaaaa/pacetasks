#!/usr/bin/env python3
"""Builds the Italian website (docs/it/) from the English pages in docs/.

The English pages are the source. Every piece of text on them (a heading, a
paragraph, a list item, a link, an alt text…) is looked up in docs/i18n/it.json,
which maps the English text to its Italian. Run it after changing any page:

    python3 scripts/build_site_it.py          # writes docs/it/*.html
    python3 scripts/build_site_it.py --check  # fails if a text has no Italian

A text missing from it.json stops the build and is listed, so the Italian site
can never fall behind without it being noticed.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OUT = DOCS / "it"
TRANSLATIONS = DOCS / "i18n" / "it.json"
PAGES = ["index.html", "support.html", "terms.html", "privacy.html"]
SITE = "https://pacetasks.bilgalog.dev/"

# Elements translated as one piece, inline tags (links, bold) included, so a sentence can be reordered.
BLOCKS = "title|h1|h2|h3|p|li|summary|th|td|legend|blockquote"
# Elements that hold blocks; a block containing one of these is not a single piece of text.
CONTAINERS = BLOCKS + "|ul|ol|div|section|article|details|table|figure|header|footer|nav|main|fieldset|picture"
# Short texts that sit outside any block: nav links, buttons, labels.
INLINE = "a|span|button"
TEXT_ATTRIBUTES = "alt|aria-label"
META_TEXTS = "description|og:title|og:description"
# Files that live in docs/ and are shared by both languages.
ASSETS = r"(?:icon\.png|deskfocus-icon\.svg|og-image\.png|site\.css|site\.js|widget\.js|lang\.js|fonts/|screens/)"

HAS_WORDS = re.compile(r"[A-Za-zÀ-ÿ]{2,}")


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


def protect(html):
    """Takes comments, scripts and drawings out of the way; returns the page and how to put them back."""
    kept = []

    def keep(match):
        kept.append(match.group(0))
        return f"\x00{len(kept) - 1}\x00"

    html = re.sub(r"<!--.*?-->|<script\b.*?</script>|<svg\b.*?</svg>", keep, html, flags=re.S)
    return html, lambda page: re.sub(r"\x00(\d+)\x00", lambda m: kept[int(m.group(1))], page)


def translate_page(html, lookup):
    """Replaces every text on the page with lookup(english); the markup around it is untouched."""
    html, restore = protect(html)
    done = []

    def finish(text):
        done.append(text)
        return f"\x01{len(done) - 1}\x01"

    def piece(text):
        english = normalize(text)
        return lookup(english) if HAS_WORDS.search(re.sub(r"<[^>]+>|\x00\d+\x00", "", english)) else text

    # The language link points at the same page in the other language, under its own name.
    html = re.sub(
        r'<a class="lang-switch" href="it/([^"]*)" hreflang="it" lang="it">Italiano</a>',
        lambda m: finish(f'<a class="lang-switch" href="../{m.group(1)}" hreflang="en" lang="en">English</a>'),
        html,
    )
    html = re.sub(
        rf'(<meta (?:name|property)="(?:{META_TEXTS})" content=")([^"]*)(")',
        lambda m: finish(m.group(1) + piece(m.group(2)) + m.group(3)),
        html,
    )
    block = re.compile(rf"(<({BLOCKS})\b[^>]*>)((?:(?!</?(?:{CONTAINERS})\b).)*?)(</\2>)", re.S)
    html = block.sub(lambda m: finish(m.group(1) + piece(m.group(3)) + m.group(4)), html)
    inline = re.compile(rf"(<({INLINE})\b[^>]*>)([^<>\x00\x01]*)(</\2>)", re.S)
    html = inline.sub(lambda m: finish(m.group(1) + piece(m.group(3)) + m.group(4)), html)
    # Descriptions of pictures and groups, for screen readers; empty ones are left as they are.
    html = re.sub(
        rf'(\s(?:{TEXT_ATTRIBUTES})=")([^"\x01]*[A-Za-z]{{2}}[^"\x01]*)(")',
        lambda m: m.group(1) + piece(m.group(2)) + m.group(3),
        html,
    )

    while "\x01" in html:
        html = re.sub(r"\x01(\d+)\x01", lambda m: done[int(m.group(1))], html)
    return restore(html)


def localize_head(html, page):
    """Marks the page as Italian and points shared files and its own address at the right place."""
    path = "" if page == "index.html" else page
    html = html.replace('<html lang="en">', '<html lang="it">', 1)
    html = re.sub(rf'((?:href|src|srcset)=")({ASSETS})', r"\1../\2", html)
    html = html.replace(f'rel="canonical" href="{SITE}{path}"', f'rel="canonical" href="{SITE}it/{path}"')
    html = html.replace(f'property="og:url" content="{SITE}{path}"', f'property="og:url" content="{SITE}it/{path}"')
    return html


def main():
    check_only = "--check" in sys.argv
    translations = json.loads(TRANSLATIONS.read_text(encoding="utf-8")) if TRANSLATIONS.exists() else {}
    missing, used = [], set()

    def lookup(english):
        used.add(english)
        if english not in translations:
            if english not in missing:
                missing.append(english)
            return english
        return translations[english]

    pages = {page: localize_head(translate_page((DOCS / page).read_text(encoding="utf-8"), lookup), page) for page in PAGES}

    if "--dump" in sys.argv:
        print(json.dumps(missing, ensure_ascii=False, indent=0))
        return 0
    if missing:
        print(f"[site] {len(missing)} texts have no Italian in {TRANSLATIONS.relative_to(ROOT)}:")
        for text in missing:
            print("  -", text)
        return 1
    unused = [english for english in translations if english not in used]
    if unused:
        print(f"[site] {len(unused)} entries in it.json are no longer on any page:")
        for text in unused:
            print("  -", text)
        return 1
    if check_only:
        stale = [page for page in PAGES if not (OUT / page).exists() or (OUT / page).read_text(encoding="utf-8") != pages[page]]
        if stale:
            print("[site] docs/it is out of date, run scripts/build_site_it.py:", ", ".join(stale))
            return 1
        print("[site] Italian pages are up to date")
        return 0
    OUT.mkdir(exist_ok=True)
    for page, html in pages.items():
        (OUT / page).write_text(html, encoding="utf-8")
    print(f"[site] wrote {len(pages)} Italian pages to {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
