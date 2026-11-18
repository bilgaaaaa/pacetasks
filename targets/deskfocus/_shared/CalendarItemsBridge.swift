import Foundation

/// One calendar event or reminder for PaceTasks' Today screen; field names match `CalendarItem` in src/lib/calendarItems.ts.
struct CalendarItemPayload: Encodable {
    let id: String
    /// "event" or "reminder".
    let kind: String
    /// The EventKit id PaceTasks sends back to check a reminder off; nil for events.
    let reminderId: String?
    let title: String
    let calendarTitle: String
    let colorHex: String
    let isAllDay: Bool
    /// Milliseconds since 1970: an event's start and end, a timed reminder's due time.
    let startsAt: Double?
    let endsAt: Double?
}

/// Reads a day's events and reminders for PaceTasks' Today screen, from the calendars switched on in the widget's
/// settings, so Today and the widget always show the same calendars.
enum CalendarItemsBridge {
    /// "YYYY-MM-DD" in the phone's calendar and time zone, like the app's day keys.
    private static let dayKeyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// The day's items, or nil when the day key can't be read. Today also lists overdue and undated reminders.
    static func items(dayKey: String, now: Date = .now) async -> [CalendarItemPayload]? {
        guard let date = dayKeyFormatter.date(from: dayKey) else {
            Log.sync.error("Calendar items: unreadable day \(dayKey, privacy: .public)")
            return nil
        }
        let day = DateInterval.day(containing: date)
        let settings = SharedStore.shared.load().settings
        let tasks = await EventKitTasks.items(in: day, includesEarlier: day.contains(now), settings: settings)
        Log.sync.debug("Calendar items: \(tasks.count) for the asked day")
        return tasks.sortedForToday().map(payload(for:))
    }

    private static func payload(for task: DeskTask) -> CalendarItemPayload {
        let start = task.startDate ?? (task.isAllDay ? nil : task.dueDate)
        return CalendarItemPayload(
            id: task.id,
            kind: task.isEvent ? "event" : "reminder",
            reminderId: task.isEvent ? nil : task.sourceIdentifier,
            title: task.title,
            calendarTitle: task.listName,
            colorHex: task.colorHex ?? DeskfocusConstants.paceTasksColorHex,
            isAllDay: task.isAllDay,
            startsAt: start.map { $0.timeIntervalSince1970 * 1000 },
            endsAt: task.endDate.map { $0.timeIntervalSince1970 * 1000 }
        )
    }
}
