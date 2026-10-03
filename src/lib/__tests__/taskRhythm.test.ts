import { makeTask } from "@domain/testing/makeTask";
import { buildTaskRhythms, describeLastDone, isLate, selectUsuals } from "../taskRhythm";

const TODAY = "2026-09-29";

// Noon local time keeps the completion on the intended calendar day in any time zone.
const doneOn = (id: string, title: string, day: string, extra = {}) =>
  makeTask({ id, title, status: "done", completed_at: new Date(`${day}T12:00:00`).toISOString(), ...extra });

const tasks = [
  doneOn("l1", "White laundry", "2026-09-06", { actual_minutes: 15 }),
  doneOn("l2", "white laundry", "2026-09-13", { actual_minutes: 20 }),
  doneOn("l3", "White laundry ", "2026-09-20", { actual_minutes: 18, category: "home", timing: "after_work" }),
  doneOn("c1", "Call mom", "2026-09-19"),
  doneOn("c2", "Call mom", "2026-09-24"),
  doneOn("c3", "Call mom", "2026-09-27"),
  doneOn("d1", "Dentist check-up", "2026-04-28"),
  doneOn("g1", "Groceries", "2026-09-22"),
  doneOn("g2", "Groceries", "2026-09-26"),
  makeTask({ id: "g3", title: "groceries", status: "pending" }),
];

describe("taskRhythm", () => {
  it("learns the last day, count and median gap per task name", () => {
    const laundry = buildTaskRhythms(tasks, TODAY).find((r) => r.key === "white laundry")!;
    expect(laundry).toMatchObject({
      title: "White laundry",
      category: "home",
      timing: "after_work",
      lastMinutes: 18,
      timesDone: 3,
      lastDoneKey: "2026-09-20",
      daysSince: 9,
      usualGapDays: 7,
      lateByDays: 2,
    });
    expect(isLate(laundry)).toBe(true);
    expect(describeLastDone(laundry)).toBe("9 days ago · usually 7");
  });

  it("has no rhythm for a task done only once", () => {
    const dentist = buildTaskRhythms(tasks, TODAY).find((r) => r.key === "dentist check-up")!;
    expect(dentist.usualGapDays).toBeNull();
    expect(isLate(dentist)).toBe(false);
  });

  it("picks repeat tasks not already pending, most overdue first", () => {
    expect(selectUsuals(tasks, TODAY).map((r) => r.key)).toEqual(["white laundry", "call mom"]);
    expect(selectUsuals(tasks, TODAY, 1)).toHaveLength(1);
  });

  it("describes today and yesterday in words", () => {
    const [mom] = buildTaskRhythms([doneOn("x", "Call mom", TODAY)], TODAY);
    expect(describeLastDone(mom)).toBe("Today");
    expect(describeLastDone({ ...mom, daysSince: 1 })).toBe("Yesterday");
  });
});
