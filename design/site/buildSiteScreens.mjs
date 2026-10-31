import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStaticServer } from "../../e2e/harness.mjs";

// Films the phone screens shown on the website (docs/index.html) from the web demo,
// so the site always shows the app as it is. Run with `npm run site:screens`.

const SCREENS_DIR = fileURLToPath(new URL("../../docs/screens/", import.meta.url));

// iPhone 15 logical size at 2x: sharp at the ~300px width the site shows a phone at.
const VIEWPORT = { width: 393, height: 852 };
const SCALE = 2;
const JPEG_QUALITY = 80;
// The store screenshots' fixed Tuesday morning, so the site and the store show the same day.
const DEMO_NOW = "2026-10-13T08:40:00+02:00";
const TIME_ZONE = "Europe/Rome";
// Long enough for sheet animations to settle before the picture is taken.
const SETTLE_MS = 900;
const STEP_TIMEOUT_MS = 8000;

const BRAIN_DUMP_TEXT =
  "water the plants tomorrow morning, buy a birthday gift for Elif by friday, " +
  "book a table for saturday, return the library books";
const NEW_TASK_TITLE = "Call the bank";

// Screen file name -> the taps that bring the demo there. Each starts from a fresh Today.
const SCREENS = {
  today: async () => {},
  "add-task-time": async (page) => {
    await page.getByLabel("Add a task").click();
    await page.getByPlaceholder("What needs doing?").fill(NEW_TASK_TITLE);
    await page.getByLabel("Start time and reminder").click();
    await page.getByText("Set a start time").click();
    await page.getByLabel("At 18:00").click();
    await page.getByRole("radio", { name: "15 min", exact: true }).last().click();
    await page.getByText("We'll nudge you at 17:45 today.").waitFor();
  },
  "brain-dump": async (page) => {
    await page.getByLabel("Brain dump: say everything at once").last().click();
    await page.locator("textarea").last().fill(BRAIN_DUMP_TEXT);
    await page.getByRole("button", { name: "Sort it out" }).click();
    await page.getByText("Here's what I understood").waitFor();
  },
  "carried-over": async (page) => {
    await page.getByText("Review", { exact: true }).click();
    await page.getByRole("button", { name: "Apply changes" }).waitFor();
  },
  pace: async (page) => {
    await page.getByRole("tab", { name: /^Pace$/i }).click();
    await page.getByText("Your pace").waitFor();
  },
};

// Opens a fresh demo session at iPhone size with the clock pinned to DEMO_NOW.
async function openDemo(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    locale: "en-GB",
    timezoneId: TIME_ZONE,
    colorScheme: "light",
  });
  context.setDefaultTimeout(STEP_TIMEOUT_MS);
  const page = await context.newPage();
  await page.clock.install({ time: new Date(DEMO_NOW) });
  await page.goto(baseUrl);
  await page.getByText("Pick my next task").waitFor();
  return page;
}

async function main() {
  await mkdir(SCREENS_DIR, { recursive: true });
  const { server, baseUrl } = await startStaticServer();
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const [name, show] of Object.entries(SCREENS)) {
      const page = await openDemo(browser, baseUrl);
      try {
        await show(page);
        await page.waitForTimeout(SETTLE_MS);
        const path = join(SCREENS_DIR, `${name}.jpg`);
        await page.screenshot({ path, type: "jpeg", quality: JPEG_QUALITY });
        console.log(`[site-screens] wrote ${path}`);
      } catch (error) {
        failed += 1;
        console.error(`[site-screens] FAIL ${name}: ${String(error.message).split("\n")[0]}`);
      } finally {
        await page.context().close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(failed === 0 ? 0 : 1);
}

await main();
