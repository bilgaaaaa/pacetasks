import {
  applyWidgetSettingsPatch,
  groupCalendarsByAccount,
  googleAccounts,
  parseWidgetSettings,
  WidgetCalendar,
  WidgetSettings,
} from "../widgetSettings";

const calendar = (overrides: Partial<WidgetCalendar>): WidgetCalendar => ({
  key: "appleCalendar|home",
  kind: "calendar",
  title: "Home",
  account: "iCloud",
  accountKind: "icloud",
  colorHex: "#34C759",
  visible: true,
  ...overrides,
});

const SETTINGS: WidgetSettings = {
  glassTint: "purple",
  accentColor: "amber",
  focusMinutes: 25,
  includeUndatedTasks: true,
  calendars: [
    calendar({}),
    calendar({ key: "appleCalendar|work", title: "Work" }),
    calendar({ key: "appleCalendar|g", title: "Team", account: "ada@gmail.com", accountKind: "google" }),
    calendar({ key: "appleReminders|list", kind: "reminders", title: "Groceries" }),
  ],
};

describe("parseWidgetSettings", () => {
  it("reads the handler's settings", () => {
    expect(parseWidgetSettings(JSON.parse(JSON.stringify(SETTINGS)))).toEqual(SETTINGS);
  });

  it("refuses unknown colors and drops unreadable calendars", () => {
    expect(parseWidgetSettings({ ...SETTINGS, glassTint: "neon" })).toBeNull();
    const unknownKind = parseWidgetSettings({ ...SETTINGS, calendars: [{ ...SETTINGS.calendars[0], accountKind: "yahoo" }] });
    expect(unknownKind?.calendars[0].accountKind).toBe("other");
    expect(parseWidgetSettings(null)).toBeNull();
    const parsed = parseWidgetSettings({ ...SETTINGS, calendars: [{ key: 1 }, SETTINGS.calendars[0]] });
    expect(parsed?.calendars).toEqual([SETTINGS.calendars[0]]);
  });
});

describe("applyWidgetSettingsPatch", () => {
  it("switches one calendar and leaves the others", () => {
    const next = applyWidgetSettingsPatch(SETTINGS, { calendarKey: "appleCalendar|work", calendarVisible: false });
    expect(next.calendars.map((c) => c.visible)).toEqual([true, false, true, true]);
    expect(next).not.toHaveProperty("calendarKey");
  });

  it("changes colors and focus length", () => {
    expect(applyWidgetSettingsPatch(SETTINGS, { glassTint: "teal", focusMinutes: 45 })).toMatchObject({
      glassTint: "teal",
      focusMinutes: 45,
    });
  });
});

describe("groupCalendarsByAccount", () => {
  it("groups one kind under its accounts", () => {
    expect(
      groupCalendarsByAccount(SETTINGS.calendars, "calendar").map((group) => [group.account, group.calendars.length])
    ).toEqual([
      ["iCloud", 2],
      ["ada@gmail.com", 1],
    ]);
    expect(groupCalendarsByAccount(SETTINGS.calendars, "reminders")).toHaveLength(1);
  });
});

describe("googleAccounts", () => {
  it("names each Google account on the iPhone once", () => {
    expect(googleAccounts(SETTINGS.calendars)).toEqual(["ada@gmail.com"]);
    expect(googleAccounts([SETTINGS.calendars[0]])).toEqual([]);
  });
});
