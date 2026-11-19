import AppIntents
import SwiftUI

/// How much room the widget has: compact for the medium widget, expanded for the large one.
enum DashboardLayout {
    case compact
    case expanded

    var density: AgendaDensity { self == .expanded ? .regular : .compact }

    /// Today's items per page, the first one included; more would run past the widget's edge.
    var todayPageSize: Int { self == .expanded ? 6 : 2 }

    /// Tomorrow's items per page; they are about as tall as today's rows, so the columns line up.
    var tomorrowPageSize: Int { self == .expanded ? 7 : 2 }
}

/// Today and tomorrow side by side, or the focus session while one exists; the WidgetKit widget's content.
/// Everything a button changes is marked invalidatable, so it dims until the widget reloads.
struct DeskfocusDashboardView: View {
    let snapshot: DeskfocusSnapshot
    let date: Date
    let layout: DashboardLayout

    var body: some View {
        if let session = snapshot.focus {
            FocusSessionView(
                session: session,
                now: date,
                settings: snapshot.settings,
                size: layout == .expanded ? .regular : .compact
            )
            .invalidatableContent()
            .transition(.scale(scale: 0.94).combined(with: .opacity))
        } else {
            AgendaColumnsView(
                today: snapshot.visibleTasks(at: date),
                tomorrow: snapshot.visibleTomorrowTasks(after: date),
                date: date,
                pages: snapshot.widgetPages,
                layout: layout,
                doneCount: snapshot.completedCount(on: date),
                savedProgress: snapshot.savedProgress,
                completeAction: { task in
                    Button(intent: CompleteTaskIntent(taskId: task.id)) { CheckGlyph(size: layout == .expanded ? 20 : 18) }
                        .buttonStyle(DeskfocusPressStyle())
                        .accessibilityLabel("Mark as done")
                },
                startAction: { task, isNext in
                    Button(intent: StartFocusIntent(taskId: task.id)) {
                        PlayGlyph(size: isNext ? (layout == .expanded ? 32 : 28) : 24, isProminent: isNext)
                    }
                    .buttonStyle(DeskfocusPressStyle())
                },
                tomorrowAccessory: { WidgetSettingsLink(density: layout.density) }
            )
            .transition(.opacity)
        }
    }
}

/// The gear in the widget's header: opens PaceTasks on its DeskFocus settings (calendars, colors, focus length).
private struct WidgetSettingsLink: View {
    let density: AgendaDensity

    var body: some View {
        let size: CGFloat = density == .compact ? 24 : 28
        Link(destination: DeskfocusConstants.settingsURL) {
            Image(systemName: "gearshape.fill")
                .font(.system(size: size * 0.46, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(width: size, height: size)
                .background(Circle().fill(Color.primary.opacity(0.14)))
        }
        .accessibilityLabel(Text("Widget settings"))
    }
}
