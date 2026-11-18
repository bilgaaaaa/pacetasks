import SwiftUI

/// The PaceTasks section of Settings and the welcome guide: sign in with an emailed code, or sign out.
struct PaceTasksAccountSection: View {
    @Environment(AppModel.self) private var model
    @State private var email = ""
    @State private var code = ""
    @State private var codeSentTo: String?
    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        Section {
            if !PaceTasksConfig.isConfigured {
                LabeledContent("PaceTasks account") {
                    Text("Not available in this build")
                        .foregroundStyle(.secondary)
                }
            } else if model.paceAuth.isSignedIn {
                LabeledContent("Signed in", value: model.paceAuth.email ?? "PaceTasks")
                Button("Sign Out", role: .destructive) {
                    Task { await model.signOutOfPaceTasks() }
                }
            } else if let sentTo = codeSentTo {
                TextField("Code from the email to \(sentTo)", text: $code)
                    .textContentType(.oneTimeCode)
                    .onSubmit(verify)
                HStack {
                    Button("Use Another Email") {
                        codeSentTo = nil
                        code = ""
                        errorMessage = nil
                    }
                    Spacer()
                    Button(isWorking ? String(localized: "Signing In…") : String(localized: "Sign In"), action: verify)
                        .keyboardShortcut(.defaultAction)
                        .disabled(isWorking || !Self.isCompleteCode(code))
                }
            } else {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .onSubmit(sendCode)
                Button(isWorking ? String(localized: "Sending…") : String(localized: "Email Me a Code"), action: sendCode)
                    .disabled(isWorking || !email.contains("@"))
            }
            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        } header: {
            Text("PaceTasks")
        } footer: {
            if !model.paceAuth.isSignedIn {
                Text("Use the same account as PaceTasks on your iPhone, and your tasks show up here and in the DeskFocus widget.")
            }
        }
    }

    private func sendCode() {
        guard !isWorking, email.contains("@") else { return }
        run {
            try await model.paceAuth.sendCode(to: email)
            codeSentTo = email.trimmingCharacters(in: .whitespacesAndNewlines)
        }
    }

    private func verify() {
        guard !isWorking, let sentTo = codeSentTo, Self.isCompleteCode(code) else { return }
        run {
            try await model.signInToPaceTasks(email: sentTo, code: code)
            codeSentTo = nil
            code = ""
        }
    }

    private func run(_ action: @escaping () async throws -> Void) {
        isWorking = true
        errorMessage = nil
        Task {
            do {
                try await action()
            } catch {
                errorMessage = error.localizedDescription
            }
            isWorking = false
        }
    }

    /// Same rule as `isCompleteCode` in supabase/functions/_shared/domain/account.ts: 6 to 10 digits.
    private static func isCompleteCode(_ code: String) -> Bool {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        return (6...10).contains(trimmed.count) && trimmed.allSatisfy(\.isASCIIDigit)
    }
}

private extension Character {
    var isASCIIDigit: Bool { isASCII && isNumber }
}
