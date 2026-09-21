import SwiftUI

/// ログイン状態で出し分けるだけの入り口。
struct RootView: View {
    @Environment(AuthSession.self) private var session

    var body: some View {
        Group {
            switch session.state {
            case .loading:
                ProgressView()
            case .signedOut:
                SignInView()
            case .signedIn:
                HomeView()
            }
        }
        .animation(.default, value: session.state)
        .task {
            await session.restore()
        }
    }
}

#Preview {
    RootView()
        .environment(AuthSession())
}
