# frontend/ の規約

React 19 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query + React Router。
**iOS と同じレイヤ分け**にしてあるので、片方を読めばもう片方も読める。

```
frontend/
  .env.example          # VITE_ で始まる環境依存値のひな形 (.env は gitignore)
  Dockerfile            # dev (Vite) / builder / runtime (nginx) の 3 ステージ
  nginx.conf            # 本番配信。SPA なので index.html に落とす
  src/
    main.tsx            # エントリポイント
    app/                # Provider の組み立てと DI の登録 (container.ts)
    core/               # アプリ横断 (config / connection / tokenStore / repositories / session)
    domain/             # エンティティと Repository の型。通信を知らない
    data/               # apiClient・レコード型・Repository 実装・Dummy 実装・生成した型
    feature/            # 画面
```

依存の向き: `app` → `feature` → `core` → `domain` ← `data`。
**domain は何にも依存しない**。`feature` から `apiClient` や `UserRecord` を直接触らない
(`app/container.ts` だけが `data/` を知っている)。

## コマンド

`make up` で backend と一緒に立つ (http://localhost:5173)。

```bash
make front-logs     # Vite のログ
make front-lint     # eslint + tsc
make front-build    # 本番ビルド (frontend/dist)
make front-types    # backend の OpenAPI から TS 型を再生成
make front-sh       # web コンテナに入る
```

ホストに node があるなら `cd frontend && npm install && npm run dev` でもよい。

## 接続先 (ダミー / API)

| 接続先 | 中身 |
| --- | --- |
| `dummy` | ブラウザのメモリ上のダミーデータ (`data/dummy`)。**backend を立てなくても動く** |
| `api` | 実際の API。URL は `VITE_API_ENDPOINT` |

- **dev の既定は `dummy`**、本番ビルドは `api` (`core/config.ts` の `defaultConnection`)。
- 切り替えはログイン画面 / ヘッダの「接続先」(dev のみ表示)。選択は localStorage に残り、
  切り替えると**リロードして DI ごと作り直す**。JWT は接続先ごとに別のキーで持つ。
- ダミーは `dummyDatabase` がメモリに持つだけで、リロードすると初期状態に戻る。
  **パスワードは検証しない**(`dummyData.ts` のメールアドレスなら誰でもログインできる)。

## 設定 (環境変数)

- 環境依存の値は **`core/config.ts` だけ**で読む。コードに URL を直書きしない。
- `VITE_` で始まる値は**ビルド時にバンドルへ埋め込まれ、ブラウザから丸見えになる**。
  秘密は置かない。
- キーを増やしたら `.env.example` と `src/vite-env.d.ts` にも足す(この 2 つが一覧)。

## DI

**登録は `app/container.ts` だけ**。ここ以外で `createApiClient` や `createDummy*` を呼ばない。

```ts
export function createRepositories(connection: Connection): Repositories {
  const tokenStore = createTokenStore(connection);
  if (connection === "dummy") return { tokenStore, auth: createDummyAuthRepository(tokenStore), ... };
  const api = createApiClient(appConfig.apiEndpoint, tokenStore);
  return { tokenStore, auth: createApiAuthRepository(api), ... };
}
```

画面は `useRepositories()` で protocol (= 型) だけを受け取る。

## 通信

- 口は `data/apiClient.ts` だけ。**他の場所で `fetch` を呼ばない**。
- 失敗は全部 `DomainError` に畳んでから投げる。UI は `<ErrorText error={...} />` で出す。
- 認証は `Authorization: Bearer <JWT>`。付けるのは `apiClient`、トークンは毎リクエスト
  `core/tokenStore` から読む。公開エンドポイントは `{ requiresAuth: false }`。
- ログイン / サインアップはトークンがレスポンス**ヘッダ**で返るので `sendReceivingToken`
  (ヘッダが読めるのは backend が `Authorization` を expose しているから)。
- snake_case / iso8601 は `data/records/` が Domain の綴りと `Date` に直す。

## 状態

- サーバー由来のデータは **TanStack Query が唯一の持ち主**。`useState` に写さない。
- ログイン状態も `me` クエリのキャッシュ (`core/session.ts`)。Context の Provider は置かない
  ので、`useSession()` を好きな画面で呼べば同じものを見る。
- 画面ローカルの状態は `useState`。ViewModel は作らない。
- **`useEffect` で state を同期しない**。取得できてから描くコンポーネントに分け、初期値は
  `useState(props...)` + `key` で渡す (`feature/users/UserDetailPage.tsx` がその形)。
  eslint の `react-hooks/set-state-in-effect` がこれを見ている。
- クエリキーは feature ごとに 1 か所へ (`feature/users/queries.ts` の `userKeys`)。

## エンドポイント追加

backend に `posts` を足した場合:

1. `make docs` で backend の OpenAPI を更新 → `make front-types` で TS 型を再生成
2. `domain/post.ts` にエンティティ、`domain/postRepository.ts` に型
3. `data/records/post.ts` に `PostRecord` (生成物から引く) と `toPost`
4. `data/repositories/apiPostRepository.ts` を `apiUserRepository` に倣って実装
5. `data/dummy/dummyPostRepository.ts` も作る(**ダミーで動かないと接続先を切り替えた時に壊れる**)
6. `core/repositories.ts` の `Repositories` に足し、`app/container.ts` で出し分けを登録
7. `feature/posts/queries.ts` に `useQuery` / `useMutation` を置き、画面から呼ぶ

一次情報は backend の Swagger UI (http://localhost:3000/api-docs)。

## テスト

フロントも新規テストは原則追加せず、TDD は行わない (AGENTS.md)。CI が見ているのは
`npm run lint` / `npm run build` (型チェック込み) / 生成した型の鮮度の 3 つ。

## デプロイ

`infra/` の Lightsail + API Gateway は **API だけ**を載せている。web は compose の
`compose.override.yaml` にしか居ないので、デプロイには含まれない。
公開するなら `Dockerfile` の `runtime` ステージ (nginx) をどこかに載せるか、
`npm run build` した `dist/` を静的ホスティングに置く。どちらも
`VITE_API_ENDPOINT` に `make infra-url` の値を渡してビルドする。
