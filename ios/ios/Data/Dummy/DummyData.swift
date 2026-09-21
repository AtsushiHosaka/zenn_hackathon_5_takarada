import Foundation

/// ダミーモードと SwiftUI プレビューで使う初期データ。好きに書き換える。
nonisolated enum DummyData {
    static let users: [User] = [
        User(id: 1, name: "山田 太郎", email: "taro@example.com", createdAt: .now, updatedAt: .now),
        User(id: 2, name: "鈴木 花子", email: "hanako@example.com", createdAt: .now, updatedAt: .now),
        User(id: 3, name: "佐藤 次郎", email: "jiro@example.com", createdAt: .now, updatedAt: .now)
    ]
}

extension User {
    /// プレビュー用の 1 件
    static var preview: User { DummyData.users[0] }
}
