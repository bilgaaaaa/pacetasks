import { heroMessage } from "../heroCopy";

const base = { count: 5, quickWinCount: 0, quickWinMinutes: 5, streakDays: 0, allDone: false };

describe("heroMessage", () => {
  it("celebrates a finished day and invites a first task on an empty one", () => {
    expect(heroMessage({ ...base, count: 0, allDone: true }).title).toBe("You did it.");
    expect(heroMessage({ ...base, count: 0 }).title).toBe("A clean slate.");
  });

  it("leads with a running streak", () => {
    expect(heroMessage({ ...base, streakDays: 3, quickWinCount: 2 })).toEqual({
      title: "3 days in a row.",
      body: "One task today keeps your streak alive.",
    });
  });

  it("suggests a quick win with the real count and threshold", () => {
    expect(heroMessage({ ...base, quickWinCount: 2 }).body).toBe("2 tasks take 5 minutes or less. One is a great start.");
    expect(heroMessage({ ...base, quickWinCount: 1, quickWinMinutes: 3 }).body).toBe(
      "1 task takes 3 minutes or less. One is a great start."
    );
  });

  it("falls back to a calm nudge", () => {
    expect(heroMessage(base).title).toBe("One step at a time.");
  });
});
