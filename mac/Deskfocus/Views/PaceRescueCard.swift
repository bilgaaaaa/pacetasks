import SwiftUI

/// Rescue my day in the menu bar, like the iPhone's card: one slim row ("Running behind · 2 tasks to move")
/// that opens each PaceTasks task with where it would go, each changeable. Nothing moves until "Apply changes";
/// "Not now" hides it until tomorrow.
struct PaceRescueCard: View {
    let rescue: PaceRescueModel
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "lifepreserver")
                        .foregroundStyle(.orange)
                    Text(summary)
                        .font(.system(size: 12, weight: .semibold))
                    Spacer()
                    Text(isExpanded ? String(localized: "Hide") : String(localized: "Review"))
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(summary)

            if isExpanded, let plan = rescue.plan?.value {
                Text(subtitle(plan))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(spacing: 4) {
                    ForEach(rescue.choices) { choice in
                        row(choice.proposal, destination: choice.destination)
                    }
                }

                if let message = rescue.errorMessage {
                    Text(message)
                        .font(.system(size: 11))
                        .foregroundStyle(.red)
                }

                HStack {
                    Button("Not now") { rescue.dismiss() }
                        .controlSize(.small)
                    Spacer()
                    if rescue.isApplying { ProgressView().controlSize(.small) }
                    Button("Apply changes") { Task { await rescue.apply() } }
                        .controlSize(.small)
                        .keyboardShortcut(.defaultAction)
                        .disabled(rescue.isApplying)
                }
            }
        }
        .padding(10)
        .background(.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    private var summary: String {
        rescue.moveCount == 1
            ? String(localized: "Running behind · 1 task to move")
            : String(localized: "Running behind · \(rescue.moveCount) tasks to move")
    }

    private func subtitle(_ plan: PaceRescuePlan) -> String {
        let left = DeskTaskFormatter.duration(minutes: plan.minutesLeft)
        let planned = DeskTaskFormatter.duration(minutes: plan.minutesPlanned)
        return String(localized: "\(left) left today, \(planned) planned. Here's what I'd keep and what I'd move. Change any, then apply.")
    }

    private func row(_ proposal: PaceRescuePlan.Proposal, destination: PaceRescueDestination) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 1) {
                Text(proposal.title)
                    .font(.system(size: 12))
                    .lineLimit(1)
                // The reason only explains PaceTasks' own proposal, so it goes once the user picks another day.
                if destination == proposal.destination, let reason = proposal.reasonLabel {
                    Text(reason)
                        .font(.system(size: 10.5))
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 4)
            Picker("Move \(proposal.title) to", selection: Binding(
                get: { destination },
                set: { rescue.setDestination($0, for: proposal.taskId) }
            )) {
                ForEach(PaceRescueDestination.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .fixedSize()
            .controlSize(.small)
        }
    }
}
