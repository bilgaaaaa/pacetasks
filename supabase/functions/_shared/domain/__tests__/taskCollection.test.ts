import { removeTask, upsertTask } from "../taskCollection";
import { makeTask } from "../testing/makeTask";

const older = makeTask({ id: "older", created_at: "2026-09-27T08:00:00.000Z" });
const newer = makeTask({ id: "newer", created_at: "2026-09-28T08:00:00.000Z" });

describe("upsertTask", () => {
  it("inserts a new task in newest-first position", () => {
    const middle = makeTask({ id: "middle", created_at: "2026-09-27T20:00:00.000Z" });
    expect(upsertTask([newer, older], middle).map((t) => t.id)).toEqual(["newer", "middle", "older"]);
    expect(upsertTask([older], newer).map((t) => t.id)).toEqual(["newer", "older"]);
  });

  it("replaces an existing task instead of duplicating it (local create + Realtime echo)", () => {
    const completed = { ...older, status: "done" as const };
    const result = upsertTask(upsertTask([newer, older], completed), completed);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["newer", "older"]);
    expect(result[1].status).toBe("done");
  });
});

describe("removeTask", () => {
  it("removes by id and returns the same list when the id is unknown", () => {
    const list = [newer, older];
    expect(removeTask(list, "older").map((t) => t.id)).toEqual(["newer"]);
    expect(removeTask(list, "missing")).toBe(list);
  });
});
