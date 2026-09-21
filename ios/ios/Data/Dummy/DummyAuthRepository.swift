import Foundation

/// 通信しない AuthRepository。中身は DummyDatabase。
nonisolated struct DummyAuthRepository: AuthRepository {
    /// ダミーなので中身は何でもよいが、本物と同じく「トークンを受け取って保存する」形に揃える
    private let token = "dummy-token"

    func signUp(name: String, email: String, password: String) async throws -> AuthenticatedUser {
        let user = try await DummyDatabase.shared.signUp(name: name, email: email)
        return AuthenticatedUser(user: user, token: token)
    }

    func logIn(email: String, password: String) async throws -> AuthenticatedUser {
        let user = try await DummyDatabase.shared.logIn(email: email)
        return AuthenticatedUser(user: user, token: token)
    }

    func logOut() async throws {
        await DummyDatabase.shared.logOut()
    }

    func me() async throws -> User {
        try await DummyDatabase.shared.me()
    }
}
