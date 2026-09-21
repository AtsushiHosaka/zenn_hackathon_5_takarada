import FactoryKit
import Foundation
import Observation

/// ログイン状態を持つ唯一の場所。View はここだけ見ればよい。
/// - 通信は AuthRepository (Data 層の実装) に任せる
/// - トークンの保存/破棄は TokenStore (ApiClient が同じ場所から読む)
/// - 差し替えは App/Container+Registrations.swift の登録で行う
@Observable
final class AuthSession {
    enum State: Equatable {
        /// 起動直後。保存済みトークンを確かめている
        case loading
        case signedOut
        case signedIn(User)
    }

    private(set) var state: State

    var currentUser: User? {
        if case let .signedIn(user) = state { user } else { nil }
    }

    // 接続先 (ダミー / ローカル / 本番) を切り替えたらすぐ効くよう、毎回コンテナから引く
    @ObservationIgnored @DynamicInjected(\.authRepository) private var repository
    @ObservationIgnored @DynamicInjected(\.tokenStore) private var tokenStore

    init(state: State = .loading) {
        self.state = state
    }

    /// 起動時に 1 回。保存済みトークンが生きていればログイン状態に戻す。
    func restore() async {
        guard tokenStore.token != nil else {
            state = .signedOut
            return
        }

        do {
            state = .signedIn(try await repository.me())
        } catch DomainError.unauthorized {
            // 失効していた場合だけ捨てる。オフラインで消さないため他のエラーは残す
            tokenStore.clear()
            state = .signedOut
        } catch {
            state = .signedOut
        }
    }

    func signUp(name: String, email: String, password: String) async throws {
        try await authenticate {
            try await repository.signUp(name: name, email: email, password: password)
        }
    }

    func logIn(email: String, password: String) async throws {
        try await authenticate {
            try await repository.logIn(email: email, password: password)
        }
    }

    /// サーバー側の失効に失敗しても、端末からは必ずトークンを消す
    func logOut() async {
        try? await repository.logOut()
        tokenStore.clear()
        state = .signedOut
    }

    /// 自分のプロフィールを取り直す (他の画面で更新した後など)
    func refresh() async throws {
        state = .signedIn(try await repository.me())
    }

    private func authenticate(_ operation: () async throws -> AuthenticatedUser) async throws {
        let authenticated = try await operation()
        tokenStore.save(authenticated.token)
        state = .signedIn(authenticated.user)
    }
}
