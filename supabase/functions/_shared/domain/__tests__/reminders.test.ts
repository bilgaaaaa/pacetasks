import { localDateTime, nextStart, taskReminderMoment } from "../reminders";
import { makeTask } from "../testing/makeTask";

// Jest runs in Europe/Rome; "now" is Monday 12 Oct 2026, 08:30 local time.
const NOW = new Date(2026, 9, 12, 8, 30);

describe("localDateTime", () => {
  it("reads HH:MM and the database's HH:MM:SS, and rejects a malformed time", () => {
    expect(localDateTime("2026-10-12", "18:30")).toEqual(new Date(2026, 9, 12, 18, 30));
    expect(localDateTime("2026-10-12", "18:30:00")).toEqual(new Date(2026, 9, 12, 18, 30));
    expect(localDateTime("2026-10-12", "25:00")).toBeNull();
  });
});

describe("nextStart", () => {
  it("uses a later day the task is set for", () => {
    const task = makeTask({ scheduled_time: "15:00", due_date: "2026-10-15", due_kind: "on" });
    expect(nextStart(task, NOW)).toEqual(new Date(2026, 9, 15, 15, 0));
  });

  it("starts an undated or overdue task today while its moment is still ahead", () => {
    expect(nextStart(makeTask({ scheduled_time: "18:30", reminder_minutes_before: 10 }), NOW)).toEqual(
      new Date(2026, 9, 12, 18, 30)
    );
    const overdue = makeTask({ scheduled_time: "15:00", due_date: "2026-10-10", due_kind: "on" });
    expect(nextStart(overdue, NOW)).toEqual(new Date(2026, 9, 12, 15, 0));
  });

  it("moves to tomorrow once today's reminder moment has passed", () => {
    const task = makeTask({ scheduled_time: "08:40", reminder_minutes_before: 15 });
    expect(nextStart(task, NOW)).toEqual(new Date(2026, 9, 13, 8, 40));
  });

  it("never goes past a deadline that is still ahead", () => {
    const dueToday = makeTask({ scheduled_time: "07:00", due_date: "2026-10-12", due_kind: "by" });
    expect(nextStart(dueToday, NOW)).toBeNull();
    const dueFriday = makeTask({ scheduled_time: "07:00", due_date: "2026-10-16", due_kind: "by" });
    expect(nextStart(dueFriday, NOW)).toEqual(new Date(2026, 9, 13, 7, 0));
  });

  it("needs a time", () => {
    expect(nextStart(makeTask({ scheduled_time: null }), NOW)).toBeNull();
  });
});

describe("taskReminderMoment", () => {
  it("fires the chosen minutes before the start", () => {
    const task = makeTask({ id: "t", scheduled_time: "15:00", reminder_minutes_before: 15 });
    expect(taskReminderMoment(task, NOW)).toEqual({
      taskId: "t",
      fireAt: new Date(2026, 9, 12, 14, 45),
      startsAt: new Date(2026, 9, 12, 15, 0),
    });
  });

  it("skips tasks without a reminder, and finished or parked tasks", () => {
    const base = { scheduled_time: "15:00" };
    expect(taskReminderMoment(makeTask({ ...base, reminder_minutes_before: null }), NOW)).toBeNull();
    expect(taskReminderMoment(makeTask({ ...base, reminder_minutes_before: 0, status: "done" }), NOW)).toBeNull();
    expect(taskReminderMoment(makeTask({ ...base, reminder_minutes_before: 0, status: "someday" }), NOW)).toBeNull();
  });
});
