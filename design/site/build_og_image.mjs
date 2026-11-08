// Renders docs/og-image.png, the 1200x630 link preview of the website, from the landing page's own hero.
// Run from the repository root after changing the hero: node design/site/build_og_image.mjs
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PAGE_URL = pathToFileURL(path.join(ROOT, "docs/index.html")).href;
const OUTPUT = path.join(ROOT, "docs/og-image.png");
const SIZE = { width: 1200, height: 630 };

// The hero alone, edge to edge: no header, buttons or notes, the phone and widget running off the bottom.
const OG_STYLE = `
  .skip-link, .site-header, .hero-actions, .hero-status, .hero-stage-note { display: none !important; }
  .landing { max-width: none; padding: 0; }
  .hero-card { height: ${SIZE.height}px; border-radius: 0; padding: 64px 64px 0; grid-template-columns: 1.1fr 1fr; }
  .hero-copy { align-self: start; padding-top: 70px; }
  .hero-stage { min-height: 0; }
  .desk-widget { bottom: auto; top: 150px; }
`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1, colorScheme: "light" });
  await page.goto(PAGE_URL, { waitUntil: "load" });
  await page.addStyleTag({ content: OG_STYLE });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUTPUT, clip: { x: 0, y: 0, ...SIZE } });
  console.info(`[og-image] wrote ${path.relative(ROOT, OUTPUT)}`);
} finally {
  await browser.close();
}
