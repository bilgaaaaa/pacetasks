import { makeTask } from "@domain/testing/makeTask";
import type { ResetItem } from "@domain/weeklyReset";
import { currentItem, recordDecision, sessionPhase, startSession } from "../weeklyResetState";

const items: ResetItem[] = [
  { task: makeTask({ id: "a" }), reason: "overdue" },
  { task: makeTask({ id: "b" }), reason: "undated_old" },
];

describe("weeklyResetState", () => {
  it("is in the intro until a session starts", () => {
    expect(sessionPhase(null)).toBe("intro");
    expect(currentItem(null)).toBeNull();
  });

  it("walks through the items, counting each decision", () => {
    let session = startSession(items);
    expect(sessionPhase(session)).toBe("reviewing");
    expect(currentItem(session)?.task.id).toBe("a");

    session = recordDecision(session, "scheduled");
    expect(currentItem(session)?.task.id).toBe("b");

    session = recordDecision(session, "deleted");
    expect(sessionPhase(session)).toBe("summary");
    expect(currentItem(session)).toBeNull();
    expect(session.tally).toEqual({ scheduled: 1, parked: 0, deleted: 1, kept: 0 });
  });

  it("ignores decisions once every item is decided", () => {
    const finished = recordDecision(recordDecision(startSession(items), "kept"), "kept");

    expect(recordDecision(finished, "parked")).toBe(finished);
  });

  it("goes straight to the summary when there is nothing to review", () => {
    expect(sessionPhase(startSession([]))).toBe("summary");
  });
});
