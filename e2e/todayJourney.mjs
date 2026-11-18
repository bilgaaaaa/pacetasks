import { runJourney } from "./harness.mjs";

// One simulated day in PaceTasks, start to finish: finish a task, sort out what
// was carried over, add tasks for today and for later, let the app pick the next,
// dump a few thoughts, tidy up (Someday, Weekly Reset), rescue the evening, then check Pace, the
// themes, an account and dark mode.
// Elements are found by the same labels and wording a person (or VoiceOver) meets.

const NEW_TASK_TITLE = "Buy cat food";
const LATER_TASK_TITLE = "Water the plants";
const PLANNED_TASK_TITLE = "Pick up the parcel";
// Thursday of the harness's fixed week (it starts on Monday 12 October 2026).
const LATER_DAY = { pickerLabel: /^Thu 15 /, weekStripLabel: /^Thu 15(,|$)/, heading: "Thu 15 Oct" };
const SOMEDAY_TASK_TITLE = "Learn Spanish";
const COLOR_THEMES = ["Pastel Night", "Sunny", "Sage"]; // ends on the default, so later shots stay comparable
// The demo backend accepts any code except 000000.
const ACCOUNT = { firstName: "Ada", lastName: "Rossi", email: "ada@example.com", code: "123456" };
const WEEKLY_RESET_MAX_DECISIONS = 12;
const REPEAT_TASK_TITLE = "Stretch for ten minutes";
// Evening of the harness's fixed day, when the rest of the list no longer fits before 22:00.
const RESCUE_TIME = "2026-10-12T21:30:00+02:00";
const BRAIN_DUMP_TEXT = "Tomorrow call the vet, domani comprare il pane, cuma günü faturayı öde";

const passed = await runJourney("today-journey", async ({ page, baseUrl, step, snapshot }) => {
  await step("Today loads with the seeded day", async () => {
    await page.goto(baseUrl);
    await page.getByText("Good morning").waitFor();
    await page.getByText("Today's plan").waitFor();
  });

  await step("Back out of an accidental completion", async () => {
    await page.getByLabel("Complete Call the dentist").click();
    await snapshot("Minutes on their own line, with Cancel");
    await page.getByLabel("Cancel completing Call the dentist").click();
    await page.getByLabel("Options for Call the dentist").waitFor();
  });

  await step("Complete a quick win", async () => {
    await page.getByLabel("Complete Call the dentist").click();
    await snapshot("Confirm the minutes it took");
    await page.getByText("Done", { exact: true }).first().click();
    await page.getByLabel("Complete Call the dentist").waitFor({ state: "detached" });
  });

  await step("Review what was carried over and apply", async () => {
    await page.getByLabel(/carried over/).click();
    await snapshot("Carried-over tasks with proposed days");
    await page.getByText("Apply changes").click();
    await page.getByText("Apply changes").waitFor({ state: "detached" });
  });

  await step("Add a new task", async () => {
    await page.getByLabel("Add a task").click();
    await snapshot("Add sheet opens with your usuals");
    await page.getByPlaceholder("What needs doing?").fill(NEW_TASK_TITLE);
    await page.getByLabel("Duration: 5 minutes").click();
    await page.getByRole("radio", { name: "15 min", exact: true }).click();
    await snapshot("Duration panel");
    await page.getByLabel("Time and reminder").click();
    await page.getByRole("radio", { name: "At", exact: true }).click();
    // The hour is typed: any time can be entered, not only the shortcuts.
    await page.getByLabel(/^hour, /).fill("18");
    await page.getByRole("radio", { name: "15 min", exact: true }).last().click();
    await page.getByText("We'll nudge you at 17:45 today.").waitFor();
    await snapshot("Start time with a reminder");
    await page.getByText(`Add “${NEW_TASK_TITLE}”`).click();
    await page.getByText(`Added “${NEW_TASK_TITLE}”`).waitFor();
    await snapshot("Added, with Undo");
    // The sheet stays open for more tasks; the close button ends it.
    await page.getByLabel("Close", { exact: true }).click();
    await page.getByLabel(`Start focus session for ${NEW_TASK_TITLE}`).waitFor();
  });

  await step("Add a task for a later day", async () => {
    await page.getByLabel("Add a task").click();
    await page.getByPlaceholder("What needs doing?").fill(LATER_TASK_TITLE);
    await page.getByLabel("Day: Any day").click();
    await page.getByLabel(LATER_DAY.pickerLabel).click();
    await snapshot("New task set for Thursday");
    await page.getByText(`Add “${LATER_TASK_TITLE}”`).click();
    await page.getByText(`Added “${LATER_TASK_TITLE}” for Thu`).waitFor();
    await page.getByLabel("Close", { exact: true }).click();
    // Set for Thursday, so Today does not list it.
    await page.getByText(/^Upcoming · \d+$/).waitFor();
    await page.getByLabel(`Complete ${LATER_TASK_TITLE}`).waitFor({ state: "detached" });
  });

  await step("A daily task comes back tomorrow once it's done", async () => {
    await page.getByLabel("Add a task").click();
    await page.getByPlaceholder("What needs doing?").fill(REPEAT_TASK_TITLE);
    await page.getByLabel("Day: Any day").click();
    await page.getByRole("radio", { name: "Every day", exact: true }).click();
    await page.getByLabel("Day: Today · ↻ Every day").waitFor();
    await snapshot("Repeat set to every day");
    await page.getByText(`Add “${REPEAT_TASK_TITLE}”`).click();
    await page.getByLabel("Close", { exact: true }).click();
    await page.getByText(/↻ Every day/).first().waitFor();
    await page.getByLabel(`Complete ${REPEAT_TASK_TITLE}`).click();
    await page.getByText("Done", { exact: true }).first().click();
    // Done for today; tomorrow's occurrence waits in Upcoming.
    await page.getByLabel(`Complete ${REPEAT_TASK_TITLE}`).waitFor({ state: "detached" });
    await page.getByText(/^Upcoming · \d+$/).click();
    await page.getByLabel(`Move to Today: ${REPEAT_TASK_TITLE}`).waitFor();
    await page.getByLabel("Close").last().click();
    await page.getByText("UPCOMING", { exact: true }).waitFor({ state: "detached" });
  });

  await step("Upcoming lists it under its day", async () => {
    await page.getByText(/^Upcoming · \d+$/).click();
    await page.getByText("UPCOMING", { exact: true }).waitFor();
    await page.getByText(LATER_DAY.heading, { exact: true }).waitFor();
    await page.getByLabel(`Move to Today: ${LATER_TASK_TITLE}`).waitFor();
    await snapshot("Upcoming sheet grouped by day");
    await page.getByLabel("Close").last().click();
    await page.getByText("UPCOMING", { exact: true }).waitFor({ state: "detached" });
  });

  await step("Thursday in the week strip shows that day, and a task added there is set for it", async () => {
    await page.getByLabel(LATER_DAY.weekStripLabel).click();
    await page.getByText("Planned ahead.").waitFor();
    await page.getByLabel(`Complete ${LATER_TASK_TITLE}`).waitFor();
    await snapshot("Thursday shown in place of today");
    await page.getByLabel("Add a task").click();
    await page.getByPlaceholder("What needs doing?").fill(PLANNED_TASK_TITLE);
    await page.getByLabel("Day: Thu").waitFor();
    await page.getByText(`Add “${PLANNED_TASK_TITLE}”`).click();
    await page.getByText(`Added “${PLANNED_TASK_TITLE}” for Thu`).waitFor();
    await page.getByLabel("Close", { exact: true }).click();
    await page.getByLabel(`Complete ${PLANNED_TASK_TITLE}`).waitFor();
    await page.getByLabel("Back to today").click();
    await page.getByText("Good morning").waitFor();
    await page.getByLabel(`Complete ${PLANNED_TASK_TITLE}`).waitFor({ state: "detached" });
  });

  await step("Upcoming moves Thursday's task to Today", async () => {
    await page.getByText(/^Upcoming · \d+$/).click();
    await page.getByLabel(`Move to Today: ${LATER_TASK_TITLE}`).click();
    await page.getByLabel(`Move to Today: ${LATER_TASK_TITLE}`).waitFor({ state: "detached" });
    await page.getByLabel("Close").last().click();
    await page.getByLabel(`Complete ${LATER_TASK_TITLE}`).waitFor();
  });

  await step("Decide for me offers one task", async () => {
    await page.getByText("Pick my next task").click();
    await snapshot("Pick my next task chooser");
    await page.getByText("Decide for me").click();
    await page.getByText("ONE THING").waitFor();
  });

  await step("Skip the suggestion and close", async () => {
    await page.getByText("Not now", { exact: true }).click();
    await snapshot("Next suggestion after Not now");
    await page.getByLabel("Close").last().click();
    await page.getByText("ONE THING").waitFor({ state: "detached" });
  });

  await step("Fit my time narrows the list to 15 minutes", async () => {
    await page.getByText("Pick my next task").click();
    await page.getByText("Fit my time").click();
    await page.getByText("DO NOW", { exact: true }).waitFor();
    await page.getByRole("radiogroup", { name: "Time available" }).getByText("15 min", { exact: true }).click();
    await page.getByText("Do these now").waitFor();
    await snapshot("Fit my time with 15 minutes");
    await page.getByLabel("Close").last().click();
    await page.getByText("DO NOW", { exact: true }).waitFor({ state: "detached" });
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

  await step("Bring a task back from Someday", async () => {
    await page.getByText(/^Someday · \d+ parked$/).click();
    await page.getByText("SOMEDAY", { exact: true }).waitFor();
    await snapshot("Someday sheet");
    await page.getByLabel(`Bring back: ${SOMEDAY_TASK_TITLE}`).click();
    await page.getByLabel(`Bring back: ${SOMEDAY_TASK_TITLE}`).waitFor({ state: "detached" });
    await page.getByLabel("Close").last().click();
    await page.getByLabel(`Complete ${SOMEDAY_TASK_TITLE}`).waitFor();
  });

  await step("Weekly Reset walks through each decision to the summary", async () => {
    await page.getByText(/^Weekly reset · \d+ to review$/).click();
    await page.getByText("Let's clean up your brain.").waitFor();
    await snapshot("Weekly Reset intro");
    await page.getByText("Start", { exact: true }).click();
    await page.getByText(/^WEEKLY RESET · 1 OF \d+$/).waitFor();
    await snapshot("First task to decide");
    await page.getByText("Tomorrow", { exact: true }).last().click();
    await page.getByText(/^WEEKLY RESET · 2 OF \d+$/).waitFor();
    await snapshot("Second task to decide");
    // Whatever is left is kept as it is, until the reset reports what it did.
    const summary = page.getByText("Reset done.");
    for (let decided = 1; decided < WEEKLY_RESET_MAX_DECISIONS && !(await summary.isVisible()); decided += 1) {
      await page.getByText("Keep as is", { exact: true }).click();
      await page.getByText(new RegExp(`^WEEKLY RESET · ${decided + 1} OF \\d+$`)).waitFor({ state: "detached" });
    }
    await summary.waitFor();
    await snapshot("Weekly Reset summary");
    await page.getByText("Close", { exact: true }).last().click();
    await summary.waitFor({ state: "detached" });
  });

  await step("Weekly Reset stops asking about the tasks that were kept", async () => {
    // One task was moved to tomorrow and the rest were kept, so nothing is left to review this week.
    const weeklyResetLink = page.getByText(/^Weekly reset · /);
    await page.getByText(/^Someday · \d+ parked$/).scrollIntoViewIfNeeded();
    await weeklyResetLink.waitFor({ state: "detached" });
  });

  await step("Rescue my day offers to move what no longer fits the evening", async () => {
    // Late in the day what's left can't all fit. Leaving the app and coming back makes Today read the new time.
    await page.clock.setSystemTime(new Date(RESCUE_TIME));
    await page.evaluate(() => {
      for (const state of ["hidden", "visible"]) {
        Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      }
    });
    await page.getByLabel(/^Running behind · /).click();
    await snapshot("Rescue my day with proposed moves");
    await page.getByText("Not now", { exact: true }).click();
    await page.getByLabel(/^Running behind · /).waitFor({ state: "detached" });
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

  await step("Each colour theme applies", async () => {
    for (const colorTheme of COLOR_THEMES) {
      await page.getByLabel(colorTheme, { exact: true }).click();
      await snapshot(`${colorTheme} theme`);
    }
  });

  await step("Create an account with the emailed code", async () => {
    await page.getByText("Create account", { exact: true }).click();
    await page.getByLabel("First name").fill(ACCOUNT.firstName);
    await page.getByLabel("Last name").fill(ACCOUNT.lastName);
    await page.getByLabel("Email", { exact: true }).fill(ACCOUNT.email);
    await snapshot("Account details");
    await page.getByText("Email me a code").click();
    await page.getByLabel("Code", { exact: true }).fill(ACCOUNT.code);
    await page.getByText("Confirm", { exact: true }).click();
    await page.getByText(`You're all set, ${ACCOUNT.firstName}.`).waitFor();
    await snapshot("Account created");
    await page.getByText("Close", { exact: true }).last().click();
    await page.getByText(`${ACCOUNT.firstName} ${ACCOUNT.lastName}`).waitFor();
  });

  await step("Dark theme applies on Today", async () => {
    await page.getByLabel("Dark", { exact: true }).click();
    await page.getByText("TODAY", { exact: true }).click();
    await page.getByText("Today's plan").waitFor();
    // Today is still scrolled down to its footer links; the film ends on the hero at the top of the list.
    await page.getByText("Pick my next task").evaluate((heroAction) => heroAction.scrollIntoView({ block: "end" }));
  });
});

process.exit(passed ? 0 : 1);
