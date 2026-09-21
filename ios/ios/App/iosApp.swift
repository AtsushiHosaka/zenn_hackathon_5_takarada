import SwiftUI

@main
struct iosApp: App {
    /// 画面が見る状態は Environment 経由、サービスの注入は Factory (@Injected) に寄せる
    @State private var session = AuthSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
        }
    }
}
