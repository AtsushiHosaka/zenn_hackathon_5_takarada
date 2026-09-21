import Foundation

/// backend (Rails API) を叩く唯一の口。
/// - ベース URL と トークンはクロージャで毎リクエスト読む。
///   接続先 (local / prod) を切り替えても、作り直さずそのまま追従する
/// - 認証は Authorization: Bearer <JWT> (Core/KeychainTokenStore から)
/// - 失敗は全部 DomainError に畳んでから投げる
nonisolated struct ApiClient: Sendable {
    private let baseURL: @Sendable () -> URL
    private let session: URLSession
    private let token: @Sendable () -> String?

    init(
        baseURL: @escaping @Sendable () -> URL,
        session: URLSession = .shared,
        token: @escaping @Sendable () -> String?
    ) {
        self.baseURL = baseURL
        self.session = session
        self.token = token
    }

    /// JSON を 1 つデコードして返す
    func send<Body: Decodable>(_ endpoint: Endpoint, as type: Body.Type = Body.self) async throws -> Body {
        let (data, _) = try await perform(endpoint)
        return try decode(data)
    }

    /// ボディを見ない (204 No Content など)
    func send(_ endpoint: Endpoint) async throws {
        _ = try await perform(endpoint)
    }

    /// レスポンスヘッダの `Authorization: Bearer <JWT>` も受け取る (signup / login)
    func sendReceivingToken<Body: Decodable>(
        _ endpoint: Endpoint,
        as type: Body.Type = Body.self
    ) async throws -> (body: Body, token: String) {
        let (data, response) = try await perform(endpoint)
        let header = response.value(forHTTPHeaderField: "Authorization") ?? ""
        let token = header.hasPrefix("Bearer ") ? String(header.dropFirst("Bearer ".count)) : header

        guard !token.isEmpty else {
            throw DomainError.server(status: response.statusCode, message: "トークンが返ってきませんでした")
        }
        return (try decode(data), token)
    }

    // MARK: - 実行

    private func perform(_ endpoint: Endpoint) async throws -> (Data, HTTPURLResponse) {
        let request = try makeRequest(endpoint)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw DomainError.network(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw DomainError.server(status: 0, message: nil)
        }
        guard (200..<300).contains(http.statusCode) else {
            throw domainError(status: http.statusCode, body: data)
        }
        return (data, http)
    }

    private func makeRequest(_ endpoint: Endpoint) throws -> URLRequest {
        let url = baseURL().appending(path: endpoint.path)
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw DomainError.server(status: 0, message: "URL を組み立てられませんでした: \(url)")
        }
        if !endpoint.query.isEmpty {
            components.queryItems = endpoint.query
        }
        guard let resolved = components.url else {
            throw DomainError.server(status: 0, message: "URL を組み立てられませんでした: \(url)")
        }

        var request = URLRequest(url: resolved)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body = endpoint.body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            do {
                request.httpBody = try Self.encoder.encode(body)
            } catch {
                throw DomainError.decoding(error)
            }
        }
        if endpoint.requiresAuth, let token = token() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    // MARK: - JSON

    private func decode<Body: Decodable>(_ data: Data) throws -> Body {
        // 204 などボディが無いレスポンスを EmptyBody で受けたいとき用
        if data.isEmpty, let empty = EmptyBody() as? Body { return empty }
        do {
            return try Self.decoder.decode(Body.self, from: data)
        } catch {
            throw DomainError.decoding(error)
        }
    }

    /// Rails が返すエラーは `{"error": "..."}` か `{"errors": ["...", ...]}`
    private func domainError(status: Int, body: Data) -> DomainError {
        let payload = try? Self.decoder.decode(ErrorBody.self, from: body)
        let message = payload?.error

        switch status {
        case 401: return .unauthorized(message)
        case 404: return .notFound(message)
        case 422: return .validation(payload?.errors ?? [message].compactMap(\.self))
        default: return .server(status: status, message: message)
        }
    }

    private struct ErrorBody: Decodable {
        var error: String?
        var errors: [String]?
    }

    /// created_at などの snake_case と iso8601 をここで吸収する
    private static var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            let withFraction = ISO8601DateFormatter()
            withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = withFraction.date(from: raw) ?? ISO8601DateFormatter().date(from: raw) {
                return date
            }
            throw DecodingError.dataCorrupted(
                .init(codingPath: decoder.codingPath, debugDescription: "日付として読めない: \(raw)")
            )
        }
        return decoder
    }

    private static var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

/// ボディの無いレスポンスを型で受けたいときのプレースホルダ
nonisolated struct EmptyBody: Codable {}
