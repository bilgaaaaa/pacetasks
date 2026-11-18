import SwiftUI
import WidgetKit

/// The DeskFocus widget inside PaceTasks, and the focus timer's Live Activity.
@main
struct DeskfocusWidgetBundle: WidgetBundle {
    var body: some Widget {
        DeskfocusWidget()
        FocusLiveActivityWidget()
    }
}

/// One widget for both jobs: today's list with start buttons, turning into the live timer while focusing.
struct DeskfocusWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: DeskfocusConstants.widgetKind, provider: DeskfocusTimelineProvider()) { entry in
            DeskfocusWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    // DeskFocus' glass color, the same as on the Mac.
                    entry.snapshot.settings.glassTint.gradient
                }
                .environment(\.colorScheme, .dark)
        }
        .configurationDisplayName("DeskFocus")
        .description("Today's PaceTasks tasks, calendar and reminders, with a focus timer.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
