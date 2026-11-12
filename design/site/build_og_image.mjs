// Renders the website's 1200x630 link previews from each tab's own hero: docs/og-image.png for PaceTasks
// and docs/og-deskfocus.png for DeskFocus. Run from the repository root after changing a hero:
// node design/site/build_og_image.mjs
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SIZE = { width: 1200, height: 630 };
const PREVIEWS = [
  { page: "docs/index.html", output: "docs/og-image.png" },
  { page: "docs/deskfocus.html", output: "docs/og-deskfocus.png" },
];

// The hero alone: no menus, buttons or notes, the title larger, and the scene running off the bottom.
const OG_STYLE = `
  .skip-link, .site-header, .section-nav, .hero__lead, .hero__actions, .hero__note, .scene__note { display: none !important; }
  .js [data-reveal] { opacity: 1 !important; transform: none !important; transition: none !important; }
  .hero { padding: 64px 0 0; }
  .hero__title { font-size: 104px; }
  .scene { margin-top: 48px; }
`;

const browser = await chromium.launch();
try {
  for (const { page: pagePath, output } of PREVIEWS) {
    const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(ROOT, pagePath)).href, { waitUntil: "load" });
    await page.addStyleTag({ content: OG_STYLE });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(ROOT, output), clip: { x: 0, y: 0, ...SIZE } });
    console.info(`[og-image] wrote ${output}`);
    await page.close();
  }
} finally {
  await browser.close();
}
