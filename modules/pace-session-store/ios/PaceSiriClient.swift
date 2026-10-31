import Foundation
import os

// What Siri can ask PaceTasks; mirrors SIRI_ACTIONS in supabase/functions/_shared/server/siri/siriRequest.ts.
public enum PaceSiriAction: String, Sendable {
  case add
  case next
  case today
}

// Calls POST /functions/v1/siri as the signed-in user and returns the sentence
// Siri should say. Never throws: every failure becomes a short, localized line.
public enum PaceSiriClient {
  private static let requestTimeout: TimeInterval = 15
  private static let logger = Logger(subsystem: "com.pacetasks.app", category: "Siri")

  private struct Reply: Decodable {
    let speech: String
  }

  public static func ask(_ action: PaceSiriAction, text: String? = nil) async -> String {
    guard let config = PaceSupabaseConfig.fromInfoPlist() else {
      logger.error("Supabase settings are missing from Info.plist")
      return failedLine()
    }

    let accessToken: String
    do {
      accessToken = try await PaceSupabaseSession(config: config).validAccessToken()
    } catch {
      logger.notice("No usable session for Siri: \(String(describing: error), privacy: .public)")
      return openAppLine()
    }

    var body: [String: Any] = [
      "action": action.rawValue,
      "timeZone": TimeZone.current.identifier,
      "locale": Bundle.main.preferredLocalizations.first ?? "en",
      "channel": "siri",
    ]
    if let text { body["text"] = text }

    do {
      var request = URLRequest(url: config.url.appendingPathComponent("functions/v1/siri"), timeoutInterval: requestTimeout)
      request.httpMethod = "POST"
      request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
      request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      request.httpBody = try JSONSerialization.data(withJSONObject: body)

      let (data, response) = try await URLSession.shared.data(for: request)
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      // The server puts the words to say in every answer, failures included.
      let reply = try JSONDecoder().decode(Reply.self, from: data)
      logger.info("Siri \(action.rawValue, privacy: .public) answered with status \(status, privacy: .public)")
      return reply.speech
    } catch {
      logger.error("Siri \(action.rawValue, privacy: .public) failed: \(String(describing: error), privacy: .public)")
      return failedLine()
    }
  }

  // Looked up in the app's Localizable.xcstrings (English, Italian, Turkish).
  private static func failedLine() -> String {
    String(localized: "siri.failed", defaultValue: "PaceTasks couldn't do that right now. Try again in a moment.", bundle: .main)
  }

  private static func openAppLine() -> String {
    String(localized: "siri.openApp", defaultValue: "Open PaceTasks once so Siri can reach your tasks.", bundle: .main)
  }
}
