# backend/ の規約

Rails 8 (API モード) + RSpec + rswag + ridgepole + devise/devise-jwt。

- **spec 1ファイルが E2E テストと OpenAPI 仕様書を兼ねる**(rswag)
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

## テストの書き方

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

        run_test! { expect(post_record.reload.title).to eq("new") }
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
- **`schema` を必ず書く。** `run_test!` がレスポンスを照合するので実装とズレた時点で落ちる。
- **`parameter name: :x` と `let(:x)` は同名。** パスパラメータ `{id}` も `let(:id)` で渡す。
- `let` はレスポンスブロックの中。データ投入は `before` か `let!`(`let` だけでは作られない)。
- `run_test!` のブロックには schema で見られないものだけ(値・件数・DB の副作用)。不要なら省く。
- 網羅する status: 正常系 + `422` + `404` + 認証が要るなら `401` を1本。
- summary / description は日本語(Swagger UI にそのまま出る)。
- `Authorization` は定数と同じ綴り。ブロック内で値が要るときは `send(:Authorization)`。

## シリアライザ

レスポンスの JSON は **`app/serializers/` の Alba リソースが唯一の組み立て場所**。
コントローラでハッシュを手で組んだり `as_json` を呼んだりしない。

```ruby
class PostSerializer
  include Alba::Resource

  attributes :id, :title

  # 日時は必ず iso8601。素の to_json は小数秒付き ("...T00:00:00.000Z") になる
  attribute(:created_at) { |post| post.created_at.iso8601 }

  # 関連は has_many / has_one に serializer を指定する
  has_many :comments, resource: CommentSerializer
end
```

```ruby
render json: PostSerializer.new(post)                 # 単体
render json: PostSerializer.new(Post.order(id: :asc)) # コレクション (Alba が自動判別)
```

- **ルートキーは付けない。** 既存のレスポンスは裸のオブジェクト / 裸の配列。
- **キー変換もしない。** JSON も snake_case (iOS 側の decoder が吸収する)。
- 出した形は必ず `swagger_helper.rb` の `components.schemas` と一致させる
  (ズレたら rswag の `schema` 照合で落ちる)。

## スキーマとファクトリ

レスポンスの形は `spec/swagger_helper.rb` の `components.schemas` に定義し `$ref` で参照する
(spec にインラインで書かない)。既存: `User` / `SignupInput` / `LoginInput` / `UserInput` /
`ValidationErrors` / `Unauthorized` / `NotFound`。`required:` と `example:` を省略しない。

ファクトリは `spec/factories/`。`create(:user)` はログイン可能な `identity` 付きで作られる。

## エンドポイント追加

1. `db/Schemafile` にテーブルを足す → `make db-apply`
   (モデルが要るなら `bin/rails g model Post --no-fixture`。マイグレーションは生成されない)
2. `app/serializers/post_serializer.rb` を `user_serializer.rb` に倣って作る (Alba)
3. `app/controllers/api/v1/posts_controller.rb` を `users_controller.rb` に倣って作る
   - 例外は rescue せず `ApplicationController` の `rescue_from` に任せる
   - レスポンスは `render json: PostSerializer.new(post)` だけ。コントローラで組まない
4. `config/routes.rb` の `namespace :api` / `:v1` 配下に `resources :posts`
5. `swagger_helper.rb` にスキーマ追加 → spec を書く
6. `make test` → `make docs` → **生成物もコミット**(CI が `git diff --exit-code swagger/` で検査)

Lint は `bin/rubocop -f github`(CI と同じ)。自動修正は `bin/rubocop -a`。
