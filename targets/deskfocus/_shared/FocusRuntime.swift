import Foundation

/// Follow-up after a widget or Live Activity button changed the shared state. Those intents run in PaceTasks'
/// own process, which schedules the "time is up" alert, keeps the Live Activity in step and completes reminders.
/// In the widget extension, which compiles the same intents, it does nothing.
@MainActor
enum FocusRuntime {
    private static let coordinator = FocusCoordinator()

    /// True inside PaceTasks, false inside the widget extension (an .appex bundle).
    static var isInApp: Bool {
        Bundle.main.bundleURL.pathExtension != "appex"
    }

    /// Brings alerts, the Live Activity and pending completions in line with the shared state; safe to call any number of times.
    static func afterChange() async {
        guard isInApp else { return }
        WidgetTaskSync.completePendingReminders()
        PaceTasksFeed.publishPendingCompletions(of: SharedStore.shared.load())
        coordinator.reconcile()
        // PaceTasks' JavaScript reads the completions published above only once told they are there.
        DarwinNotifier.post(DeskfocusConstants.stateChangedNotification)
        // The app may be suspended right after the intent returns, so let the Live Activity change finish first.
        await coordinator.waitForLiveActivity()
    }
}
