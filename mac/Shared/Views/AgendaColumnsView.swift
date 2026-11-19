import AppIntents
import SwiftUI

/// Today and tomorrow side by side, like the two pages of an open diary: today with its buttons, tomorrow to read.
/// Widgets can't scroll, so a column with more items than fit pages through them with the button at its foot.
struct AgendaColumnsView<Complete: View, Start: View, TomorrowAccessory: View>: View {
    @Environment(\.deskfocusAccent) private var accent
    @Environment(\.colorScheme) private var colorScheme
    let today: [DeskTask]
    let tomorrow: [DeskTask]
    let date: Date
    let pages: WidgetPages
    let layout: DashboardLayout
    /// Items checked off today, for the progress ring.
    let doneCount: Int
    var savedProgress: [String: SavedFocusProgress] = [:]
    @ViewBuilder var completeAction: (DeskTask) -> Complete
    /// The ▶ button; `isNext` marks today's first item, which gets the prominent one.
    @ViewBuilder var startAction: (DeskTask, _ isNext: Bool) -> Start
    /// Trailing control in tomorrow's header, such as the iPhone's settings gear.
    @ViewBuilder var tomorrowAccessory: () -> TomorrowAccessory

    private var density: AgendaDensity { layout.density }
    private var isCompact: Bool { density == .compact }

    var body: some View {
        GeometryReader { proxy in
            let spacing: CGFloat = isCompact ? 10 : 12
            // Today keeps the wider page: its rows carry the buttons.
            let tomorrowWidth = (proxy.size.width - spacing * 2 - 1) * 0.42
            HStack(alignment: .top, spacing: spacing) {
                todayColumn
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .invalidatableContent()
                Rectangle()
                    .fill(DeskfocusTheme.hairline)
                    .frame(width: 1)
                tomorrowColumn
                    .frame(width: tomorrowWidth, alignment: .topLeading)
            }
        }
    }

    // MARK: Today

    private var todayColumn: some View {
        let page = TaskPage(tasks: today, index: pages.page(of: .today, on: date), size: layout.todayPageSize)
        let nextId = today.first?.id
        return VStack(alignment: .leading, spacing: isCompact ? 3 : 4) {
            ColumnHeader(
                label: DeskTaskFormatter.weekday(date).uppercased(),
                title: DeskTaskFormatter.dayMonth(date),
                labelColor: accent.color(in: colorScheme),
                density: density
            ) {
                DayProgressRing(done: doneCount, total: doneCount + today.count, density: .compact)
            }
            if today.isEmpty {
                ColumnNote(text: String(localized: "Nothing left today"), systemImage: "checkmark.circle.fill", density: density)
            } else {
                ForEach(page.items) { task in
                    let isNext = page.isFirst && task.id == nextId
                    ColumnTaskRow(task: task, now: date, isNext: isNext, resumeRemaining: savedProgress[task.id]?.remaining, density: density) {
                        completeAction(task)
                    } start: {
                        // The medium widget has room for ▶ on the next item only; the others start from the large widget or the app.
                        if !isCompact || isNext {
                            startAction(task, isNext)
                        }
                    }
                }
                if page.isPaged {
                    PageButton(column: .today, page: page, density: density)
                }
            }
        }
    }

    // MARK: Tomorrow

    private var tomorrowColumn: some View {
        let page = TaskPage(tasks: tomorrow, index: pages.page(of: .tomorrow, on: date), size: layout.tomorrowPageSize)
        let tomorrowDate = DateInterval.day(containing: date).end
        return VStack(alignment: .leading, spacing: isCompact ? 3 : 4) {
            ColumnHeader(
                label: String(localized: "Tomorrow").uppercased(),
                title: DeskTaskFormatter.dayMonth(tomorrowDate),
                labelColor: .secondary,
                density: density
            ) {
                tomorrowAccessory()
            }
            .opacity(0.85)
            if tomorrow.isEmpty {
                ColumnNote(text: String(localized: "Nothing planned"), systemImage: "sun.max", density: density)
            } else {
                ForEach(page.items) { task in
                    DayTaskLine(task: task, density: density, isStacked: true)
                }
                if page.isPaged {
                    PageButton(column: .tomorrow, page: page, density: density)
                }
            }
        }
    }
}

/// Weekday (or "Tomorrow") above the date, with a control on the right.
private struct ColumnHeader<Trailing: View>: View {
    let label: String
    let title: String
    let labelColor: Color
    let density: AgendaDensity
    @ViewBuilder var trailing: () -> Trailing

    private var isCompact: Bool { density == .compact }

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.system(size: isCompact ? 9.5 : 10.5, weight: .bold))
                    .tracking(0.7)
                    .foregroundStyle(labelColor)
                Text(title)
                    .font(.system(size: isCompact ? 15 : 19, weight: .bold))
                    // Only the large size needs it for long months; in the medium one it shrank dates that fit.
                    .minimumScaleFactor(isCompact ? 1 : 0.8)
            }
            .lineLimit(1)
            // The date takes all the room beside the control, so it shrinks only when it really doesn't fit.
            .frame(maxWidth: .infinity, alignment: .leading)
            trailing()
        }
        .padding(.bottom, isCompact ? 2 : 4)
    }
}

/// A today item in its column: checkbox, color bar, title over its time, and ▶; the next item is set in bold.
private struct ColumnTaskRow<Complete: View, Start: View>: View {
    @Environment(\.deskfocusAccent) private var accent
    @Environment(\.colorScheme) private var colorScheme
    let task: DeskTask
    let now: Date
    let isNext: Bool
    var resumeRemaining: TimeInterval? = nil
    let density: AgendaDensity
    @ViewBuilder var complete: () -> Complete
    @ViewBuilder var start: () -> Start

    private var isCompact: Bool { density == .compact }

    var body: some View {
        HStack(spacing: isCompact ? 6 : 8) {
            complete()
            Capsule()
                .fill(Color(hex: task.colorHex) ?? DeskfocusTheme.indigo)
                .frame(width: 3, height: isCompact ? 22 : 26)
            VStack(alignment: .leading, spacing: 1) {
                Text(task.title)
                    .font(.system(size: isCompact ? 12.5 : 13.5, weight: isNext ? .semibold : .medium))
                if isNext && task.isHappening(at: now) {
                    Text(DeskTaskFormatter.upNextLabel(for: task, now: now))
                        .font(.system(size: isCompact ? 10.5 : 11, weight: .semibold))
                        .foregroundStyle(accent.color(in: colorScheme))
                } else {
                    TaskSubtitleLine(task: task, now: now, resumeRemaining: resumeRemaining)
                        .font(.system(size: isCompact ? 10.5 : 11))
                }
            }
            .lineLimit(1)
            Spacer(minLength: 2)
            start()
        }
        .padding(.vertical, isCompact ? 1 : 2)
    }
}

/// An item without buttons: calendar color bar, title, and its time, "All day" or "To-do".
/// Stacked puts the time under the title, so a narrow column keeps more of the title.
struct DayTaskLine: View {
    let task: DeskTask
    var density: AgendaDensity = .regular
    var isStacked = false

    private var isCompact: Bool { density == .compact }

    var body: some View {
        HStack(spacing: isCompact ? 6 : 8) {
            Capsule()
                .fill(Color(hex: task.colorHex) ?? DeskfocusTheme.indigo)
                .frame(width: 3, height: isStacked ? (isCompact ? 22 : 26) : (isCompact ? 12 : 14))
            if isStacked {
                VStack(alignment: .leading, spacing: 1) {
                    title
                    time
                }
            } else {
                title
                Spacer(minLength: 4)
                time
            }
        }
        .lineLimit(1)
        .padding(.vertical, isCompact ? 1 : 2)
        .accessibilityElement(children: .combine)
    }

    private var title: some View {
        Text(task.title)
            .font(.system(size: isCompact ? 12 : 12.5, weight: .medium))
    }

    private var time: some View {
        Text(DeskTaskFormatter.timeLabel(for: task))
            .font(.system(size: isCompact ? 10.5 : 11))
            .monospacedDigit()
            .foregroundStyle(.secondary)
    }
}

/// A short line in place of an empty column.
private struct ColumnNote: View {
    @Environment(\.deskfocusAccent) private var accent
    @Environment(\.colorScheme) private var colorScheme
    let text: String
    let systemImage: String
    let density: AgendaDensity

    var body: some View {
        Label {
            Text(text)
        } icon: {
            Image(systemName: systemImage)
                .foregroundStyle(accent.markGradient(in: colorScheme))
        }
        .font(.system(size: density == .compact ? 11.5 : 12.5, weight: .semibold))
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .padding(.top, 2)
    }
}

/// "+3 more" at a column's foot, or "Back to start" on its last page; each tap shows the next page.
private struct PageButton: View {
    let column: AgendaColumn
    let page: TaskPage
    let density: AgendaDensity

    var body: some View {
        Button(intent: ShowTasksPageIntent(column: column, page: page.nextIndex)) {
            HStack(spacing: 4) {
                Text(page.remaining > 0 ? String(localized: "+\(page.remaining) more") : String(localized: "Back to start"))
                Image(systemName: page.remaining > 0 ? "chevron.down" : "chevron.up")
                    .font(.system(size: density == .compact ? 8.5 : 9.5, weight: .bold))
            }
            .font(.system(size: density == .compact ? 10.5 : 11, weight: .semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Capsule().fill(Color.primary.opacity(0.1)))
            .contentShape(Capsule())
        }
        .buttonStyle(DeskfocusPressStyle())
        .padding(.top, 1)
        .accessibilityLabel(page.remaining > 0 ? Text("Show \(page.remaining) more") : Text("Show the first tasks again"))
    }
}
