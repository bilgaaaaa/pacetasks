import { CalendarItem, calendarItemTime, parseCalendarItems } from "../calendarItems";

// Local times on one day, so the expected clock text holds in any time zone the tests run in.
const at = (time: string) => new Date(`2026-10-14T${time}:00`).getTime();

const EVENT: CalendarItem = {
  id: "appleCalendar|work|1",
  kind: "event",
  reminderId: null,
  title: "Design review",
  calendarTitle: "Work",
  colorHex: "#4285F4",
  isAllDay: false,
  startsAt: at("09:00"),
  endsAt: at("10:30"),
};

describe("parseCalendarItems", () => {
  it("reads the handler's items and drops unreadable ones", () => {
    const reminder = { ...EVENT, id: "r", kind: "reminder", reminderId: "x", endsAt: undefined };
    expect(parseCalendarItems([EVENT, { id: 3 }, reminder])).toEqual([EVENT, { ...reminder, endsAt: null }]);
  });

  it("refuses a reply without items", () => {
    expect(parseCalendarItems(undefined)).toBeNull();
  });
});

describe("calendarItemTime", () => {
  it("says when an item happens", () => {
    expect(calendarItemTime(EVENT)).toBe("09:00–10:30");
    expect(calendarItemTime({ ...EVENT, isAllDay: true })).toBe("All day");
    expect(calendarItemTime({ ...EVENT, kind: "reminder", endsAt: null })).toBe("09:00");
    expect(calendarItemTime({ ...EVENT, kind: "reminder", isAllDay: true })).toBe("");
  });
});
