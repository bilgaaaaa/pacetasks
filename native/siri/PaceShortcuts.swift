import AppIntents

// The phrases Siri knows without any setup. Every phrase must name the app; the
// Italian and Turkish versions live in AppShortcuts.xcstrings next to this file.
struct PaceShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddTasksIntent(),
      phrases: [
        "Add to \(.applicationName)",
        "Add a task in \(.applicationName)",
        "Brain dump in \(.applicationName)",
      ],
      shortTitle: "Add tasks",
      systemImageName: "plus.circle"
    )
    AppShortcut(
      intent: NextTaskIntent(),
      phrases: [
        "What's next in \(.applicationName)",
        "What should I do next in \(.applicationName)",
      ],
      shortTitle: "What's next",
      systemImageName: "arrow.forward.circle"
    )
    AppShortcut(
      intent: TodaySummaryIntent(),
      phrases: [
        "What's on today in \(.applicationName)",
        "What's left today in \(.applicationName)",
      ],
      shortTitle: "Today",
      systemImageName: "sun.max"
    )
  }
}
