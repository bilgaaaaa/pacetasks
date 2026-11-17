import EventKit
import Foundation

/// Calendar and Reminders access as PaceTasks reads it; field names match `CalendarAccessReply` in
/// src/lib/calendarAccess.ts. Each is "granted", "undetermined" or "denied".
struct CalendarAccessPayload: Encodable {
    let events: String
    let reminders: String
}

/// Reads and asks for full Calendar and Reminders access straight from EventKit, the access the widget reads with.
enum CalendarAccessBridge {
    static func current() -> CalendarAccessPayload {
        CalendarAccessPayload(
            events: name(EKEventStore.authorizationStatus(for: .event)),
            reminders: name(EKEventStore.authorizationStatus(for: .reminder))
        )
    }

    /// Shows iOS' prompts for whatever was never asked, Calendar first, then answers with the access afterwards.
    static func request() async -> CalendarAccessPayload {
        let store = EKEventStore()
        if EKEventStore.authorizationStatus(for: .event) == .notDetermined {
            do {
                _ = try await store.requestFullAccessToEvents()
            } catch {
                Log.app.error("Calendar access request failed: \(error.localizedDescription, privacy: .public)")
            }
        }
        if EKEventStore.authorizationStatus(for: .reminder) == .notDetermined {
            do {
                _ = try await store.requestFullAccessToReminders()
            } catch {
                Log.app.error("Reminders access request failed: \(error.localizedDescription, privacy: .public)")
            }
        }
        let access = current()
        Log.app.info("Calendar access \(access.events, privacy: .public), reminders \(access.reminders, privacy: .public)")
        return access
    }

    /// Write-only, refused and restricted all mean the widget can't read the items.
    private static func name(_ status: EKAuthorizationStatus) -> String {
        switch status {
        case .fullAccess: return "granted"
        case .notDetermined: return "undetermined"
        default: return "denied"
        }
    }
}
