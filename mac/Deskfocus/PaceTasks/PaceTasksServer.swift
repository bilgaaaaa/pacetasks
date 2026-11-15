import Foundation

/// Where the PaceTasks server (Supabase) lives, read from Info.plist, which Config/Secrets.xcconfig fills at build time.
enum PaceTasksConfig {
    /// Host such as "abc.supabase.co"; xcconfig files can't hold "//", so the scheme is added here.
    static var baseURL: URL? {
        guard let host = infoValue("PaceSupabaseHost") else { return nil }
        return URL(string: "https://\(host)")
    }

    /// The project's public (anon) key, the same one the iPhone app ships with.
    static var anonKey: String? { infoValue("PaceSupabaseAnonKey") }

    static var isConfigured: Bool { baseURL != nil && anonKey != nil }

    private static func infoValue(_ key: String) -> String? {
        let value = (Bundle.main.object(forInfoDictionaryKey: key) as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return value?.isEmpty == false ? value : nil
    }
}

/// Requests to PaceTasks' Supabase Auth and REST APIs; failures carry the server's error code and message.
enum PaceTasksServer {
    enum ServerError: LocalizedError {
        case notConfigured
        case server(status: Int, code: String?, message: String)

        var errorDescription: String? {
            switch self {
            case .notConfigured: return String(localized: "This build can't reach PaceTasks. Add the server address to Config/Secrets.xcconfig.")
            case .server(_, _, let message): return message
            }
        }

        /// Supabase's error code, e.g. "otp_expired"; nil for other failures.
        var code: String? {
            if case .server(_, let code, _) = self { return code }
            return nil
        }

        /// HTTP status of a server failure, 0 otherwise.
        var status: Int {
            if case .server(let status, _, _) = self { return status }
            return 0
        }
    }

    /// Sends one request and returns the body; `accessToken` signs it as the user, otherwise it goes as the app.
    static func send(
        _ method: String,
        path: String,
        query: [URLQueryItem] = [],
        json: Any? = nil,
        accessToken: String? = nil,
        headers: [String: String] = [:]
    ) async throws -> Data {
        guard let baseURL = PaceTasksConfig.baseURL, let anonKey = PaceTasksConfig.anonKey,
              var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false) else {
            throw ServerError.notConfigured
        }
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw ServerError.notConfigured }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken ?? anonKey)", forHTTPHeaderField: "Authorization")
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        if let json {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: json)
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let failure = serverError(status: status, body: data)
            Log.paceTasks.error("\(method, privacy: .public) \(path, privacy: .public) failed: HTTP \(status) \(failure.code ?? "", privacy: .public)")
            throw failure
        }
        return data
    }

    /// Auth answers {"error_code", "msg"}, REST answers {"code", "message"}; either way keep the code and a readable message.
    private static func serverError(status: Int, body: Data) -> ServerError {
        let object = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any] ?? [:]
        let code = (object["error_code"] ?? object["code"] ?? object["error"]).map { "\($0)" }
        let message = (object["msg"] ?? object["message"] ?? object["error_description"]) as? String
        return .server(status: status, code: code, message: message ?? String(localized: "PaceTasks didn't answer (error \(status)). Please try again."))
    }
}
