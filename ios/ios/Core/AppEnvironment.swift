import Foundation

/// 叩き先。アプリ内 (ログイン画面の「接続先」) で切り替えられる。
/// 切り替えはコンテナ経由: `Container.shared.use(.prod)`。
nonisolated enum AppEnvironment: String, CaseIterable, Identifiable, Sendable {
    /// 端末内のダミーデータ。backend が無くても動く (Data/Dummy)
    case dummy
    /// 実際の API を叩く。URL は Info.plist の API_ENDPOINT
    /// (手元の `make up` なら http://localhost:3000、デプロイ済みなら `make infra-url` の値)
    case prod

    var id: Self { self }

    var label: String {
        switch self {
        case .dummy: "ダミー"
        case .prod: "API"
        }
    }

    /// 通信しない環境か (Repository がダミー実装に差し替わる)
    var isDummy: Bool { self == .dummy }

    /// Info.plist に URL が書かれていれば返す (ダミーは通信しないので nil)
    var configuredEndpoint: URL? {
        isDummy ? nil : AppConfig.url(forKey: "API_ENDPOINT")
    }

    /// 切り替え先として選べる環境 (ダミー + Info.plist に URL がある分)
    static var available: [AppEnvironment] {
        allCases.filter { $0.isDummy || $0.configuredEndpoint != nil }
    }

    /// 既定は Debug ビルドならダミー (backend を立てなくても動く)、Release なら API
    static var fallback: AppEnvironment {
        #if DEBUG
        .dummy
        #else
        .prod
        #endif
    }

    // MARK: - 選択の保存

    private static let storageKey = "selected_app_environment"

    /// 選択中の環境。次の起動にも残る
    static var selected: AppEnvironment {
        get {
            let stored = UserDefaults.standard.string(forKey: storageKey).flatMap(AppEnvironment.init(rawValue:))
            return stored ?? fallback
        }
        set {
            UserDefaults.standard.set(newValue.rawValue, forKey: storageKey)
        }
    }

    /// API のベース URL (ダミーのときは通信しないので使われない)
    static var endpoint: URL {
        guard let url = AppEnvironment.prod.configuredEndpoint else {
            fatalError("Info.plist の API_ENDPOINT が空。`make ios-setup` して値を設定する。")
        }
        return url
    }
}
