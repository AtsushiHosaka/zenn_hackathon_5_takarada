# モノレポ

| ディレクトリ | 内容 |
| --- | --- |
| [`backend/`](backend/README.md) | Rails 8 (API モード) + PostgreSQL 16 + JWT 認証。詳細は `backend/README.md` |
| [`frontend/`](frontend/README.md) | React 19 + Vite + Tailwind の SPA (Domain / Data / Core のレイヤ分け)。規約は `.claude/docs/frontend.md` |
| [`infra/gcp/`](infra/gcp/README.md) | GCP の最小構成 (Cloud Run + Cloud SQL、Terraform)。詳細は `infra/gcp/README.md` |
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
デプロイ先は Cloud Run。静的ファイルを nginx で配信する `frontend/Dockerfile` の
`runtime` ステージをそのまま使う。

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

## デプロイ手順 (GCP: Cloud Run + Cloud SQL)

必要なのは **Docker / gcloud / Terraform**。

```bash
brew install --cask google-cloud-sdk
brew install terraform
```

構成の全体像と設計の理由は [infra/gcp/README.md](infra/gcp/README.md)。

### 1. GCP プロジェクトを用意して認証を通す

```bash
make infra-bootstrap
```

対話で次を済ませる。何度実行しても壊れない。

1. `gcloud auth login` — ブラウザでログイン
2. プロジェクトの選択、または新規作成
3. 請求先アカウントの紐付け(Cloud Run も Cloud SQL も請求先が無いと作れない)
4. terraform が他の API を有効化するための API を開ける
5. `gcloud auth application-default login` — terraform が読む認証情報を取る
6. `infra/gcp/terraform.tfvars` を書く

終わったら `infra/gcp/terraform.tfvars` の `github_repository` を自分のリポジトリに直す。
ここが空だと GitHub Actions 用の Workload Identity が作られない。

```hcl
project_id        = "zenn-hackathon-xxxxxx"   # bootstrap が入れる
project           = "zenn-hackathon"
region            = "asia-northeast1"
github_repository = "your-name/your-repo"     # owner/repo
```

### 2. 作成してデプロイする

```bash
make infra-up
```

以下が順に走る(初回は Cloud SQL の作成だけで 5〜10 分かかる)。

1. `terraform apply` — Artifact Registry / Cloud SQL / Secret Manager / Cloud Run / Workload Identity を作成
2. backend と frontend のイメージをビルドして Artifact Registry に push
   (Cloud Run は x86_64 なので `linux/amd64` でクロスビルド)
3. Cloud Run ジョブで `rails db:apply`(ridgepole)を流してスキーマを当てる
4. Cloud Run の api / web を新しいイメージに差し替える

`make infra-apply` の直後だけ Cloud Run は Google のサンプルイメージで動いている。
これは「Cloud Run の URL が決まらないとフロントのビルドに埋める API URL が決まらない」
という順序の問題を 2 段階に分けたもの。`make infra-release` で自分のイメージになる。

### 3. エンドポイントを確認する

```bash
make infra-url
# API  https://zenn-hackathon-api-xxxxxxxxxx.asia-northeast1.run.app
# Web  https://zenn-hackathon-web-xxxxxxxxxx.asia-northeast1.run.app
```

| 見るもの | URL |
| --- | --- |
| ヘルスチェック | `<API>/up` |
| Swagger UI(全エンドポイントをブラウザから叩ける) | `<API>/api-docs` |
| OpenAPI 定義(フロントの型生成に使う) | `<API>/api-docs/v1/swagger.yaml` |

疎通確認:

```bash
URL=$(terraform -chdir=infra/gcp output -raw api_url)
curl -i -X POST "$URL/api/v1/signup" \
  -H 'Content-Type: application/json' \
  -d '{"user":{"name":"Taro","email":"taro@example.com","password":"password"}}'
# レスポンスヘッダの Authorization: Bearer ... がトークン
```

デモユーザーを入れるなら `make infra-seed`。

### 4. CI/CD を有効にする

```bash
gh auth login        # 未ログインなら
make infra-secrets   # terraform の出力を GitHub Secrets に登録
```

登録されるのは次の 10 個。手で入れる場合は `terraform -chdir=infra/gcp output -raw <名前>`
の値を設定する。

| Secret | terraform の出力名 |
| --- | --- |
| `GCP_WIF_PROVIDER` | `wif_provider` |
| `GCP_SERVICE_ACCOUNT` | `gha_service_account` |
| `GCP_PROJECT_ID` | `project_id` |
| `GCP_REGION` | `region` |
| `GCP_API_IMAGE_REPO` | `api_image_repo` |
| `GCP_WEB_IMAGE_REPO` | `web_image_repo` |
| `GCP_API_SERVICE` | `api_service` |
| `GCP_WEB_SERVICE` | `web_service` |
| `GCP_TASK_JOB` | `task_job` |
| `GCP_API_URL` | `api_url` |

これで **main にマージすると自動デプロイされる**。

```
PR を main にマージ
  └─ CI (.github/workflows/ci.yml)      rspec / OpenAPI定義の鮮度 / rubocop
       └─ Deploy (.github/workflows/deploy.yml)   CI が成功した時だけ走る
            1. Workload Identity で GCP にログイン (鍵は GitHub に置かない)
            2. api / web のイメージをビルドして Artifact Registry に push
               (tag: コミットSHA と latest)
            3. Cloud Run ジョブで rails db:apply (新しいコードより先にスキーマを当てる)
            4. Cloud Run の api / web を差し替える
            5. <API>/up が 200 になるまで確認
```

### 5. 片付け

```bash
make infra-destroy   # 作ったものを全部消す (Cloud SQL のデータも消える)
```

固定費は実質 Cloud SQL (db-f1-micro) の月 ¥1,500 前後だけ。Cloud Run はアクセスが
無い間ゼロに縮むのでほぼ掛からない。使わない期間は `make infra-destroy` で消す。

運用コマンドの一覧と設計の理由は [infra/gcp/README.md](infra/gcp/README.md) を参照。

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
infra/gcp/                        # GCP の最小構成 (Cloud Run + Cloud SQL + Artifact Registry)
compose.yaml                      # ローカルのベース (db + redis + api + worker)
compose.override.yaml             # ローカル専用 (build・コードのマウント・web)
Makefile
.claude/docs/backend.md           # backend の規約
.claude/docs/frontend.md          # frontend の規約
.claude/docs/ios.md               # ios の規約
.github/workflows/ci.yml          # rspec / OpenAPI定義の鮮度チェック / rubocop / frontend
.github/workflows/deploy.yml      # main マージで Artifact Registry へ push -> Cloud Run 更新
```
