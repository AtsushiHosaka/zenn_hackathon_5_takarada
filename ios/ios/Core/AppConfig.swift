import Foundation

/// 実行時の設定は Info.plist から読む。
/// Info.plist は gitignore してあるので、clone したら `make ios-setup` で
/// Info.plist.example をコピーして値を書き換える。
nonisolated enum AppConfig {
    /// Info.plist の文字列。未設定 (空) なら nil
    static func string(forKey key: String) -> String? {
        let raw = (Bundle.main.object(forInfoDictionaryKey: key) as? String ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return raw.isEmpty ? nil : raw
    }

    /// Info.plist の URL。スキーム付きで書かれていなければ nil
    static func url(forKey key: String) -> URL? {
        guard let raw = string(forKey: key), let url = URL(string: raw), url.scheme != nil else {
            return nil
        }
        return url
    }
}
