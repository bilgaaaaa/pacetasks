import { normalizeBrainDump, NormalizeContext } from "../normalize";
import { makeAiCandidate, makeAiResult } from "../../testing/makeAiCandidate";
import { makeTask } from "../../testing/makeTask";

const context: NormalizeContext = {
  todayKey: "2026-09-28",
  source: "brain_dump",
  workStartHour: 9,
  workEndHour: 17,
  tasks: [],
};

describe("normalizeBrainDump", () => {
  it("turns the example brain dump into drafts, keeping each title's language", () => {
    const result = makeAiResult(
      [
        makeAiCandidate({
          title: "Chiamare il veterinario per Bruno",
          sourceSpan: "domani devo chiamare il veterinario per Bruno",
          language: "it",
          when: { kind: "relative_day", offsetDays: 1, relation: "on", text: "domani" },
          estimatedDurationMinutes: 10,
          energyRequired: "low",
          context: ["phone"],
          category: "personal",
        }),
        makeAiCandidate({
          title: "Finish my presentation",
          sourceSpan: "finish my presentation before Friday",
          when: { kind: "weekday", weekday: 5, relation: "by", text: "before Friday" },
          priority: "high",
          energyRequired: "high",
          category: "work",
        }),
        makeAiCandidate({
          title: "Spor salonuna git",
          sourceSpan: "belki spor salonuna giderim",
          language: "tr",
          flexible: true,
          energyRequired: "high",
          confidence: 0.6,
          ambiguities: [{ field: "flexible", reason: "Depends on energy" }],
        }),
      ],
      { detectedLanguages: ["it", "en", "tr"] }
    );

    const { candidates, detectedLanguages } = normalizeBrainDump(result, context);

    expect(detectedLanguages).toEqual(["it", "en", "tr"]);
    expect(candidates[0].draft).toEqual({
      title: "Chiamare il veterinario per Bruno",
      estimated_minutes: 10,
      timing: "anytime",
      category: "personal",
      scheduled_time: null,
      due_date: "2026-09-29",
      due_kind: "on",
      notes: null,
      priority: null,
      energy_level: "low",
      flexible: false,
      tags: ["phone"],
      source: "brain_dump",
      source_language: "it",
      ai_confidence: 0.95,
    });
    expect(candidates[0].dateText).toBe("domani");
    expect(candidates[0].issues).toEqual([]);

    expect(candidates[1].draft).toMatchObject({ due_date: "2026-10-02", due_kind: "by", priority: "high" });

    expect(candidates[2].draft).toMatchObject({ title: "Spor salonuna git", flexible: true, source_language: "tr" });
    expect(candidates[2].issues.map((i) => i.code)).toEqual(["low_confidence", "ambiguous"]);
  });

  it("prefers the user's history over the AI's duration and timing guess", () => {
    const tasks = [
      makeTask({ id: "old", title: "Walk Bruno", status: "done", actual_minutes: 35, timing: "after_work" }),
    ];
    const { candidates } = normalizeBrainDump(
      makeAiResult([makeAiCandidate({ title: "walk bruno", estimatedDurationMinutes: 15 })]),
      { ...context, tasks }
    );
    expect(candidates[0].draft).toMatchObject({ estimated_minutes: 35, timing: "after_work" });
  });

  it("maps fixed times and parts of the day onto work-hour timing", () => {
    const { candidates } = normalizeBrainDump(
      makeAiResult([
        makeAiCandidate({ title: "a", dueTime: "07:30" }),
        makeAiCandidate({ title: "b", dueTime: "12:00" }),
        makeAiCandidate({ title: "c", dueTime: "17:00" }),
        makeAiCandidate({ title: "d", timeOfDay: "morning" }),
        makeAiCandidate({ title: "e", timeOfDay: "evening" }),
      ]),
      context
    );
    expect(candidates.map((c) => c.draft.timing)).toEqual([
      "before_work",
      "anytime",
      "after_work",
      "before_work",
      "after_work",
    ]);
    expect(candidates[0].draft.scheduled_time).toBe("07:30");
  });

  it("flags duplicates, unknown categories, vague and past dates", () => {
    const tasks = [makeTask({ id: "pending-1", title: "Buy shampoo" })];
    const { candidates } = normalizeBrainDump(
      makeAiResult([
        makeAiCandidate({ title: "buy  shampoo " }),
        makeAiCandidate({ title: "x", category: "errands" }),
        makeAiCandidate({ title: "y", when: { kind: "vague", text: "someday" } }),
        makeAiCandidate({ title: "z", when: { kind: "absolute", date: "2026-09-01", relation: "on", text: "1 Sept" } }),
      ]),
      { ...context, tasks }
    );
    expect(candidates[0].possibleDuplicateOfTaskId).toBe("pending-1");
    expect(candidates[0].draft.title).toBe("buy shampoo");
    expect(candidates.map((c) => c.issues.map((i) => i.code))).toEqual([
      ["possible_duplicate"],
      ["unknown_category"],
      ["date_unresolved"],
      ["date_in_past"],
    ]);
    expect(candidates[1].draft.category).toBeNull();
    expect(candidates[2].draft.due_date).toBeNull();
    expect(candidates[3].draft.due_date).toBe("2026-09-01");
  });

  it("clamps durations, truncates long titles and drops blank ones", () => {
    const { candidates, unparsedFragments } = normalizeBrainDump(
      makeAiResult(
        [
          makeAiCandidate({ title: "a".repeat(250), estimatedDurationMinutes: 900 }),
          makeAiCandidate({ title: "   ", sourceSpan: "ehm" }),
          makeAiCandidate({ title: "b", language: "Italian", context: ["phone", "phone"] }),
        ],
        { unparsedFragments: ["  ", "boh"] }
      ),
      context
    );
    expect(candidates).toHaveLength(2);
    expect(candidates[0].draft.title).toHaveLength(200);
    expect(candidates[0].draft.estimated_minutes).toBe(480);
    expect(candidates[0].issues.map((i) => i.code)).toEqual(["title_truncated"]);
    expect(candidates[1].index).toBe(1);
    expect(candidates[1].draft.source_language).toBeNull();
    expect(candidates[1].draft.tags).toEqual(["phone"]);
    expect(unparsedFragments).toEqual(["boh", "ehm"]);
  });
});
