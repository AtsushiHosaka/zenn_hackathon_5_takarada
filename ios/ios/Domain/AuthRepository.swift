import Foundation

/// 認証済みユーザーと、以降のリクエストに載せる JWT。
nonisolated struct AuthenticatedUser: Sendable {
    let user: User
    let token: String
}

/// 認証まわりの入り口。実装は Data/Repositories/ApiAuthRepository。
nonisolated protocol AuthRepository: Sendable {
    /// POST /api/v1/signup
    func signUp(name: String, email: String, password: String) async throws -> AuthenticatedUser
    /// POST /api/v1/login
    func logIn(email: String, password: String) async throws -> AuthenticatedUser
    /// DELETE /api/v1/logout (トークンを失効させる)
    func logOut() async throws
    /// GET /api/v1/me (保存済みトークンの持ち主)
    func me() async throws -> User
}
