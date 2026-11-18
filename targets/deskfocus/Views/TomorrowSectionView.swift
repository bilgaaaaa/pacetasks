import SwiftUI

/// "Tomorrow" under today's list, like the Calendar widget: a quiet header and one line per item, without actions.
/// With a row limit the longest list that fits is shown, so a tight widget drops rows instead of clipping them.
struct TomorrowSectionView: View {
    let tasks: [DeskTask]
    /// Most rows to show; nil shows them all, for lists that scroll.
    var maxRows: Int? = nil
    var density: AgendaDensity = .regular
    /// Opens tomorrow from the header where the surface can browse days; nil keeps the header plain.
    var openAction: (() -> Void)? = nil

    private var isCompact: Bool { density == .compact }

    var body: some View {
        if let maxRows {
            ViewThatFits(in: .vertical) {
                ForEach(Array(stride(from: min(maxRows, tasks.count), through: 1, by: -1)), id: \.self) { rows in
                    section(rows: rows)
                }
            }
        } else {
            section(rows: tasks.count)
        }
    }

    private func section(rows: Int) -> some View {
        let shown = Array(tasks.prefix(rows))
        return VStack(alignment: .leading, spacing: isCompact ? 3 : 4) {
            if !isCompact {
                // Primary-based, so the line shows on dark glass and in the light menu bar popover alike.
                Rectangle()
                    .fill(Color.primary.opacity(0.12))
                    .frame(height: 1)
                    .padding(.horizontal, 8)
                    .padding(.bottom, 2)
            }
            if let openAction {
                Button(action: openAction) {
                    header(hiddenCount: tasks.count - shown.count, showsChevron: true)
                        .contentShape(Rectangle())
                }
                .buttonStyle(DeskfocusPressStyle())
                .help("Open tomorrow")
            } else {
                header(hiddenCount: tasks.count - shown.count, showsChevron: false)
            }
            VStack(spacing: 2) {
                ForEach(shown) { task in
                    TomorrowTaskLine(task: task, density: density)
                }
            }
        }
    }

    private func header(hiddenCount: Int, showsChevron: Bool) -> some View {
        HStack(spacing: 6) {
            Text("Tomorrow")
                .textCase(.uppercase)
                .font(.system(size: isCompact ? 10 : 10.5, weight: .bold))
                .tracking(0.8)
            Spacer(minLength: 6)
            if hiddenCount > 0 {
                Text("+\(hiddenCount) more")
                    .font(.system(size: isCompact ? 10 : 10.5))
            }
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 9.5, weight: .bold))
            }
        }
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .padding(.horizontal, 8)
    }
}

/// One tomorrow item: calendar color bar, title, and its start time, "All day" or "To-do" at the end.
private struct TomorrowTaskLine: View {
    let task: DeskTask
    var density: AgendaDensity = .regular

    private var isCompact: Bool { density == .compact }

    var body: some View {
        HStack(spacing: 8) {
            Capsule()
                .fill(Color(hex: task.colorHex) ?? DeskfocusTheme.indigo)
                .frame(width: 3, height: isCompact ? 12 : 14)
            Text(task.title)
                .font(.system(size: isCompact ? 12 : 12.5, weight: .medium))
            Spacer(minLength: 6)
            Text(DeskTaskFormatter.timeLabel(for: task))
                .font(.system(size: isCompact ? 10.5 : 11))
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .lineLimit(1)
        .padding(.horizontal, 8)
        .padding(.vertical, isCompact ? 1 : 2)
        .accessibilityElement(children: .combine)
    }
}

/// One quiet line for a finished day, so the medium widget has room for tomorrow.
struct TodayClearLine: View {
    @Environment(\.deskfocusAccent) private var accent

    var body: some View {
        Label {
            Text("Nothing left today")
        } icon: {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(accent.gradient)
        }
        .font(.system(size: 12, weight: .semibold))
        .lineLimit(1)
        .padding(.horizontal, 8)
    }
}
