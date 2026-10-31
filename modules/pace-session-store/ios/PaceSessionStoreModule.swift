import ExpoModulesCore

// The storage supabase-js uses on iPhone (see src/lib/sessionStorage.ts): the
// session goes to the Keychain, where PaceTasks' Siri intents can read it too.
public class PaceSessionStoreModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PaceSessionStore")

    AsyncFunction("getItem") { (key: String) -> String? in
      PaceSessionKeychain.read(key)
    }

    AsyncFunction("setItem") { (key: String, value: String) in
      guard PaceSessionKeychain.write(key, value: value) else { throw KeychainWriteException() }
    }

    AsyncFunction("removeItem") { (key: String) in
      _ = PaceSessionKeychain.delete(key)
    }
  }
}

final class KeychainWriteException: Exception, @unchecked Sendable {
  override var reason: String {
    "The session could not be saved to the Keychain"
  }
}
