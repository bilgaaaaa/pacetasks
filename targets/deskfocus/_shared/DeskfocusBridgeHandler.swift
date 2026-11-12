import Foundation

/// What PaceTasks' JavaScript sends through the native module in modules/deskfocus-bridge; field names match
/// `FocusBridgeCommand` in src/lib/deskfocusBridge.ts.
private struct FocusBridgeCommand: Decodable {
    let action: String
    let paceTaskId: String?
    let minutes: Int?
    /// PaceTasks' timer sound setting, mirrored into the shared settings so the widget's alerts follow it too.
    let timerSoundEnabled: Bool?
}

/// The focus session as JavaScript reads it; field names match `SharedFocusSession` in src/lib/focusSession.ts.
private struct SharedFocusSession: Encodable {
    let sessionId: String
    /// Nil when the session belongs to a calendar event or reminder rather than a PaceTasks task.
    let paceTaskId: String?
    let taskTitle: String
    let phase: String
    /// Milliseconds since 1970 while running, so JavaScript counts down against the same end as the alert.
    let endsAt: Double?
    let remainingSeconds: Double
    let plannedSeconds: Double
}

private struct FocusBridgeReply: Encodable {
    var focus: SharedFocusSession?
    var error: String?
}

/// Runs PaceTasks' focus commands in the app's process, through the same FocusController the widget buttons use,
/// so the app and the widget share one session, one alert and one Live Activity. The native module finds it by
/// name at run time because a pod cannot see the app target's Swift types.
@objc(DeskfocusBridgeHandler)
final class DeskfocusBridgeHandler: NSObject {
    /// Called by the native module with a JSON command; answers with the focus state as JSON.
    @objc(handle:completion:)
    static func handle(_ command: NSString, completion: @escaping @Sendable (NSString) -> Void) {
        let json = command as String
        Task { @MainActor in
            let reply = await run(json)
            completion(encode(reply) as NSString)
        }
    }

    @MainActor
    private static func run(_ json: String) async -> FocusBridgeReply {
        guard let data = json.data(using: .utf8), let command = try? JSONDecoder().decode(FocusBridgeCommand.self, from: data) else {
            Log.app.error("Bridge: unreadable command")
            return FocusBridgeReply(focus: currentFocus(), error: "invalid_command")
        }
        if let enabled = command.timerSoundEnabled {
            applyTimerSound(enabled)
        }

        switch command.action {
        case "state":
            return FocusBridgeReply(focus: currentFocus())
        case "start":
            guard let paceTaskId = command.paceTaskId, await start(paceTaskId: paceTaskId, minutes: command.minutes) else {
                return FocusBridgeReply(focus: currentFocus(), error: "unknown_task")
            }
        case "pause":
            FocusController.pause()
        case "resume":
            FocusController.resume()
        case "extend":
            FocusController.extend()
        case "end":
            FocusController.end()
        case "reconcile":
            // The app came to the front: settle what the widget did while it was closed.
            await WidgetTaskSync.refresh()
        default:
            Log.app.error("Bridge: unknown action \(command.action, privacy: .public)")
            return FocusBridgeReply(focus: currentFocus(), error: "unknown_action")
        }
        Log.app.info("Bridge: \(command.action, privacy: .public) done")
        await FocusRuntime.afterChange()
        return FocusBridgeReply(focus: currentFocus())
    }

    /// Starts focus on a PaceTasks task, reloading today's list first when the task was added after the last widget refresh.
    @MainActor
    private static func start(paceTaskId: String, minutes: Int?) async -> Bool {
        let taskId = DeskTask.makeId(source: .paceTasks, containerIdentifier: PaceTasksFeed.containerIdentifier, sourceIdentifier: paceTaskId)
        if SharedStore.shared.load().task(withId: taskId) == nil {
            await WidgetTaskSync.refresh()
        }
        // The app's Pomodoro length is its own setting, so it never replaces the length the widget's ▶ uses for this task.
        return FocusController.start(taskId: taskId, minutes: minutes, remembersMinutes: false) != nil
    }

    /// Saves the sound setting only when it changed, so routine commands never rewrite the shared state.
    private static func applyTimerSound(_ enabled: Bool) {
        guard SharedStore.shared.load().settings.timerSoundEnabled != enabled else { return }
        SharedStore.shared.update { $0.settings.timerSoundEnabled = enabled }
        Log.app.info("Bridge: timer sound \(enabled ? "on" : "off", privacy: .public)")
        FocusController.notifyChange()
    }

    private static func currentFocus(now: Date = .now) -> SharedFocusSession? {
        let snapshot = SharedStore.shared.load()
        guard let session = snapshot.focus else { return nil }
        let task = snapshot.task(withId: session.taskId)
        let phase: String
        var endsAt: Double?
        switch session.phase(at: now) {
        case .running(let endDate):
            phase = "running"
            endsAt = endDate.timeIntervalSince1970 * 1000
        case .paused:
            phase = "paused"
        case .finished:
            phase = "finished"
        }
        return SharedFocusSession(
            sessionId: session.id.uuidString,
            paceTaskId: task?.source == .paceTasks ? task?.sourceIdentifier : nil,
            taskTitle: session.taskTitle,
            phase: phase,
            endsAt: endsAt,
            remainingSeconds: session.remaining(at: now),
            plannedSeconds: session.plannedDuration
        )
    }

    private static func encode(_ reply: FocusBridgeReply) -> String {
        guard let data = try? JSONEncoder().encode(reply), let json = String(data: data, encoding: .utf8) else {
            Log.app.error("Bridge: could not encode the reply")
            return #"{"error":"encoding_failed"}"#
        }
        return json
    }
}
