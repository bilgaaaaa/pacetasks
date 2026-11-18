import AppIntents
import SwiftUI

/// How much room the widget has: compact for the medium widget, expanded for the large one.
enum DashboardLayout {
    case compact
    case expanded

    var maxRows: Int { self == .expanded ? 4 : 0 }

    var density: AgendaDensity { self == .expanded ? .regular : .compact }

    /// Splits the rows between today and tomorrow. With tomorrow's items, the large widget keeps two rows for today
    /// and gives tomorrow two lines for each row today leaves free; the medium widget shows tomorrow only once today is clear.
    func rowBudget(todayRows: Int, hasTodayItems: Bool, tomorrowCount: Int) -> AgendaRowBudget {
        guard tomorrowCount > 0 else { return AgendaRowBudget(today: maxRows, tomorrow: 0) }
        switch self {
        case .expanded:
            let today = min(todayRows, 2)
            return AgendaRowBudget(today: today, tomorrow: 2 + (2 - today) * 2)
        case .compact:
            return AgendaRowBudget(today: 0, tomorrow: hasTodayItems ? 0 : 2)
        }
    }
}

/// How many rows today and tomorrow get under the header; "Up next" is not counted.
struct AgendaRowBudget: Equatable {
    let today: Int
    let tomorrow: Int
}

/// Today's list with tomorrow below it, or the focus session while one exists; the WidgetKit widget's content.
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
            let tomorrowTasks = snapshot.visibleTomorrowTasks(after: date)
            let done = snapshot.completedCount(on: date)
            let budget = layout.rowBudget(
                todayRows: max(tasks.count - 1, 0),
                hasTodayItems: !tasks.isEmpty,
                tomorrowCount: tomorrowTasks.count
            )
            VStack(alignment: .leading, spacing: layout == .expanded ? 10 : 8) {
                DayHeaderView(date: date, density: layout.density) {
                    DayProgressRing(done: done, total: done + tasks.count, density: layout.density)
                        .invalidatableContent()
                }
                // The medium widget swaps the "All clear" card for one line, so tomorrow fits below it.
                if layout == .compact, tasks.isEmpty, budget.tomorrow > 0 {
                    TodayClearLine()
                } else {
                    todayAgenda(tasks: tasks, maxRows: budget.today)
                }
                if budget.tomorrow > 0 {
                    TomorrowSectionView(tasks: tomorrowTasks, maxRows: budget.tomorrow, density: layout.density)
                }
                Spacer(minLength: 0)
            }
            .transition(.opacity)
        }
    }

    private func todayAgenda(tasks: [DeskTask], maxRows: Int) -> some View {
        DayAgendaView(
            tasks: tasks,
            now: date,
            maxRows: maxRows,
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
    }
}
