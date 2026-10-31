import {
  formatClockTime,
  reminderChipLabel,
  reminderHint,
  reminderLabel,
  taskReminderCopy,
} from "../reminderCopy";

// Jest runs in Europe/Rome; "now" is Monday 12 Oct 2026, 08:30 local time.
const NOW = new Date(2026, 9, 12, 8, 30);

describe("reminderLabel", () => {
  it.each([
    [null, "No reminder"],
    [0, "At start"],
    [15, "15 min before"],
    [60, "1 hour before"],
    [120, "2 hours before"],
  ])("%s → %s", (minutes, expected) => {
    expect(reminderLabel(minutes)).toBe(expected);
  });
});

describe("reminderChipLabel", () => {
  it.each([
    [null, "Off"],
    [0, "At start"],
    [10, "10 min"],
    [60, "1 hour"],
  ])("%s → %s", (minutes, expected) => {
    expect(reminderChipLabel(minutes)).toBe(expected);
  });
});

describe("reminderHint", () => {
  it("says the time and the day of the nudge", () => {
    expect(reminderHint({ fireAt: new Date(2026, 9, 12, 14, 45) }, NOW)).toBe("We'll nudge you at 14:45 today.");
    expect(reminderHint({ fireAt: new Date(2026, 9, 15, 9, 0) }, NOW)).toBe("We'll nudge you at 09:00 on Thu.");
  });

  it("explains when there is nothing left to remind", () => {
    expect(reminderHint(null, NOW)).toMatch(/already passed/);
  });
});

describe("taskReminderCopy", () => {
  const task = { title: "Buy cat food", estimated_minutes: 15 };
  const start = new Date(2026, 9, 12, 18, 30);

  it("reads differently at the start and ahead of it", () => {
    expect(taskReminderCopy(task, { fireAt: start, startsAt: start })).toEqual({
      title: "Buy cat food",
      body: "Starting now, about 15 min.",
    });
    expect(taskReminderCopy(task, { fireAt: new Date(2026, 9, 12, 18, 20), startsAt: start }).body).toBe(
      "Starts in 10 minutes, at 18:30."
    );
    expect(taskReminderCopy(task, { fireAt: new Date(2026, 9, 12, 17, 30), startsAt: start }).body).toBe(
      "Starts in 1 hour, at 18:30."
    );
  });
});

describe("formatClockTime", () => {
  it("pads hours and minutes", () => {
    expect(formatClockTime(new Date(2026, 9, 12, 7, 5))).toBe("07:05");
  });
});
