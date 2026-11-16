import Foundation

/// Where Rescue my day sends a PaceTasks task; the same values as `RolloverDestination` in the iPhone app.
enum PaceRescueDestination: String, Codable, CaseIterable, Identifiable {
    case today, tomorrow, weekend, someday

    var id: String { rawValue }

    var label: String {
        switch self {
        case .today: return String(localized: "Today")
        case .tomorrow: return String(localized: "Tomorrow")
        case .weekend: return String(localized: "Weekend")
        case .someday: return String(localized: "Someday")
        }
    }
}

/// What the `rescue` function proposes for the rest of today, with the same rules as the iPhone app.
struct PaceRescuePlan: Decodable, Equatable {
    struct Proposal: Decodable, Equatable, Identifiable {
        let taskId: String
        let title: String
        let destination: PaceRescueDestination
        /// Why it was proposed, as `RescueReason` in the iPhone app.
        let reason: String
        /// At the user's learned pace.
        let minutes: Int

        var id: String { taskId }

        /// A few words on why, like the iPhone card; nil when it needs no explanation.
        var reasonLabel: String? {
            switch reason {
            case "deadline_passed": return String(localized: "Deadline passed")
            case "high_priority": return String(localized: "High priority")
            case "postponed_often": return String(localized: "Moved several times already")
            case "maybe": return String(localized: "A maybe")
            case "today_full": return String(localized: "Today is full")
            case "missed_time": return String(localized: "Its time has passed")
            case "window_closed": return String(localized: "Its window has closed")
            case "deadline_today": return String(localized: "Due today")
            default: return nil
            }
        }
    }

    let behind: Bool
    let minutesLeft: Int
    let minutesPlanned: Int
    /// Tasks to move first, then the ones kept.
    let proposals: [Proposal]
}

/// One confirmed move, as the `rescue` function's "apply" action takes it.
struct PaceRescueMove: Encodable {
    let taskId: String
    let destination: PaceRescueDestination
}
