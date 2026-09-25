# backend (Rails API)

Ruby 3.3 / Rails 8.0 (API モード) / PostgreSQL 16。

- rswag により、**1つの spec から「E2E(リクエスト)テスト」と「OpenAPI 仕様書」を同時に得られる**
- スキーマは ridgepole で管理。**`db/Schemafile` が唯一の正**で、マイグレーションファイルは作らない
- 認証は devise + devise-jwt。**認証情報は `identities`、プロフィールは `users`** に分かれている

起動方法とエンドポイント一覧はリポジトリ直下の [README.md](../README.md) を参照。
spec の書き方・スキーマ定義・エンドポイント追加手順は
**[.claude/docs/backend.md](../.claude/docs/backend.md)** にまとめてある。

## 開発の流れ

1. テーブルが要るなら `db/Schemafile` を編集し `make db-apply`(差分確認は `make db-dry-run`)
2. ルーティング / コントローラを書く
3. `spec/requests/` に rswag の spec を書く(これが仕様書を兼ねる)
4. `make test` で E2E が通ることを確認
5. `make docs` で `swagger/v1/swagger.yaml` を更新し、**生成物もコミット**(CI が最新かを検査)
6. フロント担当には `/api-docs` を共有

## 認証

`users`(プロフィール)と `identities`(email / パスワード / jti)を分けてある。
将来 OAuth を足す場合も `identities` に列を増やして寄せる想定。

```
POST   /api/v1/signup   # User + Identity を作成し、そのままログイン
POST   /api/v1/login    # メール + パスワード
DELETE /api/v1/logout   # トークンを失効
GET    /api/v1/me       # トークンの持ち主
```

- ログイン系のレスポンスの **`Authorization: Bearer <JWT>` ヘッダ**にトークンが載る
  (ボディではない)。フロントはこれを保存して以降のリクエストに付ける。
  CORS 設定で `Authorization` を `expose` 済み。
- **トークンの検証は Warden (devise-jwt) の Rack ミドルウェア**が行う。
  コントローラ側は `ApplicationController` の `before_action :authenticate_identity!` が既定で、
  公開エンドポイントだけ `skip_before_action :authenticate_identity!, only: :create` で外す。
- ログアウトは `identities.jti` を打ち直すことで実現している(`Identity` の `JTIMatcher`)。
  失効済みトークンは `{"error":"revoked token"}` の 401 になる。
- 未認証は必ず `{"error":"..."}` の 401。`app/lib/json_failure_app.rb` が HTML リダイレクトを潰している。
- 有効期限は 7 日(`config/initializers/devise.rb` の `jwt.expiration_time`)。

## 構成

```
db/
  Schemafile                       # スキーマの唯一の正 (ridgepole)
  seeds.rb
app/
  controllers/
    application_controller.rb      # 認証の既定 + 404 / 400 の共通ハンドリング
    api/v1/registrations_controller.rb  # POST /api/v1/signup
    api/v1/sessions_controller.rb       # POST /api/v1/login, DELETE /api/v1/logout
    api/v1/me_controller.rb             # GET  /api/v1/me
    api/v1/users_controller.rb          # サンプル CRUD (要トークン)
  models/
    user.rb                        # プロフィール。has_one :identity
    identity.rb                    # devise + devise-jwt
  serializers/
    user_serializer.rb             # レスポンスの JSON はここだけで組む (Alba)
  lib/json_failure_app.rb          # 未認証時に JSON の 401 を返す
lib/
  middleware/origin_guard.rb       # ORIGIN_SECRET があるとき API Gateway 経由のみ許可
  tasks/ridgepole.rake
config/
  routes.rb                        # /api/v1 名前空間 + /api-docs マウント
  database.yml                     # 接続情報は環境変数から
  initializers/
    devise.rb                      # JWT の発行/失効パス・有効期限もここ
    cors.rb                        # CORS_ORIGINS で許可オリジンを指定
spec/
  swagger_helper.rb                # OpenAPI のメタ情報・共通スキーマ定義
  support/auth_helper.rb           # spec 用にトークンを発行する bearer_token_for
  requests/api/v1/auth_spec.rb     # 認証まわりの仕様書 兼 E2Eテスト
  requests/api/v1/users_spec.rb
  factories/users.rb
swagger/v1/swagger.yaml            # 生成物(コミットする)
```

## 環境変数

`.env.example` を参照。compose.yaml が既定値を渡すのでローカルでは設定不要。

| 変数 | 既定値 | 用途 |
| --- | --- | --- |
| `DB_HOST` / `DB_PORT` | `db` / `5432` | DB 接続先 |
| `DB_USERNAME` / `DB_PASSWORD` | `postgres` / `postgres` | DB 認証 |
| `DB_NAME` | `app` | `app_development` / `app_test` の接頭辞 |
| `CORS_ORIGINS` | `*` | カンマ区切りで許可オリジンを制限 |
| `DEVISE_JWT_SECRET_KEY` | `secret_key_base` | JWT の署名鍵。**本番では必ず指定する** |
| `ORIGIN_SECRET` | (空) | 値があると `x-origin-secret` ヘッダを検証する。`infra/` 参照 |

## 注意点

- **マイグレーションは使わない**: `db/schema.rb` も `db/migrate/` も無い。スキーマ変更は `db/Schemafile` を編集して `make db-apply`。`bin/rails g model` もマイグレーションを生成しない設定にしてある。
- **テスト DB は自動追従**: `spec/rails_helper.rb` が起動時に Schemafile を test DB へ適用する(DB が無ければ作成する)ので、`make test` の前に手で流す必要はない。
- **テストは常に `RAILS_ENV=test`**: コンテナの `RAILS_ENV` は development なので、`spec/rails_helper.rb` で強制的に上書きしている。
- **`sign_in` には `store: false`**: API 専用でセッションを持たないため。付け忘れると "sessions disabled" で落ちる。
- **credentials は使っていない**: `config/master.key` は `.gitignore` 済み(Rails 既定)。`secret_key_base` は本番では `SECRET_KEY_BASE` 環境変数、開発/テストでは `tmp/local_secret.txt` から来るので、鍵が無くても起動する。fork 後に credentials を使いたくなったら `bin/rails credentials:edit` で作り直すこと(既存の `credentials.yml.enc` は元の鍵が無いと復号できない)。
- **`json` gem は 2.x に固定**: json 3.x は Rails 8.0 系の JSON エンコーダと非互換(`quirks_mode` 削除)。
- **console のプロンプト**: `.irbrc` が `irb(dev):001 > ` / `irb(prod):001 > ` に差し替えている。`config/application.rb` の `console do` では `IRB.setup` に上書きされるため効かない。
- **デプロイ時は本番モード**: `infra/compose.deploy.yaml` が `RAILS_ENV=production` を渡す。ローカルの `docker compose up` は development のまま。
- **API の表示名**: `spec/swagger_helper.rb` の `info.title` / `info.description` が Swagger UI に出る。プロジェクト名が決まったら書き換えて `make docs` を回す。
