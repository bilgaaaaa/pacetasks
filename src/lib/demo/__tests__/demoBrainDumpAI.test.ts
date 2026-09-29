import { createDemoAIProvider } from "../demoBrainDumpAI";

// Guards the demo parser's contract: it must always produce a schema-valid
// result the production normalize/review pipeline can consume.
async function parse(text: string) {
  const interpretation = await createDemoAIProvider().parseBrainDump({
    text,
    todayKey: "2026-09-29",
    timeZone: "Europe/Rome",
    localeHint: "en-US",
  });
  return interpretation.result;
}

describe("demo Brain Dump AI", () => {
  it("splits a dump into tasks with dates, times and durations", async () => {
    const result = await parse("call mom tomorrow at 6pm, buy groceries 30 min and finish report by friday");

    expect(result.candidates.map((c) => c.title)).toEqual(["Call mom", "Buy groceries", "Finish report"]);
    expect(result.candidates[0].when).toMatchObject({ kind: "relative_day", offsetDays: 1, relation: "on" });
    expect(result.candidates[0].dueTime).toBe("18:00");
    expect(result.candidates[1].estimatedDurationMinutes).toBe(30);
    expect(result.candidates[1].category).toBe("shopping");
    expect(result.candidates[2].when).toMatchObject({ kind: "weekday", weekday: 5, relation: "by" });
  });

  it("keeps words inside the title and tags Italian and Turkish input", async () => {
    const result = await parse("chiamare la mamma domani\nyarın dişçiyi ara");

    expect(result.candidates[0]).toMatchObject({ title: "Chiamare la mamma", language: "it" });
    expect(result.candidates[1]).toMatchObject({ language: "tr" });
    expect(result.candidates[1].when).toMatchObject({ kind: "relative_day", offsetDays: 1 });
  });

  it("flags vague dates and leaves too-short fragments unparsed", async () => {
    const result = await parse("fix the bike someday; ok");

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].when).toMatchObject({ kind: "vague" });
    expect(result.candidates[0].ambiguities).toHaveLength(1);
    expect(result.unparsedFragments).toEqual(["ok"]);
  });
});
