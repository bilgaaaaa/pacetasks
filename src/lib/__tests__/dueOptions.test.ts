import { resolveDueOption } from "../dueOptions";

const MONDAY = "2026-09-28";
const SUNDAY = "2026-10-04";

describe("resolveDueOption", () => {
  it("leaves 'Any day' undated", () => {
    expect(resolveDueOption("any", MONDAY)).toEqual({ due_date: null, due_kind: null });
  });

  it("dates today and tomorrow as that exact day", () => {
    expect(resolveDueOption("today", MONDAY)).toEqual({ due_date: MONDAY, due_kind: "on" });
    expect(resolveDueOption("tomorrow", MONDAY)).toEqual({ due_date: "2026-09-29", due_kind: "on" });
  });

  it("makes 'This week' a deadline on the coming Sunday", () => {
    expect(resolveDueOption("this_week", MONDAY)).toEqual({ due_date: SUNDAY, due_kind: "by" });
    expect(resolveDueOption("this_week", SUNDAY)).toEqual({ due_date: SUNDAY, due_kind: "by" });
  });
});
