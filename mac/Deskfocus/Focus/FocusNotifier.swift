import UserNotifications

/// Sends DeskFocus' own notifications, such as "time is up".
enum FocusNotifier {
    static func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, error in
            if let error {
                Log.focus.error("Notification permission failed: \(error.localizedDescription, privacy: .public)")
            } else {
                Log.focus.info("Notification permission granted: \(granted)")
            }
        }
    }

    /// Posts "time is up" now; the app calls it when its end timer fires.
    static func notifyFinished(_ session: FocusSession) {
        post(identifier: session.id.uuidString, content: finishedContent(for: session), trigger: nil)
    }

    /// Explains why a blocked app closed when the user opened it during strict focus.
    static func notifyBlocked(appName: String) {
        let content = UNMutableNotificationContent()
        content.title = String(localized: "\(appName) is blocked while you focus")
        content.body = String(localized: "It will reopen when the session ends.")

        post(identifier: "blocked-\(appName)", content: content, trigger: nil)
    }

    private static func finishedContent(for session: FocusSession) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = String(localized: "Focus time is up")
        content.body = String(localized: "\(session.taskTitle) — mark it done or start another round.")
        content.sound = .default
        return content
    }

    private static func post(identifier: String, content: UNMutableNotificationContent, trigger: UNNotificationTrigger?) {
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request) { error in
            if let error {
                Log.focus.error("Could not post notification: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
}
