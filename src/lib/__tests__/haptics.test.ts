import { isHapticEnabled } from "../haptics";

jest.mock("expo-haptics", () => ({}));

describe("isHapticEnabled", () => {
  it("lets each cue follow its own setting", () => {
    const tapOnly = { haptics_enabled: true, timer_chime_enabled: false };
    expect(isHapticEnabled("taskCompleted", tapOnly)).toBe(true);
    expect(isHapticEnabled("timerEnded", tapOnly)).toBe(false);

    const buzzOnly = { haptics_enabled: false, timer_chime_enabled: true };
    expect(isHapticEnabled("taskCompleted", buzzOnly)).toBe(false);
    expect(isHapticEnabled("timerEnded", buzzOnly)).toBe(true);
  });
});
