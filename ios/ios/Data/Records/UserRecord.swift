import Foundation

/// API が返す user オブジェクト (backend の ApplicationController#serialize_user)。
/// レスポンスの形を Domain に持ち込まないための受け皿。
nonisolated struct UserRecord: Decodable {
    let id: Int
    let name: String
    let email: String
    let createdAt: Date
    let updatedAt: Date

    /// Domain のエンティティに移す
    var user: User {
        User(id: id, name: name, email: email, createdAt: createdAt, updatedAt: updatedAt)
    }
}
