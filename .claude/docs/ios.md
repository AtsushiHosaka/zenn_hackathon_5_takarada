# ios/ の規約

SwiftUI + async/await + [FactoryKit](https://github.com/hmlongco/Factory) (DI)。
単一ターゲットを**レイヤごとのディレクトリ**で分けている
(Xcode 26 の file-system synchronized group なので、**ファイルを置けば勝手にターゲットに入る**。
`.xcodeproj` を編集する必要はない)。

```
ios/
  Info.plist            # API_ENDPOINT などの環境依存値 (gitignore)
  Info.plist.example    # ↑のひな形 (これはコミットする)
  ios/
    App/        # エントリポイントと DI の登録 (Container+Registrations)
    Core/       # アプリ横断の仕組み (AppConfig / AppEnvironment / TokenStore / AuthSession)
    Domain/     # エンティティと Repository の protocol。通信を知らない
    Data/       # ApiClient・レコード型・Repository の実装・Dummy 実装
    Feature/    # 画面
```

依存の向き: `App` → `Feature` → `Core` → `Domain` ← `Data`。
**Domain は何にも依存しない**。`Feature` から `ApiClient` や `UserRecord` を直接触らない。

## コマンド

```bash
make ios-setup   # Info.plist.example を Info.plist にコピー (clone 後に1回)
make ios-open    # Xcode で開く
make ios-build   # シミュレータ向けにビルドだけ通す
```

## 接続先 (ダミー / API)

| 接続先 | 中身 |
| --- | --- |
| `.dummy` | 端末内のダミーデータ (`Data/Dummy`)。**backend を立てなくてもアプリが一通り動く** |
| `.prod` | 実際の API。URL は Info.plist の `API_ENDPOINT` |

- **Debug ビルドの既定は `.dummy`**、Release は `.prod`(`AppEnvironment.fallback`)。
- 実行中の切り替えはログイン画面の「接続先」(Debug のみ表示) か `Container.shared.use(.prod)`。
  選択は UserDefaults に残る。JWT は接続先ごとに別々に Keychain へ持つ。
- ダミーは `DummyDatabase` がメモリに持つだけ。**パスワードは検証しない**
  (`DummyData.users` のメールアドレスなら誰でもログインできる)。初期データはそこを書き換える。

## 設定 (Info.plist)

- 環境依存の値は **Info.plist に置いて `Core/AppConfig` から読む**。コードに URL を直書きしない。
- `Info.plist` は gitignore。キーを増やしたら **`Info.plist.example` にも足す**(これが唯一の一覧)。
- `GENERATE_INFOPLIST_FILE = YES` のまま `INFOPLIST_FILE = Info.plist` を指定してあるので、
  Xcode が生成するキー(シーン定義など)はビルド時にこのファイルへマージされる。
- ローカルの Rails を http で叩くための ATS 例外も example に入っている。https だけなら消してよい。

## DI (FactoryKit)

**登録は `App/Container+Registrations.swift` だけ**。ここ以外に `Container` の extension を作らない。

```swift
extension Container {
    var userRepository: Factory<any UserRepository> {
        self {
            self.appEnvironment().isDummy
                ? DummyUserRepository() as any UserRepository
                : ApiUserRepository(api: self.apiClient())
        }
        .onPreview { DummyUserRepository() }   // プレビューは常にダミー
    }
}
```

解決は用途で使い分ける。

| 書き方 | いつ |
| --- | --- |
| `@Injected(\.userRepository)` | 生成時に 1 回引く。View など短命なもの |
| `@DynamicInjected(\.userRepository)` | **アクセスのたびに引き直す**。長生きする `AuthSession` はこちら(接続先の切り替えが即効く) |
| `Container.shared.userRepository()` | property wrapper が使えない場所 |

- **ログイン状態 (`AuthSession`) は Factory に入れず `@State` + `.environment()` で配る。**
  サービス = Factory、画面が見る状態 = Environment、と分ける。
- プレビュー用に登録し直す必要は無い(`.onPreview` 済み)。テストでは
  `Container.shared.userRepository { ... }` で上書きする。

## 通信

- 口は `Data/ApiClient` だけ。`URLSession` を他の場所で使わない。
- 失敗は全部 `DomainError` に畳んでから投げる。UI は `error.localizedDescription` を出す。
- JSON は snake_case / iso8601 を `ApiClient` の decoder が吸収するので、
  レコード型は `createdAt` のように普通の Swift の綴りで書く。
- 認証は `Authorization: Bearer <JWT>`。付けるのは `ApiClient`、トークンは毎リクエスト
  `Core/KeychainTokenStore` から読む。公開エンドポイントは `Endpoint(requiresAuth: false)`。
- ログイン/サインアップはトークンがレスポンス**ヘッダ**で返るので `sendReceivingToken`。

## エンドポイント追加

backend に `posts` を足した場合:

1. `Domain/Post.swift` にエンティティ、`Domain/PostRepository.swift` に protocol
2. `Data/Records/PostRecord.swift` にレスポンスの形 + `var post: Post` で Domain に移す
   (リクエストボディの型は `Data/Records/Requests.swift`。Rails の `params.require(:post)` に
   合わせて `{ "post": { ... } }` の入れ子にする)
3. `Data/Repositories/ApiPostRepository.swift` を `ApiUserRepository` に倣って実装
4. `Data/Dummy/DummyPostRepository.swift` も作る(**ダミーで動かないと接続先を切り替えた時に壊れる**)
5. `App/Container+Registrations.swift` に登録(ダミー / API の出し分けと `.onPreview`)
6. 画面から `@Injected(\.postRepository)` で受け取る

一次情報は backend の Swagger UI (`http://localhost:3000/api-docs`)。

## 状態と並行性

- ログイン状態は `Core/AuthSession` だけが持つ(`@Observable`)。View は `session.state` を見る。
- 画面ローカルの状態は `@State`。ViewModel は作らず、必要になったら `@Observable` なクラスを
  `Feature/` に置く。
- Xcode の既定 (`SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`) に乗っているので**書かなければ MainActor**。
  UI と関係ない `Domain` / `Data` / `Core` の型は `nonisolated` を付けてメインから外してある
  (Factory の登録クロージャが nonisolated なので、付けないと警告が出る)。
