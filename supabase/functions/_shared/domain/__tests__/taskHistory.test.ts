import { buildTaskHistory, findExactMatch, findMatches } from "../taskHistory";
import { makeTask } from "../testing/makeTask";

// Newest-first, as fetchTasks returns them.
const tasks = [
  makeTask({ id: "3", title: "Walk Bruno", actual_minutes: null, estimated_minutes: 20, timing: "after_work" }),
  makeTask({ id: "2", title: "walk bruno ", actual_minutes: 35, energy_level: "medium" }),
  makeTask({ id: "1", title: "Walk Bruno", actual_minutes: 25 }),
  makeTask({ id: "0", title: "Call vet", actual_minutes: 8 }),
];

describe("taskHistory", () => {
  it("groups titles case-insensitively and tracks min/max of real times", () => {
    const entry = findExactMatch(buildTaskHistory(tasks), "WALK BRUNO");
    expect(entry).toMatchObject({
      title: "Walk Bruno",
      timing: "after_work",
      energyLevel: "medium", // the newest entry has none, so the last known one is kept
      lastMinutes: 20,
      minMinutes: 25,
      maxMinutes: 35,
      timesCompleted: 2,
    });
  });

  it("suggests names that start with the query first", () => {
    const history = buildTaskHistory([...tasks, makeTask({ id: "4", title: "Buy vet food" })]);
    expect(findMatches(history, "v").map((e) => e.title)).toEqual(["Call vet", "Buy vet food"]);
    expect(findMatches(history, "wa").map((e) => e.title)).toEqual(["Walk Bruno"]);
  });
});
