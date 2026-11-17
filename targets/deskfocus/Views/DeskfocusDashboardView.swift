import AppIntents
import SwiftUI

/// How much room the widget has: compact for the medium widget, expanded for the large one.
enum DashboardLayout {
    case compact
    case expanded

    var maxRows: Int { self == .expanded ? 4 : 0 }

    var density: AgendaDensity { self == .expanded ? .regular : .compact }
}

/// Today's list, or the focus session while one exists; the WidgetKit widget's content.
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
            let tasks = snapshot.visibleTasks(at: date)
            let done = snapshot.completedCount(on: date)
            VStack(alignment: .leading, spacing: layout == .expanded ? 10 : 8) {
                DayHeaderView(date: date, density: layout.density) {
                    HStack(alignment: .top, spacing: 8) {
                        WidgetSettingsLink(density: layout.density)
                        DayProgressRing(done: done, total: done + tasks.count, density: layout.density)
                            .invalidatableContent()
                    }
                }
                DayAgendaView(
                    tasks: tasks,
                    now: date,
                    maxRows: layout.maxRows,
                    showsUpNext: true,
                    savedProgress: snapshot.savedProgress,
                    density: layout.density,
                    completeAction: { task in
                        Button(intent: CompleteTaskIntent(taskId: task.id)) { CheckGlyph() }
                            .buttonStyle(DeskfocusPressStyle())
                            .accessibilityLabel("Mark as done")
                    },
                    rowAction: { task in
                        Button(intent: StartFocusIntent(taskId: task.id)) { PlayGlyph(size: 26) }
                            .buttonStyle(DeskfocusPressStyle())
                    },
                    upNextAction: { task in
                        Button(intent: StartFocusIntent(taskId: task.id)) { PlayGlyph(size: layout == .expanded ? 38 : 32, isProminent: true) }
                            .buttonStyle(DeskfocusPressStyle())
                    }
                )
                .invalidatableContent()
                Spacer(minLength: 0)
            }
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
                .background(Circle().fill(Color.white.opacity(0.14)))
        }
        .accessibilityLabel(Text("Widget settings"))
    }
}
