import { brainDumpAiResultSchema } from "../aiResult";
import { parseBrainDumpWithRules } from "../rulesParser";

describe("parseBrainDumpWithRules", () => {
  it("splits a dump into tasks with dates, times and durations", () => {
    const result = parseBrainDumpWithRules("call mom tomorrow at 6pm, buy groceries 30 min and finish report by friday");

    expect(result.candidates.map((c) => c.title)).toEqual(["Call mom", "Buy groceries", "Finish report"]);
    expect(result.candidates[0].when).toMatchObject({ kind: "relative_day", offsetDays: 1, relation: "on" });
    expect(result.candidates[0].dueTime).toBe("18:00");
    expect(result.candidates[1].estimatedDurationMinutes).toBe(30);
    expect(result.candidates[1].category).toBe("shopping");
    expect(result.candidates[2].when).toMatchObject({ kind: "weekday", weekday: 5, relation: "by" });
  });

  it("keeps words inside the title and tags Italian and Turkish input", () => {
    const result = parseBrainDumpWithRules("chiamare la mamma domani\nyarın dişçiyi ara");

    expect(result.candidates[0]).toMatchObject({ title: "Chiamare la mamma", language: "it" });
    expect(result.candidates[1]).toMatchObject({ language: "tr" });
    expect(result.candidates[1].when).toMatchObject({ kind: "relative_day", offsetDays: 1 });
  });

  it("flags vague dates and leaves too-short fragments unparsed", () => {
    const result = parseBrainDumpWithRules("fix the bike someday; ok");

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].when).toMatchObject({ kind: "vague" });
    expect(result.candidates[0].ambiguities).toHaveLength(1);
    expect(result.unparsedFragments).toEqual(["ok"]);
  });

  it("understands accented and suffixed day names and deadlines", () => {
    const result = parseBrainDumpWithRules("entro venerdì finire la presentazione\nCumaya kadar sunumu bitir\nprep slides for Thursday's demo");

    expect(result.candidates.map((c) => [c.title, c.when])).toEqual([
      ["Finire la presentazione", { kind: "weekday", weekday: 5, relation: "by", text: "venerdì" }],
      ["Sunumu bitir", { kind: "weekday", weekday: 5, relation: "by", text: "Cumaya" }],
      ["Prep slides for demo", { kind: "weekday", weekday: 4, relation: "on", text: "Thursday's" }],
    ]);
  });

  it("treats a date as a deadline only when the deadline word touches it", () => {
    const [dentist] = parseBrainDumpWithRules("dentist Friday, remind me before").candidates;

    expect(dentist.when).toMatchObject({ kind: "weekday", weekday: 5, relation: "on" });
  });

  it("reads day counts, weekends and next-week wording", () => {
    const result = parseBrainDumpWithRules(
      "send the contract within 3 days; clean the bathroom this weekend; haftaya pazartesi kirayı öde; book the vet next week"
    );

    expect(result.candidates.map((c) => c.when)).toEqual([
      { kind: "relative_day", offsetDays: 3, relation: "by", text: "within 3 days" },
      { kind: "weekday", weekday: 6, relation: "on", text: "this weekend" },
      { kind: "weekday", weekday: 1, relation: "next", text: "pazartesi" },
      { kind: "vague", text: "next week" },
    ]);
    expect(result.candidates[3].flexible).toBe(false);
  });

  it("marks maybe tasks, folding a condition clause into the task before it", () => {
    const result = parseBrainDumpWithRules("belki akşam spora giderim, çok yorgun olmazsam\nmaybe paint the fence\ncall the nurse");

    expect(result.candidates.map((c) => [c.title, c.flexible])).toEqual([
      ["Spora giderim", true],
      ["Paint the fence", true],
      ["Call the nurse", false],
    ]);
  });

  it("shows a condition clause as unparsed, since it may hold a task of its own", () => {
    const result = parseBrainDumpWithRules("buy bread and if there is time call Anna");

    expect(result.candidates.map((c) => [c.title, c.flexible])).toEqual([["Buy bread", true]]);
    expect(result.unparsedFragments).toEqual(["if there is time call Anna"]);
  });

  it("does not mistake everyday words for dates, times or remarks", () => {
    const result = parseBrainDumpWithRules(
      [
        "comprare sali da bagno",
        "pazara git",
        "akşam yemeği hazırla",
        "watch Monday night football",
        "pay 12.50 euros to Luca",
        "yarın saat 10'da toplantı",
        "send important documents to the bank",
        "buy 2 H&M shirts",
        "call Dr. Smith tomorrow",
        "happy birthday card for mom!",
      ].join("\n")
    );

    expect(result.unparsedFragments).toEqual([]);
    expect(result.candidates.map((c) => [c.title, c.when?.kind ?? null, c.dueTime, c.priority])).toEqual([
      ["Comprare sali da bagno", null, null, null],
      ["Pazara git", null, null, null],
      ["Akşam yemeği hazırla", null, null, null],
      ["Watch Monday night football", "weekday", null, null],
      ["Pay 12.50 euros to Luca", null, null, null],
      ["Toplantı", "relative_day", "10:00", null],
      ["Send important documents to the bank", null, null, null],
      ["Buy 2 H&M shirts", null, null, null],
      ["Call Dr. Smith", "relative_day", null, null],
      ["Happy birthday card for mom", null, null, null],
    ]);
    expect(result.candidates[7].estimatedDurationMinutes).toBeNull();
  });

  it("keeps decimal durations whole and trims what pointed at a duration", () => {
    const result = parseBrainDumpWithRules("studiare 1,5 ore, work on thesis for 2 hours, riunione alle ore 10 con Marco");

    expect(result.candidates.map((c) => [c.title, c.estimatedDurationMinutes, c.dueTime])).toEqual([
      ["Studiare", 90, null],
      ["Work on thesis", 120, null],
      ["Riunione con Marco", null, "10:00"],
    ]);
  });

  it("reads priority from urgent wording or repeated exclamation marks", () => {
    const result = parseBrainDumpWithRules("urgent: call the bank\ntaxes!!\nimportante: pagare l'affitto");

    expect(result.candidates.map((c) => [c.title, c.priority])).toEqual([
      ["Call the bank", "high"],
      ["Taxes", "high"],
      ["Pagare l'affitto", "high"],
    ]);
  });

  it("capitalizes by the task's own language", () => {
    const result = parseBrainDumpWithRules("ilaç al ve faturayı öde\nice the cake for my mom");

    expect(result.candidates.map((c) => c.title)).toEqual(["İlaç al", "Faturayı öde", "Ice the cake for my mom"]);
  });

  it("reports remarks as unparsed instead of turning them into tasks", () => {
    const result = parseBrainDumpWithRules(
      "I'm so tired today, ugh. Bugün çok yoğundu. çok yoruldum bugün. Reply to Marco"
    );

    expect(result.candidates.map((c) => c.title)).toEqual(["Reply to Marco"]);
    expect(result.unparsedFragments).toEqual([
      "I'm so tired today",
      "ugh.",
      "Bugün çok yoğundu.",
      "çok yoruldum bugün.",
    ]);
  });

  it("adds a detail that stands alone to the task before it, without overwriting", () => {
    const result = parseBrainDumpWithRules("email the landlord, 15 min, tomorrow; water plants 5 min, 30 min; 20 min");

    expect(result.candidates.map((c) => [c.title, c.estimatedDurationMinutes, c.when?.text ?? null])).toEqual([
      ["Email the landlord", 15, "tomorrow"],
      ["Water plants", 5, null],
    ]);
    expect(parseBrainDumpWithRules("20 min").unparsedFragments).toEqual(["20 min"]);
  });

  it("cuts every word of a date out of the title", () => {
    const result = parseBrainDumpWithRules("kirayı cumaya kadar öde\nbu hafta sonu dolabı topla");

    expect(result.candidates.map((c) => c.title)).toEqual(["Kirayı öde", "Dolabı topla"]);
    expect(result.candidates[0].when).toMatchObject({ weekday: 5, relation: "by" });
  });

  it("keeps a task's own words: time-of-day names, phrasal verbs and 'prima o poi'", () => {
    const result = parseBrainDumpWithRules(
      "Morning run, put the washing machine on, prima o poi devo sistemare l'armadio, gym 45 min after work"
    );

    expect(result.candidates.map((c) => [c.title, c.timeOfDay])).toEqual([
      ["Morning run", "morning"],
      ["Put the washing machine on", null],
      ["Devo sistemare l'armadio", null],
      ["Gym", "evening"],
    ]);
  });

  it("reads Turkish times and moves evening hours past noon", () => {
    const result = parseBrainDumpWithRules("öbür gün saat 10:00'da dişçiye git\nyarın akşam 7'de koşuya çık");

    expect(result.candidates.map((c) => [c.title, c.dueTime])).toEqual([
      ["Dişçiye git", "10:00"],
      ["Koşuya çık", "19:00"],
    ]);
  });

  it("tags each task's language, ignoring foreign date words and names", () => {
    const result = parseBrainDumpWithRules("domani call the bank, poi comprare il pane, buy a gift for Ayşe, markete git");

    expect(result.candidates.map((c) => c.language)).toEqual(["en", "it", "en", "en"]);
    expect(parseBrainDumpWithRules("yarın markete git, faturayı öde").candidates.map((c) => c.language)).toEqual([
      "tr",
      "tr",
    ]);
  });

  it("always produces a result the AI contract accepts", () => {
    const manyTasks = Array.from({ length: 60 }, (_, i) => `task number ${i}`).join("; ");
    for (const text of ["", "ok", "a, b, c", "nap 0h", "call mom tomorrow at 25:99 for 999 min!!!", "x".repeat(2000), manyTasks]) {
      expect(brainDumpAiResultSchema.safeParse(parseBrainDumpWithRules(text)).success).toBe(true);
    }
  });

  it("reports text past the task limit as unparsed instead of dropping it", () => {
    const result = parseBrainDumpWithRules(Array.from({ length: 27 }, (_, i) => `task number ${i}`).join("; "));

    expect(result.candidates).toHaveLength(25);
    expect(result.unparsedFragments).toEqual(["task number 25", "task number 26"]);
  });

  it("keeps every leftover piece even when there are more than the contract's slots", () => {
    const result = parseBrainDumpWithRules(Array.from({ length: 50 }, (_, i) => `task number ${i}`).join("; "));

    expect(result.unparsedFragments).toHaveLength(20);
    expect(result.unparsedFragments[19]).toBe(
      Array.from({ length: 6 }, (_, i) => `task number ${i + 44}`).join(", ")
    );
  });
});
