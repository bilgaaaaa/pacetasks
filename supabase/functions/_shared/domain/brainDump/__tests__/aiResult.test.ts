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
    ["an unknown priority", { priority: "urgent" }],
    ["a bad time", { dueTime: "25:00" }],
    ["confidence above 1", { confidence: 1.4 }],
    ["an impossible weekday", { when: { kind: "weekday", weekday: 8, relation: "on", text: "x" } }],
    ["a computed date in the wrong format", { when: { kind: "absolute", date: "30/09/2026", relation: "on", text: "x" } }],
    ["an unknown context", { context: ["garden"] }],
  ])("rejects %s", (_label, override) => {
    const result = makeAiResult([{ ...makeAiCandidate(), ...(override as object) } as never]);
    expect(brainDumpAiResultSchema.safeParse(result).success).toBe(false);
  });

  it("rejects prose instead of the structured object", () => {
    expect(brainDumpAiResultSchema.safeParse("Here are your tasks: …").success).toBe(false);
  });
});
