import Foundation

/// Learned pace: how long tasks really take this user, read from PaceTasks' timer history, so a focus
/// session lasts as long as the task usually does. Same rules and limits as the iPhone app's
/// supabase/functions/_shared/domain/pace.ts; change both together.
struct PaceModel {
    /// One finished task with a logged duration.
    struct Run: Decodable {
        let title: String
        let estimatedMinutes: Int
        let actualMinutes: Int
    }

    /// Latest timed tasks that count; the Mac fetches exactly this many.
    static let historyLimit = 300
    /// A task's usual length comes from its latest timed runs only, so a changed habit shows quickly.
    static let recentTimings = 5
    /// One timed run is a sample, two start a pattern.
    static let minTimingsForTask = 2
    /// Timed tasks needed before the overall pace is trusted.
    static let minTimedTasksForRatio = 5
    /// The overall pace never more than halves or doubles an estimate.
    static let ratioRange = 0.5...2.0
    /// Same limits the PaceTasks database puts on a task's minutes.
    static let minutesRange = 1...480

    static let empty = PaceModel(newestFirst: [])

    private let usualByTitle: [String: (minutes: Int, timings: Int)]
    private let ratio: Double?

    /// `newestFirst`: timed tasks ordered by creation, newest first, as fetched.
    init(newestFirst runs: [Run]) {
        let timed = Array(runs.filter { $0.actualMinutes > 0 }.prefix(Self.historyLimit))

        var recent: [String: [Int]] = [:]
        for run in timed {
            let key = Self.key(run.title)
            guard !key.isEmpty, recent[key, default: []].count < Self.recentTimings else { continue }
            recent[key, default: []].append(run.actualMinutes)
        }
        usualByTitle = recent.mapValues { (minutes: Self.median($0), timings: $0.count) }

        let estimated = timed.reduce(0) { $0 + $1.estimatedMinutes }
        if timed.count >= Self.minTimedTasksForRatio, estimated > 0 {
            let actual = timed.reduce(0) { $0 + $1.actualMinutes }
            ratio = min(Self.ratioRange.upperBound, max(Self.ratioRange.lowerBound, Double(actual) / Double(estimated)))
        } else {
            ratio = nil
        }
    }

    /// The task's own usual length once timed twice; its estimate when timed once (that estimate already came
    /// from the run); otherwise the estimate scaled by the overall pace.
    func expectedMinutes(title: String, estimatedMinutes: Int) -> Int {
        if let pace = usualByTitle[Self.key(title)] {
            return pace.timings >= Self.minTimingsForTask ? pace.minutes : estimatedMinutes
        }
        guard let ratio else { return estimatedMinutes }
        let scaled = Int((Double(estimatedMinutes) * ratio).rounded())
        return min(Self.minutesRange.upperBound, max(Self.minutesRange.lowerBound, scaled))
    }

    /// Same as `normalizeTitle` in taskHistory.ts: trimmed and lowercased.
    private static func key(_ title: String) -> String {
        title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// Median rounded half up, like Math.round in the iPhone app.
    private static func median(_ values: [Int]) -> Int {
        let sorted = values.sorted()
        let mid = sorted.count / 2
        if sorted.count % 2 == 1 { return sorted[mid] }
        return Int((Double(sorted[mid - 1] + sorted[mid]) / 2).rounded(.toNearestOrAwayFromZero))
    }
}
