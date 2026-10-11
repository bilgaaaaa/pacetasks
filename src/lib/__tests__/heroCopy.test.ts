import { makeTask } from "@domain/testing/makeTask";
import { heroMessage, heroStart, HeroState } from "../heroCopy";

const TODAY = "2026-09-28";

const base: HeroState = {
  count: 5,
  quickWinCount: 0,
  quickWinMinutes: 5,
  streakDays: 0,
  doneToday: false,
  allDone: false,
  start: "other",
};

describe("heroStart", () => {
  it("names an overdue first pick before anything else", () => {
    expect(heroStart(makeTask({ due_date: "2026-09-20", estimated_minutes: 2 }), TODAY, 5)).toBe("overdue");
  });

  it("calls a short first pick a quick win, also when it is due today", () => {
    expect(heroStart(makeTask({ estimated_minutes: 5 }), TODAY, 5)).toBe("quick_win");
    expect(heroStart(makeTask({ estimated_minutes: 5, due_date: TODAY }), TODAY, 5)).toBe("quick_win");
  });

  it("promises nothing special for a longer pick or when nothing can be started", () => {
    expect(heroStart(makeTask({ estimated_minutes: 45, due_date: TODAY }), TODAY, 5)).toBe("other");
    expect(heroStart(null, TODAY, 5)).toBe("other");
  });
});

describe("heroMessage", () => {
  it("celebrates a finished day and invites a first task on an empty one", () => {
    expect(heroMessage({ ...base, count: 0, allDone: true }).title).toBe("You did it.");
    expect(heroMessage({ ...base, count: 0 }).title).toBe("A clean slate.");
  });

  it("leads with a streak that today's first task would keep alive", () => {
    expect(heroMessage({ ...base, streakDays: 3, quickWinCount: 2, start: "quick_win" })).toEqual({
      title: "3 days in a row.",
      body: "One task today keeps your streak alive.",
    });
  });

  it("drops the streak line once a task is done today", () => {
    expect(heroMessage({ ...base, streakDays: 4, doneToday: true }).title).toBe("One step at a time.");
  });

  it("says a task has been waiting when the first pick is overdue", () => {
    expect(heroMessage({ ...base, quickWinCount: 2, start: "overdue" })).toEqual({
      title: "Pick up where you left off.",
      body: "Something has been waiting a little while. It's a good place to start.",
    });
  });

  it("suggests a quick win with the real count and threshold when the first pick is one", () => {
    expect(heroMessage({ ...base, quickWinCount: 2, start: "quick_win" }).body).toBe(
      "2 tasks take 5 minutes or less. One is a great start."
    );
    expect(heroMessage({ ...base, quickWinCount: 1, quickWinMinutes: 3, start: "quick_win" }).body).toBe(
      "1 task takes 3 minutes or less. One is a great start."
    );
  });

  it("never promises a quick start when the first pick is a longer task", () => {
    expect(heroMessage({ ...base, quickWinCount: 2 })).toEqual({
      title: "One step at a time.",
      body: "Pick one task and give it your full attention.",
    });
  });
});
