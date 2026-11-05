import Foundation

/// Where a task or event comes from; also decides whether it can be completed remotely.
enum TaskSourceKind: String, Codable, CaseIterable, Hashable {
    case appleCalendar
    case appleReminders
    case googleCalendar
    case googleTasks
    /// Today's tasks from PaceTasks itself, completed in Supabase by the app.
    case paceTasks

    /// Calendar events have no "done" state remotely, so they are only checked off locally.
    var isEvent: Bool {
        self == .appleCalendar || self == .googleCalendar
    }

    /// Calendars and Reminders include every account added in macOS, not only iCloud.
    var displayName: String {
        switch self {
        case .appleCalendar: return String(localized: "Calendars")
        case .appleReminders: return String(localized: "Reminders")
        case .googleCalendar: return String(localized: "Google Calendar (direct)")
        case .googleTasks: return String(localized: "Google Tasks")
        case .paceTasks: return "PaceTasks"
        }
    }

    /// Sources that need Deskfocus' own Google sign-in, rather than the accounts added on the device.
    var requiresGoogleSignIn: Bool {
        self == .googleCalendar || self == .googleTasks
    }
}
