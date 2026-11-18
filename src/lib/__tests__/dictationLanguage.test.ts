import { dictationHints, MAX_DICTATION_HINTS } from "../dictationLanguage";

describe("dictationHints", () => {
  it("lets English listening hear Italian words, and the other way round", () => {
    expect(dictationHints("en", [])).toContain("aperitivo");
    expect(dictationHints("it", [])).toContain("meeting");
  });

  it("adds the longer words of the user's own tasks, without duplicates and within iOS's limit", () => {
    const hints = dictationHints("en", ["Walk Bruno", "Call Federico about the boiler", "Walk Bruno"]);
    expect(hints).toEqual(expect.arrayContaining(["Walk", "Federico", "boiler"]));
    expect(hints.filter((word) => word === "Bruno")).toHaveLength(1);
    expect(hints).not.toContain("the");
    const many = Array.from({ length: 300 }, (_, i) => `Task${i} Word${i}`);
    expect(dictationHints("en", many)).toHaveLength(MAX_DICTATION_HINTS);
  });
});
