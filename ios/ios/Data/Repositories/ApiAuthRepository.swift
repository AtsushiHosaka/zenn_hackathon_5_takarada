import Foundation

nonisolated struct ApiAuthRepository: AuthRepository {
    private let api: ApiClient

    init(api: ApiClient) {
        self.api = api
    }

    func signUp(name: String, email: String, password: String) async throws -> AuthenticatedUser {
        let result: (body: UserRecord, token: String) = try await api.sendReceivingToken(
            Endpoint(
                method: .post,
                path: "api/v1/signup",
                body: SignupRequest(user: .init(name: name, email: email, password: password)),
                requiresAuth: false
            )
        )
        return AuthenticatedUser(user: result.body.user, token: result.token)
    }

    func logIn(email: String, password: String) async throws -> AuthenticatedUser {
        let result: (body: UserRecord, token: String) = try await api.sendReceivingToken(
            Endpoint(
                method: .post,
                path: "api/v1/login",
                body: LoginRequest(identity: .init(email: email, password: password)),
                requiresAuth: false
            )
        )
        return AuthenticatedUser(user: result.body.user, token: result.token)
    }

    func logOut() async throws {
        try await api.send(Endpoint(method: .delete, path: "api/v1/logout"))
    }

    func me() async throws -> User {
        let record: UserRecord = try await api.send(Endpoint(path: "api/v1/me"))
        return record.user
    }
}
