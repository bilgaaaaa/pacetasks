import { resolveDate } from "../resolveDate";

const MONDAY = "2026-09-28";

describe("resolveDate", () => {
  it("resolves relative days (domani / yarın / tomorrow)", () => {
    expect(resolveDate({ kind: "relative_day", offsetDays: 1, relation: "on", text: "domani" }, MONDAY)).toEqual({
      ok: true,
      dueDate: "2026-09-29",
      dueKind: "on",
      inPast: false,
    });
    expect(resolveDate({ kind: "relative_day", offsetDays: 0, relation: "by", text: "today" }, MONDAY)).toMatchObject({
      dueDate: MONDAY,
      dueKind: "by",
    });
  });

  it("resolves weekdays: on/by include today, next is strictly after today", () => {
    const friday = { kind: "weekday" as const, weekday: 5, text: "venerdì" };
    expect(resolveDate({ ...friday, relation: "by" }, MONDAY)).toMatchObject({ dueDate: "2026-10-02", dueKind: "by" });
    expect(resolveDate({ ...friday, relation: "on" }, MONDAY)).toMatchObject({ dueDate: "2026-10-02", dueKind: "on" });

    const monday = { kind: "weekday" as const, weekday: 1, text: "Monday" };
    expect(resolveDate({ ...monday, relation: "on" }, MONDAY)).toMatchObject({ dueDate: MONDAY });
    expect(resolveDate({ ...monday, relation: "next" }, MONDAY)).toMatchObject({ dueDate: "2026-10-05", dueKind: "on" });

    const sunday = { kind: "weekday" as const, weekday: 7, relation: "on" as const, text: "pazar" };
    expect(resolveDate(sunday, MONDAY)).toMatchObject({ dueDate: "2026-10-04" });
  });

  it("resolves next-week weekdays inside the week after this one", () => {
    const friday = { kind: "weekday" as const, weekday: 5, relation: "next_week" as const, text: "haftaya cuma" };
    expect(resolveDate(friday, MONDAY)).toMatchObject({ dueDate: "2026-10-09", dueKind: "on" });
    expect(resolveDate(friday, "2026-10-04")).toMatchObject({ dueDate: "2026-10-09" }); // a Sunday
    expect(resolveDate({ ...friday, weekday: 1 }, MONDAY)).toMatchObject({ dueDate: "2026-10-05" });
  });

  it("resolves the weekend to Saturday, or to today once it has started", () => {
    const weekend = { kind: "weekend" as const, relation: "on" as const, text: "this weekend" };
    expect(resolveDate(weekend, MONDAY)).toMatchObject({ dueDate: "2026-10-03", dueKind: "on" });
    expect(resolveDate(weekend, "2026-10-03")).toMatchObject({ dueDate: "2026-10-03" });
    expect(resolveDate({ ...weekend, relation: "by" }, "2026-10-04")).toMatchObject({ dueDate: "2026-10-04", dueKind: "by" });
  });

  it("resolves a day of the month to its next occurrence, today included", () => {
    const day = (month: number | null, dayOfMonth: number) =>
      resolveDate({ kind: "month_day", month, day: dayOfMonth, relation: "on", text: "x" }, MONDAY);

    expect(day(10, 15)).toMatchObject({ dueDate: "2026-10-15", inPast: false });
    expect(day(9, 28)).toMatchObject({ dueDate: MONDAY });
    expect(day(9, 15)).toMatchObject({ dueDate: "2027-09-15" });
    expect(day(null, 28)).toMatchObject({ dueDate: MONDAY });
    expect(day(null, 15)).toMatchObject({ dueDate: "2026-10-15" });
    expect(day(null, 31)).toMatchObject({ dueDate: "2026-10-31" }); // September has no 31st
    expect(day(2, 29)).toMatchObject({ dueDate: "2028-02-29" });
    expect(day(2, 30)).toEqual({ ok: false, reason: "invalid_date" });
  });

  it("resolves the end of the month to its last day", () => {
    const monthEnd = { kind: "month_end" as const, relation: "by" as const, text: "fine mese" };
    expect(resolveDate(monthEnd, MONDAY)).toMatchObject({ dueDate: "2026-09-30", dueKind: "by" });
    expect(resolveDate(monthEnd, "2026-12-31")).toMatchObject({ dueDate: "2026-12-31" });
    expect(resolveDate(monthEnd, "2028-02-10")).toMatchObject({ dueDate: "2028-02-29" });
  });

  it("crosses the Oct 25 DST change by calendar days", () => {
    expect(
      resolveDate({ kind: "weekday", weekday: 1, relation: "next", text: "next Monday" }, "2026-10-24")
    ).toMatchObject({ dueDate: "2026-10-26" });
  });

  it("keeps absolute dates, flags past ones and rejects impossible ones", () => {
    expect(resolveDate({ kind: "absolute", date: "2026-10-15", relation: "on", text: "15 ottobre" }, MONDAY)).toEqual({
      ok: true,
      dueDate: "2026-10-15",
      dueKind: "on",
      inPast: false,
    });
    expect(resolveDate({ kind: "absolute", date: "2026-09-01", relation: "on", text: "1 Sept" }, MONDAY)).toMatchObject({
      inPast: true,
    });
    expect(resolveDate({ kind: "absolute", date: "2026-02-30", relation: "on", text: "30 Feb" }, MONDAY)).toEqual({
      ok: false,
      reason: "invalid_date",
    });
  });

  it("leaves vague dates unresolved", () => {
    expect(resolveDate({ kind: "vague", text: "one of these days" }, MONDAY)).toEqual({ ok: false, reason: "vague" });
  });
});
