import AppIntents
import PaceSessionStore

// PaceTasks' Siri and Shortcuts actions. Each asks the PaceTasks server, which
// does the work and answers with the sentence Siri says (see supabase/functions/siri).
// Copied into the app target by plugins/withPaceSiri.js at prebuild.

struct AddTasksIntent: AppIntent {
  static let title: LocalizedStringResource = "Add to PaceTasks"
  static let description = IntentDescription("Add one or more tasks by voice, in English, Italian or Turkish.")
  static let openAppWhenRun = false

  @Parameter(title: "Tasks", requestValueDialog: "What should I add?")
  var text: String

  static var parameterSummary: some ParameterSummary {
    Summary("Add \(\.$text) to PaceTasks")
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let speech = await PaceSiriClient.ask(.add, text: text)
    return .result(dialog: "\(speech)")
  }
}

struct NextTaskIntent: AppIntent {
  static let title: LocalizedStringResource = "What's next in PaceTasks"
  static let description = IntentDescription("Hear the one task to do now.")
  static let openAppWhenRun = false
  // Task titles are personal, so Siri reads them only on an unlocked phone.
  static let authenticationPolicy = IntentAuthenticationPolicy.requiresAuthentication

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let speech = await PaceSiriClient.ask(.next)
    return .result(dialog: "\(speech)")
  }
}

struct TodaySummaryIntent: AppIntent {
  static let title: LocalizedStringResource = "What's on today in PaceTasks"
  static let description = IntentDescription("Hear how many tasks are left today and how long they take.")
  static let openAppWhenRun = false
  static let authenticationPolicy = IntentAuthenticationPolicy.requiresAuthentication

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let speech = await PaceSiriClient.ask(.today)
    return .result(dialog: "\(speech)")
  }
}
