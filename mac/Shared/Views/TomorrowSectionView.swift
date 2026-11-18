import SwiftUI

/// "Tomorrow" under today's list in the desktop panel and the menu bar: a quiet header and one line per item,
/// without actions. Both scroll, so every item is shown; the widgets put tomorrow beside today instead.
struct TomorrowSectionView: View {
    let tasks: [DeskTask]
    /// Opens tomorrow from the header; nil keeps the header plain.
    var openAction: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Primary-based, so the line shows on dark glass and in the light menu bar popover alike.
            Rectangle()
                .fill(Color.primary.opacity(0.12))
                .frame(height: 1)
                .padding(.horizontal, 8)
                .padding(.bottom, 2)
            if let openAction {
                Button(action: openAction) {
                    header(showsChevron: true)
                        .contentShape(Rectangle())
                }
                .buttonStyle(DeskfocusPressStyle())
                .help("Open tomorrow")
            } else {
                header(showsChevron: false)
            }
            VStack(spacing: 2) {
                ForEach(tasks) { task in
                    DayTaskLine(task: task)
                        .padding(.horizontal, 8)
                }
            }
        }
    }

    private func header(showsChevron: Bool) -> some View {
        HStack(spacing: 6) {
            Text("Tomorrow")
                .textCase(.uppercase)
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.8)
            Spacer(minLength: 6)
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
