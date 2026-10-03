import { makeTask } from "@domain/testing/makeTask";
import { oneThingEmptyMessage, oneThingMeta, remainingLabel } from "../oneThingCopy";

const TODAY = "2026-09-28";

describe("oneThingCopy", () => {
  it("describes a task in one line, leaving out what isn't set", () => {
    expect(oneThingMeta(makeTask({ estimated_minutes: 12 }), TODAY)).toBe("~12 min");
    expect(
      oneThingMeta(makeTask({ estimated_minutes: 12, due_date: TODAY, due_kind: "on", category: "health" }), TODAY)
    ).toBe("~12 min · Today · Health");
  });

  it("says what waits behind the current task", () => {
    expect(remainingLabel(0)).toBe("This is the last one");
    expect(remainingLabel(3)).toBe("3 more after this");
  });

  it("explains why there is no task", () => {
    expect(oneThingEmptyMessage(2)).toMatch(/passed on everything/);
    expect(oneThingEmptyMessage(0)).toMatch(/Nothing you can start/);
  });
});
