import { runJourney } from "./harness.mjs";

// One simulated day in PaceTasks, start to finish: finish a task, add one, let
// the app pick the next, dump a few thoughts, then check Pace, Settings, sign-up and dark mode.
// Elements are found by the same labels and wording a person (or VoiceOver) meets.

const NEW_TASK_TITLE = "Buy cat food";
const QUICK_WIN_TITLE = "Pay the phone bill";
const BRAIN_DUMP_TEXT = "Tomorrow call the vet, domani comprare il pane, cuma günü faturayı öde";
// A real bounce: the sign-up code went to "icould.com" and never arrived.
const MISTYPED_EMAIL = "bilge@icould.com";
const SUGGESTED_EMAIL = "bilge@icloud.com";

const passed = await runJourney("today-journey", async ({ page, baseUrl, step, snapshot }) => {
  await step("Today loads with the seeded day", async () => {
    await page.goto(baseUrl);
    await page.getByText("Good morning").waitFor();
    await page.getByText("Today's plan").waitFor();
  });

  await step("Complete a quick win", async () => {
    await page.getByLabel("Complete Call the dentist").click();
    await snapshot("Confirm the minutes it took");
    await page.getByText("Done", { exact: true }).first().click();
    await page.getByLabel("Complete Call the dentist").waitFor({ state: "detached" });
  });

  await step("Add a new task", async () => {
    await page.getByLabel("Add a task").click();
    await snapshot("Add sheet opens on the usuals");
    await page.getByPlaceholder("Something new…").fill(NEW_TASK_TITLE);
    await page.getByLabel("15 minutes").click();
    await snapshot("New task form");
    await page.getByText(`Add “${NEW_TASK_TITLE}”`).click();
    await page.getByText(`Added “${NEW_TASK_TITLE}”`).waitFor();
    await snapshot("Added, with Undo");
    // The sheet stays open for more tasks; Done closes it.
    await page.getByText("Done", { exact: true }).last().click();
    await page.getByLabel(`Complete ${NEW_TASK_TITLE}`).waitFor();
  });

  await step("Decide for me offers one task", async () => {
    await page.getByText("Pick my next task").click();
    await snapshot("Pick my next task chooser");
    await page.getByText("Decide for me").click();
    await page.getByText("ONE THING").waitFor();
    // The hero promised a small start, so the first offer is the remaining quick win.
    await page.getByText(QUICK_WIN_TITLE, { exact: true }).last().waitFor();
  });

  await step("Skip the suggestion and close", async () => {
    await page.getByText("Not now", { exact: true }).click();
    await snapshot("Next suggestion after Not now");
    await page.getByLabel("Close").last().click();
    await page.getByText("ONE THING").waitFor({ state: "detached" });
  });

  await step("Brain Dump understands three languages", async () => {
    await page.getByLabel("Brain dump: say everything at once").click();
    await page.getByText("BRAIN DUMP").waitFor();
    await page.locator("textarea").fill(BRAIN_DUMP_TEXT);
    await snapshot("Brain Dump text typed");
    await page.getByText("Sort it out").click();
    await page.getByText("Add 3 tasks").waitFor();
    // The Turkish bill gets its day and its category, like the other two.
    await page.getByText("Fri · 5 min · Home").waitFor();
  });

  await step("Add the Brain Dump tasks", async () => {
    await page.getByText("Add 3 tasks").click();
    await page.getByText("Done", { exact: true }).last().waitFor();
    await snapshot("Brain Dump result");
    await page.getByText("Done", { exact: true }).last().click();
    await page.getByText("BRAIN DUMP").waitFor({ state: "detached" });
  });

  await step("Pace shows today's numbers", async () => {
    await page.getByText("PACE", { exact: true }).click();
    await page.getByText("Your pace").waitFor();
    await page.getByText("CURRENT STREAK").waitFor();
  });

  await step("Settings opens", async () => {
    await page.getByText("SETTINGS", { exact: true }).click();
    await page.getByLabel("Theme", { exact: true }).waitFor();
  });

  await step("Sign-up catches a mistyped email", async () => {
    await page.getByText("Create account", { exact: true }).click();
    await page.getByLabel("First name", { exact: true }).fill("Bilge");
    await page.getByLabel("Last name", { exact: true }).fill("Ozcan");
    await page.getByLabel("Email", { exact: true }).fill(MISTYPED_EMAIL);
    await page.getByText("Email me a code", { exact: true }).click();
    await page.getByText(`Did you mean ${SUGGESTED_EMAIL}?`).waitFor();
    await snapshot("Typo question");
    await page.getByText("Yes, use that", { exact: true }).click();
    const email = await page.getByLabel("Email", { exact: true }).inputValue();
    if (email !== SUGGESTED_EMAIL) throw new Error(`email is "${email}", expected "${SUGGESTED_EMAIL}"`);
    await page.getByLabel("Close", { exact: true }).click();
    await page.getByLabel("Theme", { exact: true }).waitFor();
  });

  await step("Dark theme applies on Today", async () => {
    await page.getByLabel("Dark", { exact: true }).click();
    await page.getByText("TODAY", { exact: true }).click();
    await page.getByText("Today's plan").waitFor();
  });
});

process.exit(passed ? 0 : 1);
