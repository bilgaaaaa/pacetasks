import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { OUTPUT_DIR, runJourney } from "./harness.mjs";

// Photographs the web demo for the website (bilgaaaaa/PaceTasksWebsite), on the same
// fixed Monday as the simulated journey. After a UI change, with both repositories
// side by side: `npm run site:screens -- ../PaceTasksWebsite/screens`.

const SCREENS_DIR = resolve(process.argv[2] ?? join(OUTPUT_DIR, "site-screens"));
const BRAIN_DUMP_TEXT = "Tomorrow call the vet, domani comprare il pane, cuma günü faturayı öde";
// A task set for this evening, with the nudge picked before it, for the website's "start time and reminder".
const TIMED_TASK = { title: "Buy cat food", time: "At 18:00", reminder: "15 min", hint: "We'll nudge you at 17:45 today." };
const WEBP_QUALITY = 0.86;

await mkdir(SCREENS_DIR, { recursive: true });
console.log(`[site-screens] writing to ${SCREENS_DIR}`);

// Re-encodes the screenshot as WebP with the browser's own encoder, so no image library is needed.
async function saveScreen(page, name) {
  await page.waitForTimeout(900);
  const png = await page.screenshot();
  const dataUrl = await page.evaluate(
    async ({ base64, quality }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      return canvas.toDataURL("image/webp", quality);
    },
    { base64: png.toString("base64"), quality: WEBP_QUALITY }
  );
  await writeFile(join(SCREENS_DIR, `${name}.webp`), Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(`[site-screens] saved ${name}.webp`);
}

const externalRequests = [];

const passed = await runJourney("site-screens", async ({ page, baseUrl, step }) => {
  // The website promises the demo never leaves the browser: any other host fails the run.
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["http:", "https:"].includes(url.protocol) || url.origin === new URL(baseUrl).origin) return;
    externalRequests.push(request.url());
  });

  await step("Today", async () => {
    await page.goto(baseUrl);
    await page.getByText("Today's plan").waitFor();
    await saveScreen(page, "today-light");
  });

  await step("Carried over", async () => {
    await page.getByLabel(/carried over\. Review$/).click();
    const proposal = page.getByText("Here's where I'd move them. Change any, then apply.");
    await proposal.scrollIntoViewIfNeeded();
    await saveScreen(page, "carried-over");
    await page.getByLabel(/carried over\. Hide review$/).click();
    await proposal.waitFor({ state: "detached" });
  });

  await step("Decide for me", async () => {
    await page.getByText("Pick my next task").click();
    await page.getByText("Decide for me").click();
    await page.getByText("ONE THING").waitFor();
    await saveScreen(page, "pick-next");
    await page.getByLabel("Close").last().click();
    await page.getByText("ONE THING").waitFor({ state: "detached" });
  });

  await step("Brain Dump", async () => {
    await page.getByLabel("Brain dump: say everything at once").click();
    await page.locator("textarea").fill(BRAIN_DUMP_TEXT);
    await page.getByText("Sort it out").click();
    await page.getByText("Add 3 tasks").waitFor();
    await saveScreen(page, "brain-dump");
    await page.getByText("Add 3 tasks").click();
    await page.getByText("Done", { exact: true }).last().click();
    await page.getByText("BRAIN DUMP").waitFor({ state: "detached" });
  });

  // The sheet is closed without adding, so Today keeps the same tasks for the shots that follow.
  await step("Start time and reminder", async () => {
    await page.getByLabel("Add a task").click();
    await page.getByPlaceholder("What needs doing?").fill(TIMED_TASK.title);
    await page.getByLabel("Start time and reminder").click();
    await page.getByText("Set a start time").click();
    await page.getByLabel(TIMED_TASK.time).click();
    await page.getByRole("radio", { name: TIMED_TASK.reminder, exact: true }).last().click();
    await page.getByText(TIMED_TASK.hint).waitFor();
    await saveScreen(page, "add-task-time");
    await page.getByLabel("Close", { exact: true }).click();
    await page.getByPlaceholder("What needs doing?").waitFor({ state: "detached" });
  });

  // Taken before any task is finished, so it shows the same day as today-light.
  await step("Today in dark", async () => {
    await page.getByText("SETTINGS", { exact: true }).click();
    await page.getByLabel("Dark", { exact: true }).click();
    await page.getByText("TODAY", { exact: true }).click();
    await page.getByText("Today's plan").waitFor();
    await saveScreen(page, "today-dark");
    await page.getByText("SETTINGS", { exact: true }).click();
    await page.getByLabel("Light", { exact: true }).click();
    await page.getByText("TODAY", { exact: true }).click();
  });

  // A quick win first, so Pace opens on a day already under way rather than on zeros.
  await step("Pace", async () => {
    await page.getByLabel("Complete Call the dentist").click();
    await page.getByText("Done", { exact: true }).first().click();
    await page.getByLabel("Complete Call the dentist").waitFor({ state: "detached" });
    await page.getByText("PACE", { exact: true }).click();
    await page.getByText("CURRENT STREAK").waitFor();
    await saveScreen(page, "pace");
  });
});

externalRequests.forEach((url) => console.error(`[site-screens] request left the browser: ${url}`));
process.exit(passed && externalRequests.length === 0 ? 0 : 1);
