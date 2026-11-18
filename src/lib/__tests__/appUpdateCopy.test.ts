import { shortReleaseNotes, updateMessage } from "../appUpdateCopy";

describe("updateMessage", () => {
  it("names both versions", () => {
    expect(updateMessage("1.1.0", "1.0.0")).toBe("Version 1.1.0 is on the App Store. You have 1.0.0.");
  });
});

describe("shortReleaseNotes", () => {
  it("keeps short notes, trims long ones, and hides empty ones", () => {
    expect(shortReleaseNotes("Reminders for timed tasks.")).toBe("Reminders for timed tasks.");
    expect(shortReleaseNotes("a".repeat(400))).toHaveLength(281);
    expect(shortReleaseNotes(null)).toBeNull();
  });
});
