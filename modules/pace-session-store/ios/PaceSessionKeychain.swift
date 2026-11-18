import Foundation
import Security
import os

// A Keychain call that failed for a reason other than "no item"; callers must not
// read it as "signed out", or the app would replace the user's session.
public struct PaceKeychainError: Error, CustomStringConvertible {
  public let status: OSStatus
  public var description: String { "Keychain error \(status)" }
}

// The Keychain items holding PaceTasks' Supabase session. The app writes them
// through supabase-js (PaceSessionStoreModule) and Siri reads them, so both act
// as the same user. Readable after the first unlock, so Siri can add a task on a
// locked phone, and included in backups, so a new iPhone keeps the same user.
public enum PaceSessionKeychain {
  public static let service = "com.pacetasks.app.session"

  private static let logger = Logger(subsystem: "com.pacetasks.app", category: "SessionKeychain")

  private static func query(_ key: String) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: key,
    ]
  }

  // nil only when nothing is stored; any other failure throws.
  public static func read(_ key: String) throws -> String? {
    var request = query(key)
    request[kSecReturnData as String] = true
    request[kSecMatchLimit as String] = kSecMatchLimitOne

    var item: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &item)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = item as? Data else {
      logger.error("Keychain read failed: \(status, privacy: .public)")
      throw PaceKeychainError(status: status)
    }
    return String(data: data, encoding: .utf8)
  }

  // Replaces the value when it exists, otherwise adds it.
  public static func write(_ key: String, value: String) throws {
    let attributes: [String: Any] = [
      kSecValueData as String: Data(value.utf8),
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
    ]

    let updateStatus = SecItemUpdate(query(key) as CFDictionary, attributes as CFDictionary)
    if updateStatus == errSecSuccess { return }
    guard updateStatus == errSecItemNotFound else {
      logger.error("Keychain update failed: \(updateStatus, privacy: .public)")
      throw PaceKeychainError(status: updateStatus)
    }

    let addStatus = SecItemAdd(query(key).merging(attributes) { _, new in new } as CFDictionary, nil)
    guard addStatus == errSecSuccess else {
      logger.error("Keychain add failed: \(addStatus, privacy: .public)")
      throw PaceKeychainError(status: addStatus)
    }
  }

  // Succeeds when the item is gone afterwards, including when it never existed.
  public static func delete(_ key: String) throws {
    let status = SecItemDelete(query(key) as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      logger.error("Keychain delete failed: \(status, privacy: .public)")
      throw PaceKeychainError(status: status)
    }
  }
}
