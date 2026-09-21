import Foundation

/// 叩く API を 1 つ表す値。ApiClient がこれを URLRequest に組み立てる。
nonisolated struct Endpoint {
    enum Method: String {
        case get = "GET"
        case post = "POST"
        case patch = "PATCH"
        case delete = "DELETE"
    }

    var method: Method = .get
    /// "api/v1/users" のように先頭スラッシュ無しで書く
    var path: String
    var query: [URLQueryItem] = []
    /// JSON ボディ (Data/Records/Requests.swift のリクエスト型を渡す)
    var body: (any Encodable)?
    /// false にすると Authorization ヘッダを付けない (signup / login)
    var requiresAuth: Bool = true
}
