import Foundation

/// How a PaceTasks task repeats; the same values as `RepeatRule` in the iPhone app
/// (supabase/functions/_shared/domain/repeat.ts). PaceTasks adds the next occurrence when one is completed.
enum PaceRepeatRule: String, CaseIterable, Identifiable {
    case daily, weekdays, weekly, monthly

    var id: String { rawValue }

    var label: String {
        switch self {
        case .daily: return String(localized: "Every day")
        case .weekdays: return String(localized: "Weekdays")
        case .weekly: return String(localized: "Every week")
        case .monthly: return String(localized: "Every month")
        }
    }
}
