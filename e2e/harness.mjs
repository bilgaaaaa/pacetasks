import { createServer } from "node:http";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Shared plumbing for simulated journeys: serves the exported demo build, opens
// it at iPhone size with a fixed clock, films the run and records each step.

const E2E_DIR = fileURLToPath(new URL(".", import.meta.url));
export const OUTPUT_DIR = join(E2E_DIR, "output");
const WEB_DIR = join(OUTPUT_DIR, "web");
const SHOTS_DIR = join(OUTPUT_DIR, "shots");
const VIDEO_DIR = join(OUTPUT_DIR, "video");

// iPhone 15 logical size; the app is iPhone-only for v1.
const VIEWPORT = { width: 393, height: 852 };
// The same zone Jest is pinned to, so "today" means the same day in every suite.
const TIME_ZONE = "Europe/Rome";
// A fixed Monday morning: greeting, due labels and streaks never drift between runs.
const FIXED_NOW = "2026-10-12T08:30:00+02:00";
// Long enough for sheet animations to settle, and for a person to follow the film.
const STEP_PAUSE_MS = 900;
const STEP_TIMEOUT_MS = 8000;

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};

// Serves the static export on a free local port; unknown paths fall back to index.html.
async function startStaticServer() {
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const filePath = resolve(WEB_DIR, `.${normalize(pathname)}`);
    const safePath = filePath.startsWith(WEB_DIR) ? filePath : WEB_DIR;
    try {
      const body = await readFile(extname(safePath) ? safePath : join(WEB_DIR, "index.html"));
      response.writeHead(200, { "Content-Type": MIME_TYPES[extname(safePath)] ?? "text/html" });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}/` };
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Runs one journey and resolves true when every step passed with a clean console.
// A failed step is logged and photographed, and the remaining steps still run,
// so one broken screen doesn't hide the state of the others.
export async function runJourney(journeyName, defineSteps) {
  await rm(SHOTS_DIR, { recursive: true, force: true });
  await rm(VIDEO_DIR, { recursive: true, force: true });
  await mkdir(SHOTS_DIR, { recursive: true });

  const { server, baseUrl } = await startStaticServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-GB",
    timezoneId: TIME_ZONE,
    recordVideo: { dir: VIDEO_DIR, size: { width: VIEWPORT.width * 2, height: VIEWPORT.height * 2 } },
  });
  context.setDefaultTimeout(STEP_TIMEOUT_MS);
  const page = await context.newPage();
  await page.clock.install({ time: new Date(FIXED_NOW) });

  const consoleErrors = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const results = [];
  let shotCount = 0;

  // Saves a numbered screenshot after letting animations settle.
  const snapshot = async (label) => {
    await page.waitForTimeout(STEP_PAUSE_MS);
    shotCount += 1;
    await page.screenshot({ path: join(SHOTS_DIR, `${String(shotCount).padStart(2, "0")}-${slug(label)}.png`) });
  };

  const step = async (name, run) => {
    try {
      await run();
      await snapshot(name);
      results.push({ name, passed: true });
      console.log(`[e2e] PASS ${name}`);
    } catch (error) {
      const reason = String(error.message).split("\n")[0];
      await page.screenshot({ path: join(SHOTS_DIR, `FAILED-${slug(name)}.png`) }).catch(() => {});
      results.push({ name, passed: false });
      console.error(`[e2e] FAIL ${name}: ${reason}`);
    }
  };

  await defineSteps({ page, baseUrl, step, snapshot });

  const video = page.video();
  await context.close();
  await browser.close();
  server.close();

  const videoPath = join(OUTPUT_DIR, `${slug(journeyName)}.webm`);
  await rename(await video.path(), videoPath);
  await rm(VIDEO_DIR, { recursive: true, force: true });

  const failedCount = results.filter((result) => !result.passed).length;
  consoleErrors.forEach((message) => console.error(`[e2e] console error: ${message}`));
  console.log(`[e2e] ${journeyName}: ${results.length - failedCount}/${results.length} steps passed, ${consoleErrors.length} console errors`);
  console.log(`[e2e] video: ${videoPath}`);
  console.log(`[e2e] screenshots: ${SHOTS_DIR}`);
  return failedCount === 0 && consoleErrors.length === 0;
}
