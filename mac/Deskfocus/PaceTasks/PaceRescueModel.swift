import Foundation
import Observation

/// Drives Rescue my day on the Mac, like `useRescue` on the iPhone: asks PaceTasks what still fits the rest of
/// today, lets the user change any destination, and moves the tasks in one go. "Not now" hides it until tomorrow.
@MainActor
@Observable
final class PaceRescueModel {
    private(set) var plan: DatedRescuePlan?
    private(set) var isApplying = false
    private(set) var errorMessage: String?
    private var overrides: [String: PaceRescueDestination] = [:]
    private var dismissedDay: String?

    @ObservationIgnored private let paceTasks: PaceTasksSource
    /// Refreshes the app's lists once tasks have moved; set by the app model after it is built.
    @ObservationIgnored var onApplied: (() async -> Void)?
    @ObservationIgnored private var isLoading = false

    private static let dismissedDayKey = "pacetasks.rescue.dismissedDay"

    init(paceTasks: PaceTasksSource) {
        self.paceTasks = paceTasks
        self.dismissedDay = UserDefaults.standard.string(forKey: Self.dismissedDayKey)
    }

    /// Each proposal with the destination the user chose, if they changed it.
    var choices: [PaceRescueChoice] {
        (plan?.value.proposals ?? []).map { PaceRescueChoice(proposal: $0, destination: overrides[$0.taskId] ?? $0.destination) }
    }

    var moveCount: Int { choices.filter { $0.destination != .today }.count }

    var isVisible: Bool {
        guard let plan, plan.dayKey == Self.todayKey() else { return false }
        return plan.value.behind && moveCount > 0 && dismissedDay != plan.dayKey
    }

    /// Asks for a fresh plan; quiet when PaceTasks isn't connected or the card was dismissed today.
    func refresh() async {
        let today = Self.todayKey()
        guard paceTasks.isAvailable, dismissedDay != today, !isLoading, !isApplying else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let fresh = try await paceTasks.rescuePlan()
            // A changed plan starts from its own proposals again.
            if fresh != plan?.value { overrides = [:] }
            plan = DatedRescuePlan(value: fresh, dayKey: today)
            Log.paceTasks.debug("Rescue plan: behind=\(fresh.behind), \(fresh.proposals.count) tasks")
        } catch {
            // The card simply stays hidden; the next refresh tries again.
            Log.paceTasks.error("Rescue plan unavailable: \(error.localizedDescription, privacy: .public)")
        }
    }

    func setDestination(_ destination: PaceRescueDestination, for taskId: String) {
        overrides[taskId] = destination
    }

    /// Only moves are sent: a task kept for today is left exactly as it is.
    func apply() async {
        let moves = choices.filter { $0.destination != .today }.map { PaceRescueMove(taskId: $0.proposal.taskId, destination: $0.destination) }
        guard !isApplying, !moves.isEmpty else { return }
        isApplying = true
        errorMessage = nil
        do {
            _ = try await paceTasks.applyRescue(moves)
            plan = nil
            overrides = [:]
            isApplying = false
            await onApplied?()
        } catch {
            // The card stays with the user's choices, ready to retry.
            errorMessage = String(localized: "Couldn't move the tasks. Check your connection and try again.")
            isApplying = false
            Log.paceTasks.error("Rescue apply failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func dismiss() {
        let today = Self.todayKey()
        dismissedDay = today
        UserDefaults.standard.set(today, forKey: Self.dismissedDayKey)
    }

    private static func todayKey(now: Date = .now) -> String {
        let components = Calendar.current.dateComponents([.year, .month, .day], from: now)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }
}

/// One task on the card and where it will go.
struct PaceRescueChoice: Identifiable {
    let proposal: PaceRescuePlan.Proposal
    let destination: PaceRescueDestination

    var id: String { proposal.taskId }
}

/// A plan and the day it was made for, so yesterday's plan never shows after midnight.
struct DatedRescuePlan: Equatable {
    let value: PaceRescuePlan
    let dayKey: String
}
