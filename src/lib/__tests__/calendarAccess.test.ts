import { combineAccess } from "../calendarAccess";

describe("combineAccess", () => {
  it("is granted only when both Calendar and Reminders are", () => {
    expect(combineAccess("granted", "granted")).toBe("granted");
    expect(combineAccess("granted", "undetermined")).toBe("undetermined");
  });

  it("reports denied when either was refused, so Settings can point to the phone's Settings", () => {
    expect(combineAccess("denied", "granted")).toBe("denied");
    expect(combineAccess("undetermined", "denied")).toBe("denied");
  });

  it("is unavailable off iOS", () => {
    expect(combineAccess("unavailable", "unavailable")).toBe("unavailable");
  });
});
