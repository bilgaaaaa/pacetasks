import Foundation
import Security
import os

// The Keychain items holding PaceTasks' Supabase session. The app writes them
// through supabase-js (PaceSessionStoreModule) and Siri reads them, so both act
// as the same user. Kept on this device only and readable after the first unlock,
// so Siri can still add a task while the phone is locked.
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

  public static func read(_ key: String) -> String? {
    var request = query(key)
    request[kSecReturnData as String] = true
    request[kSecMatchLimit as String] = kSecMatchLimitOne

    var item: CFTypeRef?
    let status = SecItemCopyMatching(request as CFDictionary, &item)
    guard status == errSecSuccess, let data = item as? Data else {
      if status != errSecItemNotFound { logger.error("Keychain read failed: \(status, privacy: .public)") }
      return nil
    }
    return String(data: data, encoding: .utf8)
  }

  // Replaces the value when it exists, otherwise adds it; false when the Keychain refused.
  @discardableResult
  public static func write(_ key: String, value: String) -> Bool {
    let data = Data(value.utf8)
    let attributes: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    ]

    let updateStatus = SecItemUpdate(query(key) as CFDictionary, attributes as CFDictionary)
    if updateStatus == errSecSuccess { return true }
    if updateStatus != errSecItemNotFound {
      logger.error("Keychain update failed: \(updateStatus, privacy: .public)")
      return false
    }

    let addStatus = SecItemAdd(query(key).merging(attributes) { _, new in new } as CFDictionary, nil)
    if addStatus != errSecSuccess { logger.error("Keychain add failed: \(addStatus, privacy: .public)") }
    return addStatus == errSecSuccess
  }

  @discardableResult
  public static func delete(_ key: String) -> Bool {
    let status = SecItemDelete(query(key) as CFDictionary)
    return status == errSecSuccess || status == errSecItemNotFound
  }
}
