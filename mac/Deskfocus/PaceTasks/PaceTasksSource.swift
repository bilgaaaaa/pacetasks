import Foundation

/// Open PaceTasks tasks of the signed-in account, placed on days the way the iPhone app's Today list does.
@MainActor
final class PaceTasksSource: TaskSource {
    /// Container id of every PaceTasks row; PaceTasks has a single list (same value as the iPhone widget's feed).
    static let containerIdentifier = "pacetasks"

    let kind: TaskSourceKind = .paceTasks
    private let auth: PaceTasksAuthService

    /// One row of the tasks table, with only the columns the Mac needs.
    private struct Row: Decodable {
        let id: String
        let title: String
        let estimatedMinutes: Int
        /// Fixed start time, "HH:MM" in 24 hours.
        let scheduledTime: String?
        /// "YYYY-MM-DD"; nil for undated tasks.
        let dueDate: String?
        /// "on" for that day only, "by" for a deadline that can be met any day before it.
        let dueKind: String?
    }

    init(auth: PaceTasksAuthService) {
        self.auth = auth
    }

    var isAvailable: Bool { auth.isSignedIn }

    func containers() async throws -> [TaskContainer] {
        [TaskContainer(
            source: kind,
            identifier: Self.containerIdentifier,
            title: "PaceTasks",
            accountName: auth.email ?? "PaceTasks",
            colorHex: DeskfocusConstants.paceTasksColorHex
        )]
    }

    func fetchTasks(in interval: DateInterval, settings: DeskfocusSettings) async throws -> [DeskTask] {
        guard settings.isContainerVisible(source: kind, containerIdentifier: Self.containerIdentifier) else { return [] }
        let accessToken = try await auth.validAccessToken()
        async let pace = paceModel(accessToken: accessToken)
        let data = try await PaceTasksServer.send("GET", path: "rest/v1/tasks", query: [
            URLQueryItem(name: "select", value: "id,title,estimated_minutes,scheduled_time,due_date,due_kind"),
            URLQueryItem(name: "status", value: "eq.pending"),
            URLQueryItem(name: "order", value: "created_at.asc")
        ], accessToken: accessToken)

        let rows = try Self.decoder.decode([Row].self, from: data)
        let paceModel = await pace
        let tasks = rows.compactMap { row -> DeskTask? in
            let day = Self.day(of: row)
            // Always placed, like on the iPhone: "Include undated to-dos" is about Reminders and Google Tasks.
            guard DeskTask.isDue(day, in: interval, includeUndated: true) else { return nil }
            return task(from: row, day: day, paceModel: paceModel)
        }
        Log.paceTasks.debug("PaceTasks returned \(tasks.count) of \(rows.count) open tasks")
        return tasks
    }

    /// The learned pace from the latest timed tasks; without it (offline, an error) tasks keep their estimates.
    private func paceModel(accessToken: String) async -> PaceModel {
        do {
            let data = try await PaceTasksServer.send("GET", path: "rest/v1/tasks", query: [
                URLQueryItem(name: "select", value: "title,estimated_minutes,actual_minutes"),
                URLQueryItem(name: "status", value: "eq.done"),
                URLQueryItem(name: "actual_minutes", value: "gt.0"),
                URLQueryItem(name: "order", value: "created_at.desc"),
                URLQueryItem(name: "limit", value: String(PaceModel.historyLimit))
            ], accessToken: accessToken)
            let runs = try Self.decoder.decode([PaceModel.Run].self, from: data)
            Log.paceTasks.debug("Learned pace from \(runs.count) timed tasks")
            return PaceModel(newestFirst: runs)
        } catch {
            Log.paceTasks.error("Learned pace unavailable, using estimates: \(error.localizedDescription, privacy: .public)")
            return .empty
        }
    }

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()

    /// Completes the task in PaceTasks, as the iPhone app does when the real time spent is unknown.
    func complete(_ task: DeskTask, focusedMinutes: Int?) async throws {
        // complete_task is the one completion path shared with the iPhone: it also adds a repeating task's next occurrence.
        _ = try await PaceTasksServer.send("POST", path: "rest/v1/rpc/complete_task", json: [
            "task_id": task.sourceIdentifier,
            "actual_minutes": focusedMinutes.map { $0 as Any } ?? NSNull(),
            "local_day": Self.dayKeyFormatter.string(from: .now)
        ], accessToken: try await auth.validAccessToken())
        Log.paceTasks.info("Task completed in PaceTasks, focused \(focusedMinutes.map { "\($0)" } ?? "–", privacy: .public) min")
    }

    // MARK: Rescue my day

    /// What still fits the rest of today and what to move, from the `rescue` function (the iPhone app's rules).
    func rescuePlan() async throws -> PaceRescuePlan {
        let data = try await PaceTasksServer.send("POST", path: "functions/v1/rescue", json: [
            "action": "plan",
            "timeZone": TimeZone.current.identifier
        ], accessToken: try await auth.validAccessToken())
        return try Self.rescueDecoder.decode(PaceRescuePlan.self, from: data)
    }

    /// Moves the tasks the user confirmed; the server computes each change. Returns how many moved.
    func applyRescue(_ moves: [PaceRescueMove]) async throws -> Int {
        let body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(moves))
        let data = try await PaceTasksServer.send("POST", path: "functions/v1/rescue", json: [
            "action": "apply",
            "timeZone": TimeZone.current.identifier,
            "moves": body
        ], accessToken: try await auth.validAccessToken())
        let reply = try Self.rescueDecoder.decode(RescueApplyReply.self, from: data)
        Log.paceTasks.info("Rescue my day moved \(reply.moved) tasks")
        return reply.moved
    }

    private struct RescueApplyReply: Decodable {
        let moved: Int
    }

    /// The function answers in camelCase, unlike the REST API.
    private static let rescueDecoder = JSONDecoder()

    /// Adds a task through the same `create_task` function the iPhone app uses and returns its id.
    /// A repeating task without a day starts today, as on the iPhone.
    func create(title: String, minutes: Int, dueDay: Date?, repeatRule: PaceRepeatRule?) async throws -> String {
        var draft: [String: Any] = [
            "title": title,
            "estimated_minutes": min(max(minutes, DeskfocusSettings.minimumFocusMinutes), DeskfocusSettings.maximumFocusMinutes),
            "source": "app"
        ]
        var day = dueDay
        if day == nil, repeatRule != nil { day = .now }
        if let day {
            draft["due_date"] = Self.dayKeyFormatter.string(from: day)
            draft["due_kind"] = "on"
        }
        if let repeatRule {
            draft["repeat_rule"] = repeatRule.rawValue
        }
        let data = try await PaceTasksServer.send("POST", path: "rest/v1/rpc/create_task", json: ["draft": draft], accessToken: try await auth.validAccessToken())
        guard let created = (try JSONSerialization.jsonObject(with: data)) as? [String: Any], let id = created["id"] as? String else {
            throw PaceTasksServer.ServerError.server(status: 200, code: nil, message: String(localized: "PaceTasks did not confirm the new task. Please try again."))
        }
        Log.paceTasks.info("Task created in PaceTasks")
        return DeskTask.makeId(source: kind, containerIdentifier: Self.containerIdentifier, sourceIdentifier: id)
    }

    // MARK: Days

    /// The day a task belongs to, nil meaning "today" (undated, a deadline still ahead, or overdue).
    /// Same rule as `isPendingToday` in supabase/functions/_shared/domain/todayTasks.ts.
    private static func day(of row: Row) -> Date? {
        guard row.dueKind != "by", let key = row.dueDate, let date = dayKeyFormatter.date(from: key) else { return nil }
        return date > Calendar.current.startOfDay(for: .now) ? date : nil
    }

    private func task(from row: Row, day: Date?, paceModel: PaceModel) -> DeskTask {
        let start = row.scheduledTime.flatMap { Self.time(on: day ?? .now, hhmm: $0) }
        return DeskTask(
            id: DeskTask.makeId(source: kind, containerIdentifier: Self.containerIdentifier, sourceIdentifier: row.id),
            source: kind,
            sourceIdentifier: row.id,
            containerIdentifier: Self.containerIdentifier,
            title: DeskTask.displayTitle(row.title),
            startDate: nil,
            endDate: nil,
            dueDate: start ?? day,
            isAllDay: start == nil,
            listName: "PaceTasks",
            colorHex: DeskfocusConstants.paceTasksColorHex,
            plannedMinutes: paceModel.expectedMinutes(title: row.title, estimatedMinutes: row.estimatedMinutes)
        )
    }

    /// "YYYY-MM-DD" keys in the Mac's calendar, as the iPhone app writes them.
    private static let dayKeyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// That day at "HH:MM", or nil when the text is not a valid time.
    private static func time(on day: Date, hhmm: String) -> Date? {
        let parts = hhmm.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2, (0..<24).contains(parts[0]), (0..<60).contains(parts[1]) else { return nil }
        return Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: day)
    }
}
