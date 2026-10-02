# モノレポ

| ディレクトリ | 内容 |
| --- | --- |
| [`backend/`](backend/README.md) | Rails 8 (API モード) + PostgreSQL 16 + JWT 認証。詳細は `backend/README.md` |
| [`frontend/`](frontend/README.md) | React 19 + Vite + Tailwind の SPA (Domain / Data / Core のレイヤ分け)。規約は `.claude/docs/frontend.md` |
| [`infra/`](infra/README.md) | AWS Lightsail + API Gateway (Terraform)。詳細は `infra/README.md` |
| `ios/` | SwiftUI アプリ (Domain / Data / Core のレイヤ分け + FactoryKit で DI)。規約は `.claude/docs/ios.md` |

`frontend/` と `ios/` は**同じレイヤ分け・同じダミー接続の仕組み**にしてある。

## 開発ルール

仕様のSSOTはGoogle Docsで、MCP経由で読み取ります。fork後に [docs/project.md](docs/project.md) のURL欄を設定してください。
新規テストは原則追加せず、TDDは行いません。既存CIとSwagger生成用の最小rswag定義は維持します。
PRは [.github/pull_request_template.md](.github/pull_request_template.md) に従います。

## 起動

```bash
docker compose up --build
```

これだけで DB の作成 + スキーマ適用 + seed + Web フロントの起動まで走る。

| | URL |
| --- | --- |
| Web フロント | http://localhost:5173 |
| API | http://localhost:3000 |

```bash
make up       # 起動 (api + worker + db + redis + web)
make down     # 停止
make logs     # APIのログ追尾
make worker-logs # 非同期処理(sidekiq)のログ追尾
make sh       # APIコンテナに入る
make test     # 既存のAPIリクエストテスト
make docs     # OpenAPI定義(swagger.yaml)の再生成
make db-apply # db/Schemafile を DB に適用 (スキーマ管理は ridgepole)
make reset    # DB作り直し + seed
```

## Web フロント

```bash
make front-logs   # Vite のログ
make front-lint   # eslint + 型チェック
make front-build  # 本番ビルド (frontend/dist)
make front-types  # backend の OpenAPI から TypeScript の型を再生成
```

**dev の既定は「ダミー」接続**なので、backend を立てなくてもログインから一覧まで動く
(データはブラウザのメモリ上の `frontend/src/data/dummy`)。実 API を叩くならログイン画面 /
ヘッダの「接続先」を `API` に切り替える。URL は `VITE_API_ENDPOINT`
(既定 `http://localhost:3000`、デプロイ済みなら `make infra-url` の値)。

| ディレクトリ | 内容 |
| --- | --- |
| `frontend/src/app/` | Provider の組み立てと DI の登録 (`container.ts`) |
| `frontend/src/core/` | 設定・接続先・トークン・DI の受け口・ログイン状態 |
| `frontend/src/domain/` | エンティティと Repository の型 |
| `frontend/src/data/` | `apiClient`・レコード型・Repository 実装・ダミー実装・生成した型 |
| `frontend/src/feature/` | 画面 |

規約は [.claude/docs/frontend.md](.claude/docs/frontend.md)。
`infra/` のデプロイは API だけなので、web の公開先は別に用意する(同ドキュメント参照)。

## iOS

```bash
make ios-setup   # ios/Info.plist を用意する (clone 後に1回。Info.plist は gitignore)
make ios-open    # Xcode で開く
make ios-build   # シミュレータ向けにビルドだけ通す
```

**Debug ビルドの既定は「ダミー」接続**なので、backend を立てなくてもログインから一覧まで動く
(データは端末内の `ios/ios/Data/Dummy`)。実 API を叩くならログイン画面下の「接続先」を
`API` に切り替える。URL は `ios/Info.plist` の `API_ENDPOINT`(既定 `http://localhost:3000`、
デプロイ済みなら `make infra-url` の値)。

| ディレクトリ | 内容 |
| --- | --- |
| `ios/ios/App/` | エントリポイントと DI の登録 (`Container+Registrations.swift`) |
| `ios/ios/Core/` | 設定・接続先・トークン・`AuthSession` |
| `ios/ios/Domain/` | エンティティと Repository の protocol |
| `ios/ios/Data/` | `ApiClient`・レコード型・Repository 実装・ダミー実装 |
| `ios/ios/Feature/` | 画面 |

規約は [.claude/docs/ios.md](.claude/docs/ios.md)。

## デプロイ手順 (AWS アカウント作成から CI/CD まで)

必要なのは **Docker だけ**。Terraform も AWS CLI もコンテナで動かすので、ホストには入れない。

### 1. AWS アカウントを用意する

1. https://portal.aws.amazon.com/billing/signup からサインアップ(クレジットカードと電話番号が要る)
2. ルートユーザーに MFA を設定する
3. IAM で作業用ユーザーを作り、`AdministratorAccess` を付ける(ルートユーザーで作業しない)
4. そのユーザーでアクセスキーを発行する

### 2. 認証情報を通す

```bash
aws configure                      # ~/.aws/credentials を作る (aws CLI がある場合)
# または環境変数でもよい
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=ap-northeast-1
```

### 3. 設定ファイルを用意する

```bash
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
```

CI/CD まで通すなら `github_repository` を必ず埋める。ここが空だと GitHub Actions 用の
IAM ロールが作られない。

```hcl
project           = "hack"
region            = "ap-northeast-1"
github_repository = "your-name/your-repo"   # owner/repo
```

### 4. 作成してデプロイする

```bash
make infra-up
```

以下が順に走る(初回は 10 分ほどかかる)。

1. `terraform apply` — Lightsail / 固定IP / ECR / IAM / API Gateway を作成
2. イメージをビルドして ECR に push(Lightsail は x86_64 なので `linux/amd64` でクロスビルド)
3. インスタンスに ECR から pull させて起動

終わると**公開 URL が表示される**。

### 5. エンドポイントを確認する

```bash
make infra-url
# => https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com
```

| 見るもの | URL |
| --- | --- |
| ヘルスチェック | `<URL>/up` |
| Swagger UI(全エンドポイントをブラウザから叩ける) | `<URL>/api-docs` |
| OpenAPI 定義(フロントの型生成に使う) | `<URL>/api-docs/v1/swagger.yaml` |

疎通確認:

```bash
URL=$(make -s infra-url)
curl -i -X POST "$URL/api/v1/signup" \
  -H 'Content-Type: application/json' \
  -d '{"user":{"name":"Taro","email":"taro@example.com","password":"password"}}'
# レスポンスヘッダの Authorization: Bearer ... がトークン
```

### 6. CI/CD を有効にする

```bash
gh auth login        # 未ログインなら
make infra-secrets   # terraform の出力を GitHub Secrets に登録
```

登録されるのは次の 6 つ。手で入れる場合は「取得コマンド」を実行した値を設定する。

| Secret | 取得コマンド |
| --- | --- |
| `AWS_ROLE_ARN` | `./infra/bin/tf.sh output -raw github_actions_role_arn` |
| `AWS_REGION` | `./infra/bin/tf.sh output -raw region` |
| `ECR_REPOSITORY_URL` | `./infra/bin/tf.sh output -raw ecr_repository_url` |
| `LIGHTSAIL_HOST` | `./infra/bin/tf.sh output -raw instance_ip` |
| `PUBLIC_URL` | `./infra/bin/tf.sh output -raw public_url` |
| `SSH_PRIVATE_KEY` | `cat infra/.ssh/hack.pem` |

これで **main にマージすると自動デプロイされる**。

```
PR を main にマージ
  └─ CI (.github/workflows/ci.yml)      rspec / OpenAPI定義の鮮度 / rubocop
       └─ Deploy (.github/workflows/deploy.yml)   CI が成功した時だけ走る
            1. OIDC で AWS にログイン (長期キーは GitHub に置かない)
            2. イメージをビルドして ECR に push (tag: コミットSHA と latest)
            3. インスタンスに ssh して docker compose pull && up -d
            4. <PUBLIC_URL>/up が 200 になるまで確認
```

### 7. 片付け

```bash
make infra-destroy   # 作ったものを全部消す (データも消える)
```

手動デプロイや運用コマンドは [infra/README.md](infra/README.md) を参照。

## API

| URL | 内容 |
| --- | --- |
| http://localhost:3000/up | ヘルスチェック |
| http://localhost:3000/api-docs | Swagger UI (ブラウザから API を叩ける) |
| http://localhost:3000/api-docs/v1/swagger.yaml | OpenAPI 定義 (フロントの型生成に使う) |

| エンドポイント | 認証 | 内容 |
| --- | --- | --- |
| `POST /api/v1/signup` | 不要 | サインアップ。トークンを受け取る |
| `POST /api/v1/login` | 不要 | ログイン。トークンを受け取る |
| `DELETE /api/v1/logout` | 要 | トークンを失効させる |
| `GET /api/v1/me` | 要 | トークンの持ち主 |
| `GET /api/v1/users` | 要 | ユーザー一覧 |
| `GET /api/v1/users/:id` | 要 | ユーザー取得 |
| `PATCH /api/v1/users/:id` | 要 | ユーザー更新 |
| `DELETE /api/v1/users/:id` | 要 | ユーザー削除 |

認証は JWT。`signup` / `login` のレスポンスヘッダ `Authorization: Bearer <JWT>` を保存し、
以降のリクエストに同じヘッダを付ける。検証は Rack ミドルウェア(devise-jwt)が行う。

エンドポイントの一次情報は `/api-docs`(Swagger UI)。実装を変えたら `make docs` で更新する。

## 構成

```
backend/                          # Rails API
frontend/                         # React + Vite の SPA
ios/                              # SwiftUI アプリ
infra/                            # AWS Lightsail + API Gateway + ECR (Terraform)
compose.yaml                      # ベース (db + redis + api + worker)。デプロイ時もこれを使う
compose.override.yaml             # ローカル専用 (build・コードのマウント・web)
Makefile
.claude/docs/backend.md           # backend の規約
.claude/docs/frontend.md          # frontend の規約
.claude/docs/ios.md               # ios の規約
.github/workflows/ci.yml          # rspec / OpenAPI定義の鮮度チェック / rubocop / frontend
.github/workflows/deploy.yml      # main マージで ECR push -> Lightsail 入れ替え
```
