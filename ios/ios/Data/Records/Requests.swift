import Foundation

/// POST /api/v1/signup  … params.require(:user).permit(:name, :email, :password)
nonisolated struct SignupRequest: Encodable {
    struct User: Encodable {
        let name: String
        let email: String
        let password: String
    }

    let user: User
}

/// POST /api/v1/login  … params.require(:identity).permit(:email, :password)
nonisolated struct LoginRequest: Encodable {
    struct Identity: Encodable {
        let email: String
        let password: String
    }

    let identity: Identity
}

/// PATCH /api/v1/users/:id  … params.require(:user).permit(:name)
nonisolated struct UpdateUserRequest: Encodable {
    struct User: Encodable {
        let name: String
    }

    let user: User
}
