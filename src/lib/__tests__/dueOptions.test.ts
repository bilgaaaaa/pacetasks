import { DEFAULT_DUE_CHOICE, DueChoice, dueChoiceSummary, isSameDueChoice, resolveDueChoice } from "../dueOptions";

const MONDAY = "2026-09-28";
const SUNDAY = "2026-10-04";
const flexible = (when: "any" | "this_week" | "next_week"): DueChoice => ({ kind: "flexible", when });
const day = (dateKey: string): DueChoice => ({ kind: "day", dateKey });

describe("resolveDueChoice", () => {
  it("leaves 'Any day' undated, and that is the default", () => {
    expect(resolveDueChoice(flexible("any"), MONDAY)).toEqual({ due_date: null, due_kind: null });
    expect(DEFAULT_DUE_CHOICE).toEqual(flexible("any"));
  });

  it("dates a picked day as that exact day", () => {
    expect(resolveDueChoice(day(MONDAY), MONDAY)).toEqual({ due_date: MONDAY, due_kind: "on" });
    expect(resolveDueChoice(day("2026-11-17"), MONDAY)).toEqual({ due_date: "2026-11-17", due_kind: "on" });
  });

  it("makes 'This week' a deadline on the coming Sunday, or today on a Sunday", () => {
    expect(resolveDueChoice(flexible("this_week"), MONDAY)).toEqual({ due_date: SUNDAY, due_kind: "by" });
    expect(resolveDueChoice(flexible("this_week"), SUNDAY)).toEqual({ due_date: SUNDAY, due_kind: "by" });
  });

  it("makes 'Next week' a deadline on the Sunday after", () => {
    expect(resolveDueChoice(flexible("next_week"), MONDAY)).toEqual({ due_date: "2026-10-11", due_kind: "by" });
    expect(resolveDueChoice(flexible("next_week"), SUNDAY)).toEqual({ due_date: "2026-10-11", due_kind: "by" });
  });
});

describe("isSameDueChoice", () => {
  it("compares days by date and flexible choices by window", () => {
    expect(isSameDueChoice(day(MONDAY), day(MONDAY))).toBe(true);
    expect(isSameDueChoice(day(MONDAY), day(SUNDAY))).toBe(false);
    expect(isSameDueChoice(flexible("any"), flexible("any"))).toBe(true);
    expect(isSameDueChoice(flexible("any"), flexible("this_week"))).toBe(false);
    expect(isSameDueChoice(flexible("any"), day(MONDAY))).toBe(false);
  });
});

describe("dueChoiceSummary", () => {
  it("says when the task was added for, and nothing for 'Any day'", () => {
    expect(dueChoiceSummary(flexible("any"), MONDAY)).toBeNull();
    expect(dueChoiceSummary(flexible("this_week"), MONDAY)).toBe("for this week");
    expect(dueChoiceSummary(day(MONDAY), MONDAY)).toBe("for today");
    expect(dueChoiceSummary(day("2026-09-29"), MONDAY)).toBe("for tomorrow");
    expect(dueChoiceSummary(day("2026-10-01"), MONDAY)).toBe("for Thu");
    expect(dueChoiceSummary(day("2026-11-17"), MONDAY)).toBe("for 17 Nov");
  });
});
