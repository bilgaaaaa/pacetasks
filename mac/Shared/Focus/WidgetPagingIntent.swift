import AppIntents
import WidgetKit

extension AgendaColumn: AppEnum {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Column"
    static let caseDisplayRepresentations: [AgendaColumn: DisplayRepresentation] = [
        .today: "Today",
        .tomorrow: "Tomorrow"
    ]
}

/// Shows another page of a widget column; the widget's stand-in for scrolling, which widgets can't do.
struct ShowTasksPageIntent: AppIntent {
    static let title: LocalizedStringResource = "Show More Tasks"
    static let description = IntentDescription("Shows the next tasks of a column in the widget.")
    static let isDiscoverable = false

    @Parameter(title: "Column")
    var column: AgendaColumn

    @Parameter(title: "Page")
    var page: Int

    init() {}

    init(column: AgendaColumn, page: Int) {
        self.column = column
        self.page = page
    }

    func perform() async throws -> some IntentResult {
        SharedStore.shared.update { $0.widgetPages.show(page: page, of: column, on: .now) }
        WidgetCenter.shared.reloadTimelines(ofKind: DeskfocusConstants.widgetKind)
        Log.widget.debug("Widget \(column.rawValue, privacy: .public) column on page \(page)")
        return .result()
    }
}
