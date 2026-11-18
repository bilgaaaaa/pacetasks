import Foundation
import Observation

/// Sign-in with the PaceTasks account: a code emailed by Supabase, then a session kept in the Keychain and refreshed when needed.
@MainActor
@Observable
final class PaceTasksAuthService {
    enum AuthError: LocalizedError {
        case notSignedIn
        case noAccount
        case wrongCode
        case tooManyRequests

        var errorDescription: String? {
            switch self {
            case .notSignedIn: return String(localized: "Sign in with your PaceTasks account first.")
            case .noAccount: return String(localized: "No PaceTasks account uses this email. Create one in PaceTasks on your iPhone first.")
            case .wrongCode: return String(localized: "That code is wrong or has expired. Check the newest email, or send a new code.")
            case .tooManyRequests: return String(localized: "Too many codes were asked for. Wait a minute and try again.")
            }
        }
    }

    /// The tokens Supabase returns, plus who they belong to.
    private struct Session: Codable {
        var accessToken: String
        var refreshToken: String
        var expiresAt: Date
        var userId: String
        var email: String?
    }

    /// Supabase's session answer to a verified code or a refresh.
    private struct SessionResponse: Decodable {
        struct User: Decodable {
            let id: String
            let email: String?
        }

        let accessToken: String
        let refreshToken: String
        let expiresIn: Double
        let user: User
    }

    private static let keychainAccount = "pacetasks-session"
    /// Refreshes this long before the access token expires, so a request never goes out with a dying token.
    private static let refreshMargin: TimeInterval = 60

    private(set) var isSignedIn = false
    private(set) var email: String?
    /// The PaceTasks user id, which is also the RevenueCat app user id.
    private(set) var userId: String?

    private var session: Session?
    private var refreshTask: Task<String, Error>?

    init() {
        if let data = KeychainStore.load(account: Self.keychainAccount),
           let saved = try? JSONDecoder().decode(Session.self, from: data) {
            apply(saved)
            Log.paceTasks.info("Restored PaceTasks session")
        }
    }

    // MARK: Sign in / out

    /// Emails a one-time code; only existing accounts get one, new accounts are made in the iPhone app.
    func sendCode(to email: String) async throws {
        do {
            _ = try await PaceTasksServer.send("POST", path: "auth/v1/otp", json: [
                "email": Self.normalized(email),
                "create_user": false
            ])
            Log.paceTasks.info("Sign-in code sent")
        } catch let error as PaceTasksServer.ServerError {
            throw Self.friendly(error)
        }
    }

    /// Exchanges the emailed code for a session.
    func verify(email: String, code: String) async throws {
        do {
            let data = try await PaceTasksServer.send("POST", path: "auth/v1/verify", json: [
                "type": "email",
                "email": Self.normalized(email),
                "token": code.trimmingCharacters(in: .whitespacesAndNewlines)
            ])
            try persist(Self.session(from: data))
            Log.paceTasks.info("Signed in to PaceTasks")
        } catch let error as PaceTasksServer.ServerError {
            throw Self.friendly(error)
        }
    }

    /// Signs out on this Mac; telling the server is best effort.
    func signOut() async {
        let token = session?.accessToken
        clearSession()
        Log.paceTasks.info("Signed out of PaceTasks")
        if let token {
            _ = try? await PaceTasksServer.send("POST", path: "auth/v1/logout", accessToken: token)
        }
    }

    // MARK: Tokens

    /// A token for the next request, refreshed first when it is about to expire; concurrent callers share one refresh.
    func validAccessToken() async throws -> String {
        guard let session else { throw AuthError.notSignedIn }
        if session.expiresAt.timeIntervalSinceNow > Self.refreshMargin { return session.accessToken }
        if let refreshTask { return try await refreshTask.value }

        let task = Task { try await refresh(using: session.refreshToken) }
        refreshTask = task
        defer { refreshTask = nil }
        return try await task.value
    }

    private func refresh(using refreshToken: String) async throws -> String {
        do {
            let data = try await PaceTasksServer.send("POST", path: "auth/v1/token", query: [URLQueryItem(name: "grant_type", value: "refresh_token")], json: [
                "refresh_token": refreshToken
            ])
            let renewed = try Self.session(from: data)
            try persist(renewed)
            Log.paceTasks.debug("PaceTasks session refreshed")
            return renewed.accessToken
        } catch let error as PaceTasksServer.ServerError where (400..<500).contains(error.status) {
            // The refresh token was revoked or already used elsewhere: the user has to sign in again.
            Log.paceTasks.error("PaceTasks session ended, signing out")
            clearSession()
            throw AuthError.notSignedIn
        }
    }

    // MARK: Storage

    private static func session(from data: Data) throws -> Session {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let response = try decoder.decode(SessionResponse.self, from: data)
        return Session(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt: Date().addingTimeInterval(response.expiresIn),
            userId: response.user.id,
            email: response.user.email
        )
    }

    private func persist(_ newSession: Session) throws {
        try KeychainStore.save(try JSONEncoder().encode(newSession), account: Self.keychainAccount)
        apply(newSession)
    }

    private func apply(_ newSession: Session) {
        session = newSession
        isSignedIn = true
        email = newSession.email
        userId = newSession.userId
    }

    private func clearSession() {
        KeychainStore.delete(account: Self.keychainAccount)
        session = nil
        isSignedIn = false
        email = nil
        userId = nil
    }

    // MARK: Helpers

    /// Same rule as `normalizeEmail` in supabase/functions/_shared/domain/account.ts.
    private static func normalized(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// Supabase's codes for the cases a person can act on; anything else keeps the server's message.
    private static func friendly(_ error: PaceTasksServer.ServerError) -> Error {
        switch error.code {
        case "otp_disabled", "signup_disabled", "user_not_found": return AuthError.noAccount
        case "otp_expired", "invalid_credentials": return AuthError.wrongCode
        case "over_email_send_rate_limit", "over_request_rate_limit": return AuthError.tooManyRequests
        default: return error.status == 429 ? AuthError.tooManyRequests : error
        }
    }
}
