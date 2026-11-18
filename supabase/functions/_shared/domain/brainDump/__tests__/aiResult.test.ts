import { brainDumpAiResultSchema } from "../aiResult";
import { makeAiCandidate, makeAiResult } from "../../testing/makeAiCandidate";

describe("brainDumpAiResultSchema", () => {
  it("accepts a well-formed result", () => {
    const result = makeAiResult([
      makeAiCandidate({ when: { kind: "weekday", weekday: 5, relation: "by", text: "entro venerdì" } }),
    ]);
    expect(brainDumpAiResultSchema.safeParse(result).success).toBe(true);
  });

  it.each([
    ["a weekday of next week", { kind: "weekday", weekday: 5, relation: "next_week", text: "haftaya cuma" }],
    ["the weekend", { kind: "weekend", relation: "on", text: "this weekend" }],
    ["a day of a named month", { kind: "month_day", month: 10, day: 15, relation: "on", text: "15 ottobre" }],
    ["a day of whichever month comes next", { kind: "month_day", month: null, day: 15, relation: "by", text: "the 15th" }],
    ["the end of the month", { kind: "month_end", relation: "by", text: "ay sonuna kadar" }],
  ])("accepts %s as a date", (_label, when) => {
    const result = makeAiResult([{ ...makeAiCandidate(), when } as never]);
    expect(brainDumpAiResultSchema.safeParse(result).success).toBe(true);
  });

  it.each([
    ["an unknown priority", { priority: "urgent" }],
    ["a bad time", { dueTime: "25:00" }],
    ["confidence above 1", { confidence: 1.4 }],
    ["an impossible weekday", { when: { kind: "weekday", weekday: 8, relation: "on", text: "x" } }],
    ["a computed date in the wrong format", { when: { kind: "absolute", date: "30/09/2026", relation: "on", text: "x" } }],
    ["an impossible day of the month", { when: { kind: "month_day", month: 13, day: 32, relation: "on", text: "x" } }],
    ["an unknown context", { context: ["garden"] }],
  ])("rejects %s", (_label, override) => {
    const result = makeAiResult([{ ...makeAiCandidate(), ...(override as object) } as never]);
    expect(brainDumpAiResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects prose instead of the structured object", () => {
    expect(brainDumpAiResultSchema.safeParse("Here are your tasks: …").success).toBe(false);
  });
});
