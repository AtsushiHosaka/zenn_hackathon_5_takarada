import FactoryKit
import Foundation

/// DI の登録はここだけ。実体を差し替えたいときも触るのはこのファイル。
/// 解決は `@Injected(\.userRepository)` / `@DynamicInjected(\.userRepository)` か
/// `Container.shared.userRepository()`。
///
/// - 接続先が `.dummy` のときは通信しない実装 (Data/Dummy) に差し替わる
/// - `.onPreview` を付けた分は SwiftUI プレビューでも同じダミー実装になる
///   (プレビュー側で登録し直す必要は無い)
extension Container {
    /// 選択中の接続先。切り替えは `Container.shared.use(.prod)`
    var appEnvironment: Factory<AppEnvironment> {
        self { AppEnvironment.selected }
    }

    /// JWT の置き場。接続先ごとに別のトークンを持つ
    var tokenStore: Factory<any TokenStore> {
        self { KeychainTokenStore(account: "jwt.\(self.appEnvironment().rawValue)") }
    }

    /// backend を叩く口。ベース URL とトークンはリクエスト時に読むので、
    /// 接続先を切り替えても作り直さずに追従する
    var apiClient: Factory<ApiClient> {
        self {
            ApiClient(
                baseURL: { AppEnvironment.endpoint },
                token: { self.tokenStore().token }
            )
        }
    }

    var authRepository: Factory<any AuthRepository> {
        self {
            self.appEnvironment().isDummy
                ? DummyAuthRepository() as any AuthRepository
                : ApiAuthRepository(api: self.apiClient())
        }
        .onPreview { DummyAuthRepository() }
    }

    var userRepository: Factory<any UserRepository> {
        self {
            self.appEnvironment().isDummy
                ? DummyUserRepository() as any UserRepository
                : ApiUserRepository(api: self.apiClient())
        }
        .onPreview { DummyUserRepository() }
    }

    /// 接続先を切り替える。以降の解決からこの環境の実装・URL・トークンになる
    /// (`AuthSession` は `@DynamicInjected` で毎回引き直すので作り直さなくてよい)
    func use(_ environment: AppEnvironment) {
        AppEnvironment.selected = environment
    }
}
