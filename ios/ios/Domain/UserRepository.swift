import Foundation

/// ユーザー CRUD。実装は Data/Repositories/ApiUserRepository。
nonisolated protocol UserRepository: Sendable {
    /// GET /api/v1/users
    func list() async throws -> [User]
    /// GET /api/v1/users/:id
    func find(id: Int) async throws -> User
    /// PATCH /api/v1/users/:id
    func update(id: Int, name: String) async throws -> User
    /// DELETE /api/v1/users/:id
    func delete(id: Int) async throws
}
