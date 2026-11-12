import Foundation
import WidgetKit

/// Rebuilds today's list in the shared state from PaceTasks and EventKit, and settles completions made in the widget.
enum WidgetTaskSync {
    /// Reloads today's list; the widget calls it for every timeline and the app after each button press.
    @discardableResult
    static func refresh(now: Date = .now) async -> DeskfocusSnapshot {
        let settings = SharedStore.shared.load().settings
        let paceTasks = PaceTasksFeed.tasks(now: now)
        let tasks = (paceTasks + (await EventKitTasks.today(now: now, settings: settings))).sortedForToday()
        let paceTaskIds = Set(paceTasks.map(\.id))
        let taskIds = Set(tasks.map(\.id))
        let today = DateInterval.day(containing: now)

        let snapshot = SharedStore.shared.update { snapshot in
            let focusTaskId = snapshot.focus?.taskId
            // Items still needed after they leave today's list: completions not yet applied, and the focus task.
            let stillNeeded = snapshot.tasks.filter { snapshot.pendingCompletionIds.contains($0.id) || $0.id == focusTaskId }
            snapshot.tasks = tasks
            stillNeeded.forEach { snapshot.reference($0) }
            // A PaceTasks task leaves the app's list once Supabase has it done (or it moved to another day),
            // which settles its completion: it must not be completed again later.
            let settled = snapshot.pendingCompletionIds.filter { id in
                snapshot.task(withId: id)?.source == .paceTasks && !paceTaskIds.contains(id)
            }
            snapshot.pendingCompletionIds.subtract(settled)
            let pending = snapshot.pendingCompletionIds
            snapshot.referencedTasks = snapshot.referencedTasks.filter { pending.contains($0.id) || $0.id == focusTaskId }
            snapshot.completedTaskIds = snapshot.completedTaskIds.filter { taskIds.contains($0) || pending.contains($0) }
            snapshot.completionDates = snapshot.completionDates.filter { $0.value >= today.start }
            // Unfinished sessions can be resumed for a week.
            let resumeLimit = today.start.addingTimeInterval(-7 * 86_400)
            snapshot.savedProgress = snapshot.savedProgress.filter { $0.value.savedAt >= resumeLimit }
            snapshot.pruneFocusMinutes(olderThan: today.start.addingTimeInterval(-60 * 86_400), now: now)
            snapshot.lastSyncDate = now
        }
        PaceTasksFeed.publishPendingCompletions(of: snapshot)
        Log.sync.info("Widget list: \(paceTasks.count) PaceTasks tasks, \(tasks.count - paceTasks.count) calendar items")
        return snapshot
    }

    /// Completes reminders checked off in the widget; failures stay queued for the next button press.
    /// PaceTasks tasks are left to the app, which completes them in Supabase.
    static func completePendingReminders() {
        let snapshot = SharedStore.shared.load()
        var done: Set<String> = []
        var dropped: Set<String> = []
        for taskId in snapshot.pendingCompletionIds {
            guard let task = snapshot.task(withId: taskId) else {
                Log.sync.error("Dropping pending completion for unknown task")
                dropped.insert(taskId)
                continue
            }
            guard task.source == .appleReminders else { continue }
            do {
                try EventKitTasks.complete(task)
                done.insert(taskId)
            } catch {
                Log.sync.error("Reminder completion failed, will retry: \(error.localizedDescription, privacy: .public)")
            }
        }
        guard !done.isEmpty || !dropped.isEmpty else { return }
        SharedStore.shared.update { snapshot in
            snapshot.pendingCompletionIds.subtract(done.union(dropped))
            snapshot.completedTaskIds.subtract(dropped)
        }
    }
}
