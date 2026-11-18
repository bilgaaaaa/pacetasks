import AppIntents

// The phrases Siri knows without any setup. Every phrase must name the app, and
// a request must start with one of them: "new event, dinner with friends" alone
// goes to Calendar. Many variants, so the natural wording hits one; the Italian
// versions live in AppShortcuts.xcstrings next to this file. The other
// Siri texts are in the app's Localizable.xcstrings (targets/deskfocus/_shared).
struct PaceShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddTasksIntent(),
      phrases: [
        "Add to \(.applicationName)",
        "Add a task in \(.applicationName)",
        "Brain dump in \(.applicationName)",
        "New task in \(.applicationName)",
        "Add something to \(.applicationName)",
        "Add on \(.applicationName)",
        "Add in \(.applicationName)",
        "New event in \(.applicationName)",
        "New plan in \(.applicationName)",
        "Write down in \(.applicationName)",
        "\(.applicationName) add",
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
