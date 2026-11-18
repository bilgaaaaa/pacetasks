import EventKit
import Foundation
import UIKit

/// The widget's settings as PaceTasks' DeskFocus settings sheet reads them; field names match `WidgetSettings`
/// in src/lib/widgetSettings.ts.
struct WidgetSettingsPayload: Encodable {
    let glassTint: String
    let accentColor: String
    let focusMinutes: Int
    let includeUndatedTasks: Bool
    let calendars: [WidgetCalendarPayload]
}

/// One calendar or reminders list the widget can show, with the switch the user set for it.
struct WidgetCalendarPayload: Encodable {
    /// `DeskTask.containerKey`, the key `hiddenContainerKeys` stores.
    let key: String
    /// "calendar" or "reminders".
    let kind: String
    let title: String
    /// The account the calendar belongs to, e.g. "iCloud" or a Gmail address.
    let account: String
    /// "icloud", "google", "exchange", "local", "subscribed" or "other", for the account's icon and status.
    let accountKind: String
    let colorHex: String
    let visible: Bool
}

/// A change from the settings sheet; only the fields that are set change. Field names match `WidgetSettingsPatch`.
struct WidgetSettingsPatch: Decodable {
    let glassTint: String?
    let accentColor: String?
    let focusMinutes: Int?
    let includeUndatedTasks: Bool?
    let calendarKey: String?
    let calendarVisible: Bool?
}

/// Reads and changes the DeskFocus widget's settings for PaceTasks, which has no settings of its own for them.
enum WidgetSettingsBridge {
    /// System gray, for a calendar whose color can't be read.
    private static let fallbackColorHex = "#8E8E93"

    static func current() -> WidgetSettingsPayload {
        let settings = SharedStore.shared.load().settings
        return WidgetSettingsPayload(
            glassTint: settings.glassTint.rawValue,
            accentColor: settings.accentColor.rawValue,
            focusMinutes: settings.focusMinutes,
            includeUndatedTasks: settings.includeUndatedTasks,
            calendars: calendars(settings: settings)
        )
    }

    /// Saves a change in the shared settings the widget reads; unknown values are ignored.
    static func apply(_ patch: WidgetSettingsPatch) {
        SharedStore.shared.update { snapshot in
            if let raw = patch.glassTint, let tint = GlassTint(rawValue: raw) {
                snapshot.settings.glassTint = tint
            }
            if let raw = patch.accentColor, let accent = AccentChoice(rawValue: raw) {
                snapshot.settings.accentColor = accent
            }
            if let minutes = patch.focusMinutes {
                snapshot.settings.focusMinutes = min(max(minutes, DeskfocusSettings.minimumFocusMinutes), DeskfocusSettings.maximumFocusMinutes)
            }
            if let include = patch.includeUndatedTasks {
                snapshot.settings.includeUndatedTasks = include
            }
            if let key = patch.calendarKey, let visible = patch.calendarVisible {
                if visible {
                    snapshot.settings.hiddenContainerKeys.remove(key)
                } else {
                    snapshot.settings.hiddenContainerKeys.insert(key)
                }
            }
        }
        Log.app.info("Bridge: widget settings changed")
    }

    /// Every calendar and reminders list on the phone, from all its accounts; empty without full access.
    private static func calendars(settings: DeskfocusSettings) -> [WidgetCalendarPayload] {
        let store = EKEventStore()
        var result: [WidgetCalendarPayload] = []
        if EKEventStore.authorizationStatus(for: .event) == .fullAccess {
            result += store.calendars(for: .event).map { payload(for: $0, source: .appleCalendar, kind: "calendar", settings: settings) }
        }
        if EKEventStore.authorizationStatus(for: .reminder) == .fullAccess {
            result += store.calendars(for: .reminder).map { payload(for: $0, source: .appleReminders, kind: "reminders", settings: settings) }
        }
        return result.sorted { ($0.kind, $0.account, $0.title) < ($1.kind, $1.account, $1.title) }
    }

    /// What kind of account a calendar comes from; a Google account added to the iPhone syncs over CalDAV.
    private static func accountKind(of source: EKSource?) -> String {
        guard let source else { return "other" }
        switch source.sourceType {
        case .local: return "local"
        case .exchange: return "exchange"
        case .mobileMe: return "icloud"
        case .subscribed, .birthdays: return "subscribed"
        case .calDAV:
            let title = source.title.lowercased()
            if title == "icloud" { return "icloud" }
            if title.contains("gmail") || title.contains("google") { return "google" }
            return "other"
        @unknown default: return "other"
        }
    }

    private static func payload(for calendar: EKCalendar, source: TaskSourceKind, kind: String, settings: DeskfocusSettings) -> WidgetCalendarPayload {
        WidgetCalendarPayload(
            key: DeskTask.containerKey(source: source, containerIdentifier: calendar.calendarIdentifier),
            kind: kind,
            title: calendar.title,
            account: calendar.source?.title ?? "",
            accountKind: accountKind(of: calendar.source),
            colorHex: UIColor(cgColor: calendar.cgColor).hexString ?? Self.fallbackColorHex,
            visible: settings.isContainerVisible(source: source, containerIdentifier: calendar.calendarIdentifier)
        )
    }
}
