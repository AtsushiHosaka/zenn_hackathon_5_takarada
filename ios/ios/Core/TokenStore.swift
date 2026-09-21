import Foundation
import Security

/// JWT の置き場。ApiClient は毎リクエストここから読み、AuthSession が書き換える。
nonisolated protocol TokenStore: Sendable {
    var token: String? { get }
    func save(_ token: String)
    func clear()
}

/// Keychain に 1 件だけ持つ実装。アプリを消すまで残る。
nonisolated struct KeychainTokenStore: TokenStore {
    private let service: String
    private let account: String

    init(service: String = Bundle.main.bundleIdentifier ?? "app", account: String = "jwt") {
        self.service = service
        self.account = account
    }

    var token: String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func save(_ token: String) {
        SecItemDelete(baseQuery as CFDictionary)

        var query = baseQuery
        query[kSecValueData as String] = Data(token.utf8)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(query as CFDictionary, nil)
    }

    func clear() {
        SecItemDelete(baseQuery as CFDictionary)
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
