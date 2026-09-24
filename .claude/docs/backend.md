# backend/ の規約

Rails 8 (API モード) + RSpec + rswag + ridgepole + devise/devise-jwt。

- **rswag の request spec が API 契約とリクエストテストを兼ねる**。既存の「E2E」表記はこれを指し、iOS から AWS までの通し検証ではない。
- **`db/Schemafile` が DB スキーマの唯一の正**(ridgepole。マイグレーションは作らない)
- **認証情報は `identities`、プロフィールは `users`**(devise)

## コマンド

リポジトリ直下で叩く。ホストに Ruby は不要。

```bash
make test        # rspec
make docs        # swagger/v1/swagger.yaml を再生成
make db-apply    # db/Schemafile を DB に適用 (差分確認は make db-dry-run)
make sh          # コンテナに入る (rubocop や rails g はここで)
```

1ファイル/1行だけ: `docker compose exec api bundle exec rspec spec/requests/api/v1/users_spec.rb:42`

ローカルは development、`infra/` 経由のデプロイは production で動く。
`rails console` のプロンプト(`irb(dev)` / `irb(prod)`)で見分けられる。

## スキーマ

- `db/Schemafile` を直接編集して `make db-apply`。`db/schema.rb` も `db/migrate/` も無い。
- テスト DB は `spec/rails_helper.rb` が Schemafile へ自動追従させるので手で流さなくてよい。

## 認証

- `users` に email やパスワードを生やさない。認証情報は `identities` 側。
- 検証は Warden (devise-jwt) の Rack ミドルウェア。`ApplicationController` の
  `before_action :authenticate_identity!` が既定で、公開エンドポイントだけ
  `skip_before_action :authenticate_identity!, only: :create` で外す。
- ログイン中のユーザーは `current_user`。`sign_in` には必ず `store: false`(セッションが無いため)。
- トークンの発行/失効パスと有効期限は `config/initializers/devise.rb` の `config.jwt`。
  ログイン系を増やしたら `jwt.dispatch_requests` にも足す。

## テスト方針と API 契約

- フロント・backend・infra とも新規テストは原則追加せず、TDD は行わない。追加はユーザーが求めた場合に限る。
- 既存テストと CI は維持し、変更に関係する検証を実行する。実行できなければ理由を報告する。
- 例外として、Swagger 生成に必要な最小限の rswag 契約記述は追加・更新する。網羅的なケース追加は行わない。
- 生成元は `spec/requests/` と `spec/swagger_helper.rb`。`swagger/v1/swagger.yaml` は直接編集せず、`make docs` で生成してコミットする。
- 生成成功だけで動作確認済みとはしない。API 契約はクライアント連携に使える時点で早めに共有する。

以下は契約記述の例。レスポンス定義はその API で実際に必要なものを選ぶ。

```ruby
require "swagger_helper"

RSpec.describe "Api::V1::Posts", type: :request do
  let(:current) { create(:user) }
  let(:Authorization) { bearer_token_for(current) }   # spec/support/auth_helper.rb

  path "/api/v1/posts/{id}" do
    parameter name: :id, in: :path, type: :integer, required: true

    patch "投稿を更新する" do
      tags "Posts"
      security [ { bearerAuth: [] } ]                 # 公開エンドポイントは security []
      consumes "application/json"
      produces "application/json"
      parameter name: :params, in: :body, schema: { "$ref" => "#/components/schemas/PostInput" }

      response "200", "更新に成功" do
        schema "$ref" => "#/components/schemas/Post"

        let(:post_record) { create(:post) }
        let(:id) { post_record.id }
        let(:params) { { post: { title: "new" } } }

        run_test!
      end

      response "401", "トークンが無い" do
        schema "$ref" => "#/components/schemas/Unauthorized"
        let(:Authorization) { "" }
        run_test!
      end
    end
  end
end
```

- **`spec/requests/` の rswag DSL のみ。** 素の `get "/api/v1/posts"` もコントローラスペックも書かない。
- **レスポンスボディがある場合は `schema` を書く。** `run_test!` が定義したスキーマとレスポンスを照合する。
- **`parameter name: :x` と `let(:x)` は同名。** パスパラメータ `{id}` も `let(:id)` で渡す。
- `let` はレスポンスブロックの中。データ投入は `before` か `let!`(`let` だけでは作られない)。
- `run_test!` のブロックには schema で見られないものだけ(値・件数・DB の副作用)。不要なら省く。
- 正常系と連携に必要なエラー応答を実際の API 契約に合わせて定義する。`422`・`404`・`401` の一律網羅は求めない。
- summary / description は日本語(Swagger UI にそのまま出る)。
- `Authorization` は定数と同じ綴り。ブロック内で値が要るときは `send(:Authorization)`。

## スキーマとファクトリ

レスポンスの形は `spec/swagger_helper.rb` の `components.schemas` に定義し `$ref` で参照する
(spec にインラインで書かない)。既存: `User` / `SignupInput` / `LoginInput` / `UserInput` /
`ValidationErrors` / `Unauthorized` / `NotFound`。`required:` と `example:` を省略しない。

ファクトリは `spec/factories/`。`create(:user)` はログイン可能な `identity` 付きで作られる。

## エンドポイント変更時の参照

- DB 変更は `db/Schemafile`。モデル生成が必要なら `bin/rails g model Post --no-fixture` (マイグレーションは生成されない)。
- コントローラは `users_controller.rb`、ルートは `config/routes.rb` の `namespace :api` / `:v1` を参照する。
- 共通例外は `ApplicationController` の `rescue_from` に任せる。serializer gem は使わず、private な `serialize_xxx` で組み、日時は `iso8601`。
- `make test` は既存リクエストテスト、`make docs` は契約の再生成。CI はテストと生成物の差分 (`git diff --exit-code swagger/`) を検査する。作業順序は固定しない。

Lint は `bin/rubocop -f github`(CI と同じ)。自動修正は `bin/rubocop -a`。
