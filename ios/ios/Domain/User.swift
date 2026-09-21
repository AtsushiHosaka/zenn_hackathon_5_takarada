import Foundation

/// アプリが扱うユーザー。API の形 (Data/Records/UserRecord) とは分けてある。
nonisolated struct User: Identifiable, Hashable, Sendable {
    let id: Int
    var name: String
    var email: String
    var createdAt: Date
    var updatedAt: Date
}
