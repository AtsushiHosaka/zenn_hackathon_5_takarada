import FactoryKit
import SwiftUI

/// ログイン後。/api/v1/me と /api/v1/users を叩くだけのサンプル。
struct HomeView: View {
    @Environment(AuthSession.self) private var session
    @Injected(\.userRepository) private var userRepository

    @State private var users: [User] = []
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                if let me = session.currentUser {
                    Section("自分") {
                        UserRow(user: me)
                    }
                }

                Section("ユーザー一覧") {
                    if let errorMessage {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.callout)
                    }
                    ForEach(users) { UserRow(user: $0) }
                }
            }
            .navigationTitle("Home")
            .toolbar {
                Button("ログアウト") {
                    Task { await session.logOut() }
                }
            }
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        do {
            users = try await userRepository.list()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct UserRow: View {
    let user: User

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(user.name)
            Text(user.email)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    HomeView()
        .environment(AuthSession(state: .signedIn(.preview)))
}
