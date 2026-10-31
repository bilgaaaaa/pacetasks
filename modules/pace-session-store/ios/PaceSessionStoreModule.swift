import ExpoModulesCore

// The storage supabase-js uses on iPhone (see src/lib/sessionStorage.ts): the
// session goes to the Keychain, where PaceTasks' Siri intents can read it too.
// Failures reach JS as errors, never as "no session", so a locked Keychain can't sign the user out.
public class PaceSessionStoreModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PaceSessionStore")

    AsyncFunction("getItem") { (key: String) -> String? in
      do {
        return try PaceSessionKeychain.read(key)
      } catch {
        throw KeychainException(String(describing: error))
      }
    }

    AsyncFunction("setItem") { (key: String, value: String) in
      do {
        try PaceSessionKeychain.write(key, value: value)
      } catch {
        throw KeychainException(String(describing: error))
      }
    }

    AsyncFunction("removeItem") { (key: String) in
      do {
        try PaceSessionKeychain.delete(key)
      } catch {
        throw KeychainException(String(describing: error))
      }
    }
  }
}

final class KeychainException: GenericException<String>, @unchecked Sendable {
  override var reason: String {
    "The PaceTasks session Keychain item could not be used: \(param)"
  }
}
