import FactoryKit
import SwiftUI

/// ログイン / 新規登録。UI のサンプルなので好きに作り替える。
struct SignInView: View {
    private enum Mode: String, CaseIterable, Identifiable {
        case logIn = "ログイン"
        case signUp = "新規登録"

        var id: Self { self }
    }

    @Environment(AuthSession.self) private var session

    @State private var mode: Mode = .logIn
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var isSubmitting = false
    @State private var environment = AppEnvironment.selected

    var body: some View {
        NavigationStack {
            Form {
                Picker("", selection: $mode) {
                    ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)

                Section {
                    if mode == .signUp {
                        TextField("名前", text: $name)
                            .textContentType(.name)
                    }
                    TextField("メールアドレス", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("パスワード", text: $password)
                        .textContentType(mode == .signUp ? .newPassword : .password)
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.callout)
                    }
                }

                Section {
                    Button(mode.rawValue) {
                        Task { await submit() }
                    }
                    .disabled(!canSubmit || isSubmitting)
                }

                #if DEBUG
                // 叩き先の切り替え。製品版で出したくないので DEBUG だけ
                Section("接続先") {
                    Picker("接続先", selection: $environment) {
                        ForEach(AppEnvironment.available) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: environment) { _, new in
                        Container.shared.use(new)
                        // 切り替え先に保存済みトークンがあればそのままログインし直す
                        Task { await session.restore() }
                    }
                    Text(environment.isDummy
                        ? "端末内のダミーデータ (通信しない)"
                        : AppEnvironment.endpoint.absoluteString)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                #endif
            }
            .navigationTitle("ようこそ")
            .disabled(isSubmitting)
            .overlay {
                if isSubmitting { ProgressView() }
            }
        }
    }

    private var canSubmit: Bool {
        !email.isEmpty && !password.isEmpty && (mode == .logIn || !name.isEmpty)
    }

    private func submit() async {
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            switch mode {
            case .logIn:
                try await session.logIn(email: email, password: password)
            case .signUp:
                try await session.signUp(name: name, email: email, password: password)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    SignInView()
        .environment(AuthSession(state: .signedOut))
}
