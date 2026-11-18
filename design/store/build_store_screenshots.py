"""Builds the App Store screenshots from the web demo.

Usage (from the repo root):
    EXPO_PUBLIC_DEMO_MODE=1 npx expo export --platform web --output-dir /tmp/pacetasks-web
    python3 -m http.server 8765 --directory /tmp/pacetasks-web &
    python3 design/store/build_store_screenshots.py --url http://localhost:8765 --out design/store/screenshots

Writes one 1320x2868 PNG (iPhone 6.9", the only size App Store Connect requires)
per screen and store locale. Needs `pip install playwright pillow`.
"""

import argparse
import base64
import io
import json
import logging
import re
from pathlib import Path

from PIL import Image
from playwright.sync_api import Browser, Page, sync_playwright

log = logging.getLogger("store_screenshots")

STORE_CONFIG_PATH = Path(__file__).resolve().parents[2] / "store.config.json"

# iPhone 6.9" in points and its 3x pixel size.
PHONE_WIDTH, PHONE_HEIGHT, PHONE_SCALE = 440, 956, 3
CANVAS_WIDTH, CANVAS_HEIGHT = PHONE_WIDTH * PHONE_SCALE, PHONE_HEIGHT * PHONE_SCALE

# A fixed weekday morning, so every run shows the same day and greeting.
DEMO_NOW = "2026-10-13T08:40:00+02:00"
DEMO_TIME_ZONE = "Europe/Rome"
BRAIN_DUMP_TEXT = (
    "water the plants tomorrow morning, buy a birthday gift for Elif by friday, "
    "book a table for saturday, return the library books"
)

# Screen id -> headline and supporting line per store locale (the keys of store.config.json).
CAPTIONS = {
    "01_today": {
        "en-US": ("A day you can actually finish", "Your tasks, sized to the time you really have."),
        "it": ("Una giornata che riesci a finire", "Le tue attività, a misura del tempo che hai davvero."),
        "tr": ("Gerçekten bitirebileceğin bir gün", "Görevlerin, gerçekten sahip olduğun zamana göre."),
    },
    "02_brain_dump": {
        "en-US": ("Empty your head in one go", "Write it all down. PaceTasks turns it into tasks."),
        "it": ("Svuota la testa in un colpo solo", "Scrivi tutto. PaceTasks lo trasforma in attività."),
        "tr": ("Aklındakileri tek seferde boşalt", "Hepsini yaz. PaceTasks görevlere çevirsin."),
    },
    "03_fit_my_time": {
        "en-US": ("15 minutes? Here's what fits", "Pick your time and energy. Get tasks that match."),
        "it": ("Hai 15 minuti? Ecco cosa ci sta", "Scegli tempo ed energia. Ricevi le attività giuste."),
        "tr": ("15 dakikan mı var? İşte sığanlar", "Zamanını ve enerjini seç, uygun görevleri gör."),
    },
    "04_carried_over": {
        "en-US": ("Didn't finish? No guilt pile", "PaceTasks suggests a new day for each one."),
        "it": ("Non hai finito? Niente sensi di colpa", "PaceTasks propone un nuovo giorno per ognuna."),
        "tr": ("Bitiremedin mi? Suçluluk yok", "PaceTasks her biri için yeni bir gün önerir."),
    },
    "05_pace": {
        "en-US": ("Compete only with your own pace", "See when you really get things done."),
        "it": ("Gareggia solo con il tuo ritmo", "Scopri quando concludi davvero le cose."),
        "tr": ("Yalnızca kendi temponla yarış", "İşleri gerçekte ne zaman bitirdiğini gör."),
    },
}

FRAME_HTML = """<!doctype html>
<html lang="{lang}"><head><meta charset="utf-8"><style>
  html, body {{ margin: 0; }}
  body {{
    width: {width}px; height: {height}px; overflow: hidden; box-sizing: border-box;
    display: flex; flex-direction: column; align-items: center;
    padding: 150px 96px 0;
    background: linear-gradient(170deg, #E7EFE1 0%, #CFE0C6 100%);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1F2B22; text-align: center;
  }}
  h1 {{ margin: 0; font-size: 92px; line-height: 1.08; font-weight: 800; letter-spacing: -2.5px; text-wrap: balance; }}
  p {{ margin: 34px 0 0; font-size: 46px; line-height: 1.3; color: #3F7446; font-weight: 500; text-wrap: balance; }}
  .phone {{
    margin-top: auto; width: 1000px; flex: none;
    border: 18px solid #1F2B22; border-bottom: 0; border-radius: 96px 96px 0 0;
    overflow: hidden; box-shadow: 0 40px 120px rgba(31, 43, 34, 0.28);
  }}
  .phone img {{ display: block; width: 100%; }}
</style></head><body>
  <h1>{headline}</h1>
  <p>{supporting}</p>
  <div class="phone"><img src="data:image/png;base64,{screen}"></div>
</body></html>"""


def open_demo(browser: Browser, url: str) -> Page:
    """Opens the web demo at iPhone size with the clock pinned to DEMO_NOW."""
    context = browser.new_context(
        viewport={"width": PHONE_WIDTH, "height": PHONE_HEIGHT},
        device_scale_factor=PHONE_SCALE,
        locale="en-US",
        timezone_id=DEMO_TIME_ZONE,
        color_scheme="light",
    )
    page = context.new_page()
    page.clock.install(time=DEMO_NOW)
    page.goto(url)
    page.get_by_text("Pick my next task").wait_for()
    page.wait_for_timeout(800)
    return page


def show_today(page: Page) -> None:
    """Today is the screen the demo opens on, so there is nothing to tap."""


def show_brain_dump(page: Page) -> None:
    page.get_by_label("Brain dump: say everything at once").last.click()
    page.locator("textarea").last.fill(BRAIN_DUMP_TEXT)
    page.get_by_role("button", name="Sort it out").click()
    page.get_by_text("Here's what I understood").wait_for()


def show_fit_my_time(page: Page) -> None:
    page.get_by_text("Pick my next task").click()
    page.get_by_text("Fit my time").click()
    page.get_by_text("What can I do now?").wait_for()


def show_carried_over(page: Page) -> None:
    page.get_by_text("Review", exact=True).click()
    page.get_by_role("button", name="Apply changes").wait_for()


def show_pace(page: Page) -> None:
    page.get_by_role("tab", name=re.compile("^Pace$", re.I)).click()
    page.get_by_text("Your pace").wait_for()


SCREENS = {
    "01_today": show_today,
    "02_brain_dump": show_brain_dump,
    "03_fit_my_time": show_fit_my_time,
    "04_carried_over": show_carried_over,
    "05_pace": show_pace,
}


def capture_screens(browser: Browser, url: str) -> dict[str, bytes]:
    """Returns one raw app screenshot per screen id, each from a fresh demo session."""
    shots = {}
    for screen_id, show in SCREENS.items():
        page = open_demo(browser, url)
        show(page)
        page.wait_for_timeout(900)  # let sheet animations settle
        shots[screen_id] = page.screenshot()
        page.context.close()
        log.info("captured %s", screen_id)
    return shots


def compose(browser: Browser, shots: dict[str, bytes], out_dir: Path) -> None:
    """Frames every screenshot with its caption, once per store locale."""
    context = browser.new_context(viewport={"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT}, device_scale_factor=1)
    page = context.new_page()
    for screen_id, shot in shots.items():
        encoded = base64.b64encode(shot).decode("ascii")
        for locale, (headline, supporting) in CAPTIONS[screen_id].items():
            page.set_content(
                FRAME_HTML.format(
                    lang=locale,
                    width=CANVAS_WIDTH,
                    height=CANVAS_HEIGHT,
                    headline=headline,
                    supporting=supporting,
                    screen=encoded,
                )
            )
            page.wait_for_timeout(200)
            target = out_dir / locale / f"{screen_id}.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            # App Store Connect rejects screenshots with an alpha channel.
            Image.open(io.BytesIO(page.screenshot())).convert("RGB").save(target, optimize=True)
            log.info("wrote %s", target)
    context.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", required=True, help="where the exported web demo is being served")
    parser.add_argument("--out", required=True, type=Path, help="folder that receives one subfolder per locale")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="[store_screenshots] %(message)s")

    if set(CAPTIONS) != set(SCREENS):
        raise SystemExit("CAPTIONS and SCREENS must list the same screen ids")
    store_locales = set(json.loads(STORE_CONFIG_PATH.read_text(encoding="utf-8"))["apple"]["info"])
    if any(set(captions) != store_locales for captions in CAPTIONS.values()):
        raise SystemExit(f"every screen needs a caption for exactly these locales: {sorted(store_locales)}")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        compose(browser, capture_screens(browser, args.url), args.out)
        browser.close()


if __name__ == "__main__":
    main()
