import Foundation

nonisolated struct ApiUserRepository: UserRepository {
    private let api: ApiClient

    init(api: ApiClient) {
        self.api = api
    }

    func list() async throws -> [User] {
        let records: [UserRecord] = try await api.send(Endpoint(path: "api/v1/users"))
        return records.map(\.user)
    }

    func find(id: Int) async throws -> User {
        let record: UserRecord = try await api.send(Endpoint(path: "api/v1/users/\(id)"))
        return record.user
    }

    func update(id: Int, name: String) async throws -> User {
        let record: UserRecord = try await api.send(
            Endpoint(
                method: .patch,
                path: "api/v1/users/\(id)",
                body: UpdateUserRequest(user: .init(name: name))
            )
        )
        return record.user
    }

    func delete(id: Int) async throws {
        try await api.send(Endpoint(method: .delete, path: "api/v1/users/\(id)"))
    }
}
