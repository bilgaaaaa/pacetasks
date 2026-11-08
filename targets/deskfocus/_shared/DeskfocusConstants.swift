import Foundation

/// Identifiers shared by PaceTasks and its DeskFocus widget extension.
enum DeskfocusConstants {
    /// App Group both processes can read and write; must match `ios.entitlements` in app.json.
    static let appGroupIdentifier = "group.com.pacetasks.app"
    static let stateFileName = "deskfocus-state.json"
    static let widgetKind = "DeskfocusWidget"
    /// Darwin notification posted whenever the shared state changes in any process.
    static let stateChangedNotification = "com.pacetasks.app.deskfocus.stateChanged"
    /// App Group defaults key the app writes today's PaceTasks tasks to, as JSON (see src/lib/deskfocusWidget.ts).
    static let paceTasksKey = "deskfocus.paceTasks"
    /// App Group defaults key listing PaceTasks tasks checked off in the widget, for the app to complete in Supabase.
    static let completedPaceTaskIdsKey = "deskfocus.completedPaceTaskIds"
    /// Color of PaceTasks rows, the app's brand green.
    static let paceTasksColorHex = "#3F7446"
}
