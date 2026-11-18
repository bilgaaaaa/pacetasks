import { makeTask } from "@domain/testing/makeTask";
import { planReminders, REMINDER_POLICY, ReminderSettings } from "../reminderPlan";

const SETTINGS: ReminderSettings = { reminder_enabled: true, reminder_time: "18:30", task_reminder_enabled: true };
const at = (day: string, time: string) => new Date(`${day}T${time}:00`); // phone-local, like the app
const NOON = at("2026-10-12", "12:00");

describe("planReminders: daily check-in", () => {
  it("plans one check-in per day at the user's time while a task is open", () => {
    const plan = planReminders([makeTask()], SETTINGS, NOON);
    expect(plan).toHaveLength(REMINDER_POLICY.checkInDays);
    expect(plan[0]).toMatchObject({ id: "pacetasks-check-in-2026-10-12", kind: "check_in", at: at("2026-10-12", "18:30") });
    expect(plan[1].at).toEqual(at("2026-10-13", "18:30"));
  });

  it("stays silent when nothing is open", () => {
    expect(planReminders([], SETTINGS, NOON)).toEqual([]);
    expect(planReminders([makeTask({ status: "done" }), makeTask({ status: "someday" })], SETTINGS, NOON)).toEqual([]);
  });

  it("skips today once the time has passed", () => {
    const plan = planReminders([makeTask()], SETTINGS, at("2026-10-12", "18:30"));
    expect(plan[0].id).toBe("pacetasks-check-in-2026-10-13");
    expect(plan).toHaveLength(REMINDER_POLICY.checkInDays - 1);
  });

  it("starts on the day a later task becomes due", () => {
    const plan = planReminders([makeTask({ due_date: "2026-10-14", due_kind: "on" })], SETTINGS, NOON);
    expect(plan.map((r) => r.id)).toEqual([
      "pacetasks-check-in-2026-10-14",
      "pacetasks-check-in-2026-10-15",
      "pacetasks-check-in-2026-10-16",
    ]);
  });

  it("is off when the user turned it off, and ignores a malformed time", () => {
    expect(planReminders([makeTask()], { ...SETTINGS, reminder_enabled: false }, NOON)).toEqual([]);
    expect(planReminders([makeTask()], { ...SETTINGS, reminder_time: "soon" }, NOON)).toEqual([]);
  });

  it("accepts the database's HH:MM:SS time", () => {
    const plan = planReminders([makeTask()], { ...SETTINGS, reminder_time: "18:30:00" }, NOON);
    expect(plan[0].at).toEqual(at("2026-10-12", "18:30"));
  });

  it("keeps the same clock time across the end of summer time", () => {
    const plan = planReminders([makeTask()], SETTINGS, at("2026-10-24", "12:00"));
    expect(plan.slice(0, 3).map((r) => [r.at.getHours(), r.at.getMinutes()])).toEqual([[18, 30], [18, 30], [18, 30]]);
    expect(plan[1].id).toBe("pacetasks-check-in-2026-10-25"); // the day the clocks go back in Europe/Rome
  });

  it("says what is left and points at the quickest task", () => {
    const one = planReminders([makeTask({ title: "Haircut", estimated_minutes: 60 })], SETTINGS, NOON)[0];
    expect(one).toMatchObject({ title: "One thing left today", body: "Haircut, about 60 min." });
    const two = planReminders(
      [makeTask({ id: "a", title: "Haircut", estimated_minutes: 60 }), makeTask({ id: "b", title: "Shower", estimated_minutes: 15 })],
      SETTINGS,
      NOON
    )[0];
    expect(two).toMatchObject({ title: "2 things left today", body: "The quickest is Shower, about 15 min." });
  });
});

describe("planReminders: task reminders", () => {
  const ONLY_TASKS: ReminderSettings = { ...SETTINGS, reminder_enabled: false };

  it("reminds at the lead time picked on the task", () => {
    const task = makeTask({ id: "t1", title: "Haircut", scheduled_time: "17:00", reminder_minutes_before: 10 });
    expect(planReminders([task], ONLY_TASKS, NOON)).toEqual([
      { id: "pacetasks-task-t1", kind: "task", at: at("2026-10-12", "16:50"), title: "Haircut", body: "Starts in 10 minutes, at 17:00." },
    ]);
  });

  it("uses a later day the task is set for, and today for an overdue one", () => {
    const later = makeTask({ id: "later", scheduled_time: "09:00", due_date: "2026-10-15", due_kind: "on", reminder_minutes_before: 10 });
    const overdue = makeTask({ id: "overdue", scheduled_time: "15:00", due_date: "2026-10-10", due_kind: "on", reminder_minutes_before: 10 });
    const plan = planReminders([later, overdue], ONLY_TASKS, NOON);
    expect(plan.map((r) => [r.id, r.at])).toEqual([
      ["pacetasks-task-overdue", at("2026-10-12", "14:50")],
      ["pacetasks-task-later", at("2026-10-15", "08:50")],
    ]);
  });

  it("skips tasks without a reminder, finished or parked ones, and days past the horizon", () => {
    const tasks = [
      makeTask({ id: "no-reminder", scheduled_time: "17:00" }),
      makeTask({ id: "done", scheduled_time: "17:00", reminder_minutes_before: 0, status: "done" }),
      makeTask({ id: "parked", scheduled_time: "17:00", reminder_minutes_before: 0, status: "someday" }),
      makeTask({ id: "far", scheduled_time: "17:00", reminder_minutes_before: 0, due_date: "2026-10-19", due_kind: "on" }),
      makeTask({ id: "untimed" }),
    ];
    expect(planReminders(tasks, ONLY_TASKS, NOON)).toEqual([]);
  });

  it("keeps every reminder the user asked for on a busy day", () => {
    const tasks = ["13:00", "14:00", "15:00", "16:00", "17:00"].map((time, i) =>
      makeTask({ id: `t${i}`, scheduled_time: time, reminder_minutes_before: 5 })
    );
    expect(planReminders(tasks, ONLY_TASKS, NOON)).toHaveLength(5);
  });

  it("is off when the user turned it off", () => {
    const task = makeTask({ scheduled_time: "17:00", reminder_minutes_before: 10 });
    expect(planReminders([task], { ...ONLY_TASKS, task_reminder_enabled: false }, NOON)).toEqual([]);
  });
});

describe("planReminders", () => {
  it("returns check-ins and task reminders together, earliest first", () => {
    const plan = planReminders([makeTask({ id: "t1", scheduled_time: "20:00", reminder_minutes_before: 10 })], SETTINGS, NOON);
    expect(plan.slice(0, 2).map((r) => r.id)).toEqual(["pacetasks-check-in-2026-10-12", "pacetasks-task-t1"]);
  });
});
