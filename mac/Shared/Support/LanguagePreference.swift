import Foundation

/// Applies the chosen language to the current process, which reads it when it next launches.
/// On the Mac the choice comes from DeskFocus' settings; on iPhone it is PaceTasks' own
/// language (Settings › Language), sent through the bridge, so the widget, the Live Activity
/// and the alerts read in the same language as the app.
enum LanguagePreference {
    private static let appleLanguagesKey = "AppleLanguages"

    static func apply(_ language: AppLanguage) {
        let defaults = UserDefaults.standard
        let current = defaults.persistentDomain(forName: Bundle.main.bundleIdentifier ?? "")?[appleLanguagesKey] as? [String]
        let wanted = language.code.map { [$0] }
        guard current != wanted else { return }

        if let wanted {
            defaults.set(wanted, forKey: appleLanguagesKey)
        } else {
            defaults.removeObject(forKey: appleLanguagesKey)
        }
        Log.app.info("Language set to \(language.rawValue, privacy: .public), used from the next launch")
    }
}
