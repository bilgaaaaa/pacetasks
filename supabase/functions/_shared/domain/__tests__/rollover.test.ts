import { isUnfinished, proposeRollover, rolloverPatch } from "../rollover";
import { makeTask } from "../testing/makeTask";

const TODAY = "2026-09-28"; // a Monday
const YESTERDAY = "2026-09-27";

describe("isUnfinished", () => {
  it("is a pending task whose day has passed", () => {
    expect(isUnfinished(makeTask({ due_date: YESTERDAY }), TODAY)).toBe(true);
  });

  it("ignores undated, current, finished and parked tasks", () => {
    expect(isUnfinished(makeTask({ due_date: null }), TODAY)).toBe(false);
    expect(isUnfinished(makeTask({ due_date: TODAY }), TODAY)).toBe(false);
    expect(isUnfinished(makeTask({ due_date: YESTERDAY, status: "done" }), TODAY)).toBe(false);
    expect(isUnfinished(makeTask({ due_date: YESTERDAY, status: "someday" }), TODAY)).toBe(false);
  });
});

describe("proposeRollover", () => {
  it("brings missed deadlines and high-priority tasks to today", () => {
    const proposals = proposeRollover(
      [
        makeTask({ id: "deadline", due_date: YESTERDAY, due_kind: "by" }),
        makeTask({ id: "urgent", due_date: YESTERDAY, priority: "high", postponed_count: 5 }),
      ],
      TODAY
    );

    expect(proposals.map((p) => [p.task.id, p.destination, p.reason])).toEqual([
      ["deadline", "today", "deadline_passed"],
      ["urgent", "today", "high_priority"],
    ]);
  });

  it("parks tasks that keep being postponed and sends maybe tasks to the weekend", () => {
    const proposals = proposeRollover(
      [
        makeTask({ id: "stuck", due_date: YESTERDAY, postponed_count: 3 }),
        makeTask({ id: "maybe", due_date: YESTERDAY, flexible: true }),
      ],
      TODAY
    );

    expect(proposals.map((p) => [p.task.id, p.destination, p.reason])).toEqual([
      ["stuck", "someday", "postponed_often"],
      ["maybe", "weekend", "maybe"],
    ]);
  });

  it("fills today's leftover budget oldest first and moves the rest to tomorrow", () => {
    const proposals = proposeRollover(
      [
        makeTask({ id: "newer", due_date: YESTERDAY, estimated_minutes: 30 }),
        makeTask({ id: "oldest", due_date: "2026-09-20", estimated_minutes: 40 }),
        makeTask({ id: "small", due_date: YESTERDAY, estimated_minutes: 15, created_at: "2026-09-28T09:00:00.000Z" }),
      ],
      TODAY
    );

    expect(proposals.map((p) => [p.task.id, p.destination, p.reason])).toEqual([
      ["oldest", "today", "fits_today"],
      ["newer", "tomorrow", "today_full"],
      ["small", "today", "fits_today"],
    ]);
  });

  it("counts must-do tasks against today's budget before ordinary ones", () => {
    const proposals = proposeRollover(
      [
        makeTask({ id: "ordinary", due_date: "2026-09-20", estimated_minutes: 30 }),
        makeTask({ id: "deadline", due_date: YESTERDAY, due_kind: "by", estimated_minutes: 50 }),
      ],
      TODAY
    );

    expect(proposals.map((p) => [p.task.id, p.destination])).toEqual([
      ["ordinary", "tomorrow"],
      ["deadline", "today"],
    ]);
  });

  it("proposes nothing when no task was left unfinished", () => {
    expect(proposeRollover([makeTask(), makeTask({ id: "today", due_date: TODAY })], TODAY)).toEqual([]);
  });
});

describe("rolloverPatch", () => {
  const task = makeTask({ due_date: YESTERDAY, due_kind: "by" });

  it("moves the date and keeps whether it is a day or a deadline", () => {
    expect(rolloverPatch(task, "today", TODAY)).toEqual({ due_date: "2026-09-28", due_kind: "by" });
    expect(rolloverPatch(task, "tomorrow", TODAY)).toEqual({ due_date: "2026-09-29", due_kind: "by" });
    expect(rolloverPatch(task, "weekend", TODAY)).toEqual({ due_date: "2026-10-03", due_kind: "by" });
    expect(rolloverPatch(makeTask({ due_date: YESTERDAY }), "today", TODAY)).toEqual({
      due_date: "2026-09-28",
      due_kind: "on",
    });
  });

  it("parks a task as someday without a date", () => {
    expect(rolloverPatch(task, "someday", TODAY)).toEqual({ status: "someday", due_date: null, due_kind: null });
  });
});
