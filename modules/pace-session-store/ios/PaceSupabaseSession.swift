import Foundation
import os

// Where PaceTasks' Supabase project lives, written into Info.plist at build time
// by plugins/withPaceSiri.js from EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY.
public struct PaceSupabaseConfig: Sendable {
  public let url: URL
  public let anonKey: String

  public static func fromInfoPlist(_ bundle: Bundle = .main) -> PaceSupabaseConfig? {
    guard
      let urlString = bundle.object(forInfoDictionaryKey: "PaceSupabaseURL") as? String,
      let url = URL(string: urlString),
      let anonKey = bundle.object(forInfoDictionaryKey: "PaceSupabaseAnonKey") as? String,
      !anonKey.isEmpty
    else { return nil }
    return PaceSupabaseConfig(url: url, anonKey: anonKey)
  }

  // The key supabase-js stores the session under: "sb-<project ref>-auth-token".
  public var storageKey: String {
    let projectRef = url.host?.split(separator: ".").first.map(String.init) ?? ""
    return "sb-\(projectRef)-auth-token"
  }
}

public enum PaceSessionError: Error {
  case noSession // the app was never opened, or the user signed out
  case refreshFailed(status: Int)
}

// Reads the session the app saved and refreshes it when it is about to expire,
// writing the new tokens back in supabase-js's own format so the app keeps working.
public struct PaceSupabaseSession: Sendable {
  private static let refreshMargin: TimeInterval = 60 // refresh a token this close to expiry
  private static let logger = Logger(subsystem: "com.pacetasks.app", category: "SupabaseSession")

  public let config: PaceSupabaseConfig

  public init(config: PaceSupabaseConfig) {
    self.config = config
  }

  public func validAccessToken() async throws -> String {
    guard
      let raw = PaceSessionKeychain.read(config.storageKey),
      let session = (try? JSONSerialization.jsonObject(with: Data(raw.utf8))) as? [String: Any],
      let accessToken = session["access_token"] as? String
    else { throw PaceSessionError.noSession }

    let expiresAt = (session["expires_at"] as? NSNumber)?.doubleValue ?? 0
    if expiresAt - Date().timeIntervalSince1970 > Self.refreshMargin { return accessToken }
    return try await refresh(session)
  }

  private func refresh(_ session: [String: Any]) async throws -> String {
    guard let refreshToken = session["refresh_token"] as? String else { throw PaceSessionError.noSession }

    var components = URLComponents(url: config.url.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)
    components?.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
    guard let url = components?.url else { throw PaceSessionError.noSession }

    var request = URLRequest(url: url, timeoutInterval: 10)
    request.httpMethod = "POST"
    request.setValue(config.anonKey, forHTTPHeaderField: "apikey")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])

    let (data, response) = try await URLSession.shared.data(for: request)
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard (200..<300).contains(status),
      let refreshed = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      let accessToken = refreshed["access_token"] as? String
    else {
      Self.logger.error("Session refresh failed with status \(status, privacy: .public)")
      throw PaceSessionError.refreshFailed(status: status)
    }

    // Keeps every other field supabase-js stored and replaces only what the refresh returned.
    var updated = session
    for key in ["access_token", "refresh_token", "expires_in", "expires_at", "token_type", "user"] {
      if let value = refreshed[key] { updated[key] = value }
    }
    if refreshed["expires_at"] == nil, let expiresIn = (refreshed["expires_in"] as? NSNumber)?.doubleValue {
      updated["expires_at"] = Int(Date().timeIntervalSince1970 + expiresIn)
    }
    if let json = String(data: try JSONSerialization.data(withJSONObject: updated), encoding: .utf8) {
      PaceSessionKeychain.write(config.storageKey, value: json)
    }
    Self.logger.info("Session refreshed for Siri")
    return accessToken
  }
}
