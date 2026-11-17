import { combineAccess, parseCalendarAccess } from "../calendarAccess";

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

describe("parseCalendarAccess", () => {
  it("reads the bridge's two permissions as one", () => {
    expect(parseCalendarAccess({ events: "granted", reminders: "granted" })).toBe("granted");
    expect(parseCalendarAccess({ events: "granted", reminders: "undetermined" })).toBe("undetermined");
    expect(parseCalendarAccess({ events: "denied", reminders: "granted" })).toBe("denied");
  });

  it("is unavailable when the reply can't be read", () => {
    expect(parseCalendarAccess(undefined)).toBe("unavailable");
    expect(parseCalendarAccess({ events: "maybe" })).toBe("unavailable");
  });
});
