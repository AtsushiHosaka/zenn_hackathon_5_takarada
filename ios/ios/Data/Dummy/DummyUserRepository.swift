import Foundation

/// 通信しない UserRepository。中身は DummyDatabase。
nonisolated struct DummyUserRepository: UserRepository {
    func list() async throws -> [User] {
        await DummyDatabase.shared.list()
    }

    func find(id: Int) async throws -> User {
        try await DummyDatabase.shared.find(id: id)
    }

    func update(id: Int, name: String) async throws -> User {
        try await DummyDatabase.shared.update(id: id, name: name)
    }

    func delete(id: Int) async throws {
        try await DummyDatabase.shared.delete(id: id)
    }
}
