import { DEFAULT_APPEARANCE, parseAppearance } from "../appearance";

describe("parseAppearance", () => {
  it("returns defaults for missing or corrupt data", () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("not json")).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance("42")).toEqual(DEFAULT_APPEARANCE);
  });

  it("keeps valid values", () => {
    const stored = { themeMode: "dark", accent: "plum", groupBy: "place", quickWinMinutes: 10 };
    expect(parseAppearance(JSON.stringify(stored))).toEqual(stored);
  });

  it("replaces unknown values field by field and clamps the quick-win limit", () => {
    const stored = { themeMode: "sepia", accent: "ocean", groupBy: "mood", quickWinMinutes: 90 };
    expect(parseAppearance(JSON.stringify(stored))).toEqual({
      themeMode: DEFAULT_APPEARANCE.themeMode,
      accent: "ocean",
      groupBy: DEFAULT_APPEARANCE.groupBy,
      quickWinMinutes: 15,
    });
    expect(parseAppearance(JSON.stringify({ quickWinMinutes: 2.5 })).quickWinMinutes).toBe(
      DEFAULT_APPEARANCE.quickWinMinutes
    );
  });
});
