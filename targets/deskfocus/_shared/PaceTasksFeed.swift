import Foundation

/// Today's PaceTasks tasks as the app writes them to the App Group (see src/lib/deskfocusWidget.ts),
/// and the list of ones checked off in the widget that the app still has to complete in Supabase.
enum PaceTasksFeed {
    /// Container id of every PaceTasks row; PaceTasks has a single list.
    static let containerIdentifier = "pacetasks"

    /// One task in the app's JSON; field names match `WidgetPaceTask` in src/lib/deskfocusWidget.ts.
    struct Payload: Decodable {
        let id: String
        let title: String
        let estimatedMinutes: Int
        /// Fixed start time, "HH:MM" in 24 hours.
        let scheduledTime: String?
        /// "YYYY-MM-DD" in the phone's calendar; nil for undated tasks.
        let dueDate: String?
        /// "on" for that day only, "by" for a deadline that can be met any day before it.
        let dueKind: String?

        /// The same rule as `isPendingToday` in supabase/functions/_shared/domain/todayTasks.ts.
        func isDue(onDayKey dayKey: String) -> Bool {
            guard let dueDate else { return true }
            return dueKind == "by" || dueDate <= dayKey
        }
    }

    /// "YYYY-MM-DD" keys, compared as text like the app does.
    private static let dayKeyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: DeskfocusConstants.appGroupIdentifier)
    }

    /// Today's tasks from the last list the app wrote, which also holds tomorrow's so the widget is right after midnight
    /// before the app is opened; empty before the first write or when the JSON is unreadable.
    static func tasks(now: Date) -> [DeskTask] {
        let todayKey = dayKeyFormatter.string(from: now)
        return payloads().filter { $0.isDue(onDayKey: todayKey) }.map { task(from: $0, on: now) }
    }

    /// Tasks that join the list tomorrow: due tomorrow and not already due today, for the widget's "Tomorrow" section.
    static func tomorrowTasks(now: Date) -> [DeskTask] {
        let tomorrow = DateInterval.day(containing: now).end
        let todayKey = dayKeyFormatter.string(from: now)
        let tomorrowKey = dayKeyFormatter.string(from: tomorrow)
        return payloads()
            .filter { $0.isDue(onDayKey: tomorrowKey) && !$0.isDue(onDayKey: todayKey) }
            .map { task(from: $0, on: tomorrow, isDated: true) }
    }

    /// Every task in the app's last write; empty before the first write or when the JSON is unreadable.
    private static func payloads() -> [Payload] {
        guard let json = defaults?.string(forKey: DeskfocusConstants.paceTasksKey), let data = json.data(using: .utf8) else {
            Log.sync.debug("No PaceTasks tasks written yet")
            return []
        }
        do {
            return try JSONDecoder().decode([Payload].self, from: data)
        } catch {
            Log.sync.error("Could not read PaceTasks tasks: \(error.localizedDescription, privacy: .public)")
            return []
        }
    }

    /// One check-off for the app: the PaceTasks task id and the minutes really focused on it, if a session ran.
    private struct PendingCompletion: Encodable {
        let id: String
        let minutes: Int?
    }

    /// Mirrors the PaceTasks tasks waiting for completion as a JSON array of `{id, minutes}`, which the app reads
    /// when it comes to the front.
    static func publishPendingCompletions(of snapshot: DeskfocusSnapshot) {
        let completions = snapshot.pendingCompletionIds
            .compactMap { snapshot.task(withId: $0) }
            .filter { $0.source == .paceTasks }
            .map { PendingCompletion(id: $0.sourceIdentifier, minutes: snapshot.completionFocusMinutes[$0.id]) }
            .sorted { $0.id < $1.id }
        guard let data = try? JSONEncoder().encode(completions), let json = String(data: data, encoding: .utf8) else { return }
        defaults?.set(json, forKey: DeskfocusConstants.completedPaceTaskIdsKey)
        Log.sync.debug("\(completions.count) PaceTasks completions waiting for the app")
    }

    /// Today's tasks stay undated, as PaceTasks places them; tomorrow's carry their day so `Agenda` puts them on it.
    private static func task(from payload: Payload, on day: Date, isDated: Bool = false) -> DeskTask {
        let scheduled = payload.scheduledTime.flatMap { time(on: day, hhmm: $0) }
        return DeskTask(
            id: DeskTask.makeId(source: .paceTasks, containerIdentifier: containerIdentifier, sourceIdentifier: payload.id),
            source: .paceTasks,
            sourceIdentifier: payload.id,
            containerIdentifier: containerIdentifier,
            title: DeskTask.displayTitle(payload.title),
            startDate: nil,
            endDate: nil,
            // Undated tasks still belong to today in PaceTasks, so the widget shows them as today's to-dos.
            dueDate: scheduled ?? (isDated ? Calendar.current.startOfDay(for: day) : nil),
            isAllDay: scheduled == nil,
            listName: "PaceTasks",
            colorHex: DeskfocusConstants.paceTasksColorHex,
            plannedMinutes: payload.estimatedMinutes
        )
    }

    /// That day at "HH:MM", or nil when the text is not a valid time.
    private static func time(on day: Date, hhmm: String) -> Date? {
        let parts = hhmm.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2, (0..<24).contains(parts[0]), (0..<60).contains(parts[1]) else { return nil }
        return Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: day)
    }
}

extension DeskTask {
    /// Same placeholder for untitled items across every source.
    static func displayTitle(_ rawTitle: String?) -> String {
        let trimmed = rawTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? String(localized: "(No title)") : trimmed
    }
}
