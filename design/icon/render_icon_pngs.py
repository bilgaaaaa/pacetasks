# Renders each SVG to PNG at the size the stores expect, using headless Chromium.
import sys
from playwright.sync_api import sync_playwright

JOBS = [  # (svg, png, size, transparent background)
    ("icon.svg", "icon.png", 1024, False),
    ("adaptive-icon.svg", "adaptive-icon.png", 1024, True),
    ("monochrome-icon.svg", "monochrome-icon.png", 1024, True),
    ("splash-icon.svg", "splash-icon.png", 1024, True),
    ("splash-icon-dark.svg", "splash-icon-dark.png", 1024, True),
    ("notification-icon.svg", "notification-icon.png", 96, True),
    ("icon.svg", "favicon.png", 48, False),
]
with sync_playwright() as p:
    browser = p.chromium.launch()
    for svg, png, size, transparent in JOBS:
        page = browser.new_page(viewport={"width": size, "height": size})
        body = open(svg).read().replace('width="1024" height="1024"', f'width="{size}" height="{size}"')
        page.set_content(f'<html><body style="margin:0;background:transparent">{body}</body></html>')
        page.screenshot(path=png, omit_background=transparent, clip={"x": 0, "y": 0, "width": size, "height": size})
        page.close()
    browser.close()
print("rendered", len(JOBS))
