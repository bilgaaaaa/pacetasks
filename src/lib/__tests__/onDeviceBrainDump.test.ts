import { brainDumpAiResultSchema } from "@domain/brainDump/aiResult";
import { buildOnDevicePrompt, toBrainDumpAiResult } from "../onDeviceBrainDump";

const answer = (value: unknown) => JSON.stringify(value);

const VET = {
  title: "Chiamare il veterinario per Bruno",
  sourceSpan: "domani devo chiamare il veterinario per Bruno",
  language: "it",
  when: { kind: "relativeDay", relation: "on", offsetDays: 1, text: "domani" },
  estimatedMinutes: 10,
  energy: "low",
  flexible: false,
  category: "personal",
  confidence: 92,
};

describe("buildOnDevicePrompt", () => {
  it("anchors the model to the phone's today", () => {
    expect(buildOnDevicePrompt("comprare il pane", "2026-11-13")).toBe("Today is Friday, 2026-11-13.\nBrain dump:\ncomprare il pane");
  });
});

describe("toBrainDumpAiResult", () => {
  it("turns the model's answer into a valid Brain Dump contract", () => {
    const result = toBrainDumpAiResult(answer({ tasks: [VET], notTasks: ["che giornata"] }));
    expect(brainDumpAiResultSchema.safeParse(result).success).toBe(true);
    expect(result?.detectedLanguages).toEqual(["it"]);
    expect(result?.unparsedFragments).toEqual(["che giornata"]);
    expect(result?.candidates[0]).toMatchObject({
      title: "Chiamare il veterinario per Bruno",
      when: { kind: "relative_day", offsetDays: 1, relation: "on", text: "domani" },
      estimatedDurationMinutes: 10,
      energyRequired: "low",
      category: "personal",
      confidence: 0.92,
    });
  });

  it("maps each kind of date", () => {
    const when = (value: unknown) =>
      toBrainDumpAiResult(answer({ tasks: [{ ...VET, when: value }], notTasks: [] }))?.candidates[0].when;
    expect(when({ kind: "weekday", relation: "nextWeek", weekday: 5, text: "haftaya cuma" })).toEqual({
      kind: "weekday",
      weekday: 5,
      relation: "next_week",
      text: "haftaya cuma",
    });
    expect(when({ kind: "monthDay", relation: "by", day: 20, text: "entro il 20" })).toEqual({
      kind: "month_day",
      month: null,
      day: 20,
      relation: "by",
      text: "entro il 20",
    });
    expect(when({ kind: "weekend", relation: "next", text: "next weekend" })).toEqual({
      kind: "weekend",
      relation: "on",
      text: "next weekend",
    });
    expect(when({ kind: "vague", relation: "on", text: "prima o poi" })).toEqual({ kind: "vague", text: "prima o poi" });
  });

  it("drops a date it can't trust instead of guessing", () => {
    const result = toBrainDumpAiResult(
      answer({ tasks: [{ ...VET, when: { kind: "weekday", relation: "on", weekday: 9, text: "x" } }], notTasks: [] })
    );
    expect(result?.candidates[0].when).toBeNull();
  });

  it("clears values outside the contract and skips tasks without a title", () => {
    const result = toBrainDumpAiResult(
      answer({
        tasks: [{ ...VET, dueTime: "25:99", estimatedMinutes: 0, category: "fun", confidence: 400 }, { title: "  " }],
        notTasks: [],
      })
    );
    expect(result?.candidates).toHaveLength(1);
    expect(result?.candidates[0]).toMatchObject({ dueTime: null, estimatedDurationMinutes: null, category: null, confidence: 0.5 });
  });

  it("is null when the answer can't be used", () => {
    expect(toBrainDumpAiResult("not json")).toBeNull();
    expect(toBrainDumpAiResult(answer({ notTasks: [] }))).toBeNull();
    expect(toBrainDumpAiResult(answer({ tasks: [], notTasks: ["hello"] }))).toBeNull();
  });
});
