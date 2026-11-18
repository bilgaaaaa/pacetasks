import Foundation

/// A column of the widget: today's list or tomorrow's.
enum AgendaColumn: String, Codable, CaseIterable, Sendable {
    case today
    case tomorrow
}

/// Which page each widget column is showing. Widgets can't scroll, so a button at a column's foot pages through it.
struct WidgetPages: Codable, Equatable {
    var today = 0
    var tomorrow = 0
    /// The day the pages were chosen on; a new day starts both columns from the top.
    var day: Date?

    func page(of column: AgendaColumn, on date: Date) -> Int {
        guard let day, Calendar.current.isDate(day, inSameDayAs: date) else { return 0 }
        switch column {
        case .today: return today
        case .tomorrow: return tomorrow
        }
    }

    mutating func show(page: Int, of column: AgendaColumn, on date: Date) {
        if let day, !Calendar.current.isDate(day, inSameDayAs: date) {
            self = WidgetPages()
        }
        day = date
        switch column {
        case .today: today = max(page, 0)
        case .tomorrow: tomorrow = max(page, 0)
        }
    }
}

/// One page of a widget column: the items it shows and the page its button leads to.
struct TaskPage {
    let items: [DeskTask]
    let isFirst: Bool
    /// Items after this page; 0 on the last page.
    let remaining: Int
    /// The page after this one, back to the first after the last.
    let nextIndex: Int
    /// True when the column has more than one page, so it needs its button.
    let isPaged: Bool

    /// A page past the end (the list got shorter) wraps around instead of showing nothing.
    init(tasks: [DeskTask], index: Int, size: Int) {
        let size = max(size, 1)
        let pageCount = max(1, (tasks.count + size - 1) / size)
        let index = ((index % pageCount) + pageCount) % pageCount
        let start = index * size
        items = Array(tasks[start..<min(start + size, tasks.count)])
        isFirst = index == 0
        remaining = tasks.count - start - items.count
        nextIndex = (index + 1) % pageCount
        isPaged = pageCount > 1
    }
}
