import Foundation

/// iOS だけで完結するダミーの保存先 (メモリ上)。
/// 接続先を「ダミー」にすると Repository がこれを見る実装に差し替わる
/// (App/Container+Registrations.swift)。backend が無くてもアプリを一通り触れる。
///
/// - パスワードは検証しない。**登録済みのメールアドレスなら誰でもログインできる**
/// - アプリを再起動すると DummyData.users の状態に戻る
@MainActor
final class DummyDatabase {
    static let shared = DummyDatabase()

    private var users: [User]
    private var nextID: Int
    private var signedInUserID: Int?

    init(users: [User] = DummyData.users) {
        self.users = users
        self.nextID = (users.map(\.id).max() ?? 0) + 1
    }

    // MARK: - 認証

    func signUp(name: String, email: String) throws -> User {
        guard !name.isEmpty else { throw DomainError.validation(["名前を入力してください"]) }
        guard !users.contains(where: { $0.email == email }) else {
            throw DomainError.validation(["メールアドレスはすでに使われています"])
        }

        let user = User(id: nextID, name: name, email: email, createdAt: .now, updatedAt: .now)
        nextID += 1
        users.append(user)
        signedInUserID = user.id
        return user
    }

    func logIn(email: String) throws -> User {
        guard let user = users.first(where: { $0.email == email }) else {
            throw DomainError.unauthorized("メールアドレスまたはパスワードが違います")
        }
        signedInUserID = user.id
        return user
    }

    func logOut() {
        signedInUserID = nil
    }

    func me() throws -> User {
        guard let id = signedInUserID, let user = users.first(where: { $0.id == id }) else {
            throw DomainError.unauthorized(nil)
        }
        return user
    }

    // MARK: - ユーザー

    func list() -> [User] {
        users
    }

    func find(id: Int) throws -> User {
        guard let user = users.first(where: { $0.id == id }) else { throw DomainError.notFound(nil) }
        return user
    }

    func update(id: Int, name: String) throws -> User {
        guard !name.isEmpty else { throw DomainError.validation(["名前を入力してください"]) }
        guard let index = users.firstIndex(where: { $0.id == id }) else { throw DomainError.notFound(nil) }

        users[index].name = name
        users[index].updatedAt = .now
        return users[index]
    }

    func delete(id: Int) throws {
        guard let index = users.firstIndex(where: { $0.id == id }) else { throw DomainError.notFound(nil) }
        users.remove(at: index)
        if signedInUserID == id { signedInUserID = nil }
    }
}
