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
