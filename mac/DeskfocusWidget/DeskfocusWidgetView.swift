import SwiftUI
import WidgetKit

/// WidgetKit wrapper around the shared dashboard; the medium widget uses the compact layout.
/// Light text only sits on colored glass that is really drawn; on clear glass, and wherever the system replaces
/// the background (tinted or clear Home Screens, StandBy), the content follows light and dark mode.
struct DeskfocusWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var systemColorScheme
    @Environment(\.showsWidgetContainerBackground) private var showsBackground
    @Environment(\.widgetRenderingMode) private var renderingMode
    let entry: DeskfocusEntry

    private var contentColorScheme: ColorScheme {
        guard showsBackground, renderingMode == .fullColor else { return systemColorScheme }
        return entry.snapshot.settings.glassTint.contentColorScheme(system: systemColorScheme)
    }

    var body: some View {
        DeskfocusDashboardView(
            snapshot: entry.snapshot,
            date: entry.date,
            layout: family == .systemLarge ? .expanded : .compact
        )
        .environment(\.deskfocusAccent, entry.snapshot.settings.accentColor)
        .environment(\.colorScheme, contentColorScheme)
    }
}

/// The widget's container background: the glass color, or for clear glass a neutral card in the system's mode.
/// A view of its own, so it reads the system's light or dark mode rather than the content's.
struct DeskfocusWidgetBackground: View {
    @Environment(\.colorScheme) private var colorScheme
    let tint: GlassTint

    var body: some View {
        tint.widgetBackground(in: colorScheme)
    }
}
