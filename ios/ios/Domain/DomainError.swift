import Foundation

/// アプリ全体で扱うエラー。Data 層が通信・HTTP の失敗をここに畳んでから投げる。
/// UI は `error.localizedDescription` をそのまま出せばよい。
nonisolated enum DomainError: LocalizedError {
    /// 401。トークンが無い / 失効している
    case unauthorized(String?)
    /// 404
    case notFound(String?)
    /// 422。サーバーが返した errors をそのまま持つ
    case validation([String])
    /// その他の 4xx / 5xx
    case server(status: Int, message: String?)
    /// 通信そのものが失敗した (オフラインなど)
    case network(any Error)
    /// レスポンスが期待した形ではなかった
    case decoding(any Error)

    var errorDescription: String? {
        switch self {
        case let .unauthorized(message):
            message ?? "ログインが必要です"
        case let .notFound(message):
            message ?? "見つかりませんでした"
        case let .validation(messages):
            messages.isEmpty ? "入力内容を確認してください" : messages.joined(separator: "\n")
        case let .server(status, message):
            message ?? "サーバーエラー (\(status))"
        case .network:
            "通信に失敗しました。接続を確認してください"
        case .decoding:
            "レスポンスの解析に失敗しました"
        }
    }
}
