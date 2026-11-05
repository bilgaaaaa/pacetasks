import EventKit
import UIKit

/// Today's Calendar events and Reminders, read straight from EventKit once PaceTasks has been given full access.
/// Works in the app and in the widget extension, which shares the app's permission.
enum EventKitTasks {
    enum CompletionError: LocalizedError {
        case reminderNotFound

        var errorDescription: String? { "The reminder no longer exists." }
    }

    /// Events overlapping today, plus incomplete reminders due today, overdue or (if enabled) undated.
    static func today(now: Date, settings: DeskfocusSettings) async -> [DeskTask] {
        let store = EKEventStore()
        let day = DateInterval.day(containing: now)
        var tasks: [DeskTask] = []
        if EKEventStore.authorizationStatus(for: .event) == .fullAccess {
            tasks += events(in: day, store: store, settings: settings)
        }
        if EKEventStore.authorizationStatus(for: .reminder) == .fullAccess {
            tasks += await reminders(in: day, store: store, settings: settings, now: now)
        }
        return tasks
    }

    /// Marks a reminder done in Reminders; only called from the app's process.
    static func complete(_ task: DeskTask) throws {
        let store = EKEventStore()
        guard let reminder = store.calendarItem(withIdentifier: task.sourceIdentifier) as? EKReminder else {
            throw CompletionError.reminderNotFound
        }
        reminder.isCompleted = true
        try store.save(reminder, commit: true)
        Log.sync.info("Reminder completed in Reminders")
    }

    private static func events(in day: DateInterval, store: EKEventStore, settings: DeskfocusSettings) -> [DeskTask] {
        let calendars = store.calendars(for: .event)
            .filter { settings.isContainerVisible(source: .appleCalendar, containerIdentifier: $0.calendarIdentifier) }
        // An empty list would mean "all calendars" to EventKit, so stop here when every calendar is off.
        guard !calendars.isEmpty else { return [] }
        let predicate = store.predicateForEvents(withStart: day.start, end: day.end, calendars: calendars)
        let tasks = store.events(matching: predicate).filter { $0.status != .canceled }.map { event in
            DeskTask(
                id: DeskTask.makeId(source: .appleCalendar, containerIdentifier: event.calendar.calendarIdentifier, sourceIdentifier: event.calendarItemIdentifier, occurrence: event.startDate),
                source: .appleCalendar,
                sourceIdentifier: event.calendarItemIdentifier,
                containerIdentifier: event.calendar.calendarIdentifier,
                title: DeskTask.displayTitle(event.title),
                startDate: event.startDate,
                endDate: event.endDate,
                dueDate: nil,
                isAllDay: event.isAllDay,
                listName: event.calendar.title,
                colorHex: UIColor(cgColor: event.calendar.cgColor).hexString
            )
        }
        Log.sync.debug("Calendar returned \(tasks.count) events from \(calendars.count) calendars")
        return tasks
    }

    private static func reminders(in day: DateInterval, store: EKEventStore, settings: DeskfocusSettings, now: Date) async -> [DeskTask] {
        let lists = store.calendars(for: .reminder)
            .filter { settings.isContainerVisible(source: .appleReminders, containerIdentifier: $0.calendarIdentifier) }
        // An empty list would mean "all lists" to EventKit, so stop here when every list is off.
        guard !lists.isEmpty else { return [] }
        let predicate = store.predicateForIncompleteReminders(withDueDateStarting: nil, ending: nil, calendars: lists)
        let includeUndated = settings.includeUndatedTasks

        // Map inside the callback so no EventKit objects cross threads.
        let tasks: [DeskTask] = await withCheckedContinuation { continuation in
            store.fetchReminders(matching: predicate) { reminders in
                let calendar = Calendar.current
                let mapped = (reminders ?? []).compactMap { reminder -> DeskTask? in
                    let dueDate = reminder.dueDateComponents.flatMap { calendar.date(from: $0) }
                    // Due today or earlier; undated ones only when switched on.
                    if let dueDate {
                        guard dueDate < day.end else { return nil }
                    } else if !includeUndated {
                        return nil
                    }
                    return DeskTask(
                        id: DeskTask.makeId(source: .appleReminders, containerIdentifier: reminder.calendar.calendarIdentifier, sourceIdentifier: reminder.calendarItemIdentifier),
                        source: .appleReminders,
                        sourceIdentifier: reminder.calendarItemIdentifier,
                        containerIdentifier: reminder.calendar.calendarIdentifier,
                        title: DeskTask.displayTitle(reminder.title),
                        startDate: nil,
                        endDate: nil,
                        dueDate: dueDate,
                        isAllDay: reminder.dueDateComponents?.hour == nil,
                        listName: reminder.calendar.title,
                        colorHex: UIColor(cgColor: reminder.calendar.cgColor).hexString
                    )
                }
                continuation.resume(returning: mapped)
            }
        }
        Log.sync.debug("Reminders returned \(tasks.count) reminders from \(lists.count) lists")
        return tasks
    }
}
